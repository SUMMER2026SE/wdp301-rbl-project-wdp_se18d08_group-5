/**
 * matchStateMachine.ts — XState v5 machine điều khiển toàn bộ match lifecycle.
 *
 * Dùng XState v5 `setup()` API (không dùng `createMachine()` cũ). Tất cả
 * duration đọc từ DEBATE_DURATIONS, không magic number.
 *
 * States (xem sơ đồ trong ARCHITECTURE.md):
 *
 *   ROOM_WAITING
 *     ├─ START_MATCH (host mode)        → COUNTDOWN_3S
 *     ├─ START_MATCH (noHost_ai)       → STARTING (collect consensus)
 *     └─ START_MATCH (noHost_human)    → COUNTDOWN_3S (Judge S1)
 *
 *   STARTING (noHost_ai_ only)
 *     ├─ S1_READY × 2 (cả 2 Captain)   → COUNTDOWN_3S
 *     └─ (nếu timeout — không xử lý ở đây, chờ guard)
 *
 *   COUNTDOWN_3S (after 3s)
 *     └─ (entry action: advance step → PREP_7MIN)
 *
 *   PREP_7MIN (active, 7min countdown)
 *     ├─ TIMER_EXPIRED                  → TRANSITION
 *     ├─ CONTROLLER_SKIP                → TRANSITION
 *     ├─ CONSENSUS_SKIP × 2 (noHost_ai) → TRANSITION
 *     └─ PAUSE                          → PAUSED_PREP
 *
 *   PAUSED_PREP
 *     └─ RESUME                         → PREP_7MIN
 *
 *   TRANSITION (after 3s mute)
 *     ├─ MANUAL mode                    → IDLE_BEFORE_NEXT
 *     └─ AUTO_TIMED mode                → (advance + after 10s) → active next phase
 *
 *   IDLE_BEFORE_NEXT (only MANUAL)
 *     └─ CONTROLLER_START               → active next phase
 *
 *   ROUND_SPEECH, CROSS_EXAM, JUDGE_FEEDBACK — tương tự pattern
 *   trên với guards đặc thù.
 *
 *   COMPLETED (terminal)
 */

import { setup, assign } from 'xstate';
import { DEBATE_DURATIONS } from '../config/duration.config';
import type { DebateModeConfig, Role } from '../config/types';
import {
  createInitialContext,
  type MatchContext,
  type MatchEvent,
  type PhaseLifecycleStatus,
} from './matchStates';
import { generateFlowFromMode } from './flowGenerator';
import { getTransitionAnnouncement } from '../config/transitionAnnouncements';

// ── Helpers ──────────────────────────────────────────────────────────

function controllerOf(mode: DebateModeConfig): Role | null {
  if (mode.controllerRole === 'HOST') return 'host';
  if (mode.controllerRole === 'JUDGE_S1') return 'judge_s1';
  return null; // CAPTAIN_CONSENSUS không có single controller role
}

function isController(role: Role, mode: DebateModeConfig): boolean {
  return role === controllerOf(mode);
}

function canStartMatch(role: Role, mode: DebateModeConfig): boolean {
  // start_match permission là mode-specific
  if (mode.hasHost && role === 'host') return true;
  if (!mode.hasHost && mode.judgeType === 'AI' && (role === 'captain_prop' || role === 'captain_opp')) {
    return true;
  }
  if (!mode.hasHost && mode.judgeType !== 'AI' && role === 'judge_s1') return true;
  return false;
}

// ── State machine definition ────────────────────────────────────────

export const matchMachine = setup({
  types: {
    context: {} as MatchContext,
    events: {} as MatchEvent,
    input: {} as { mode: DebateModeConfig; roomId: string },
  },
  guards: {
    /** START_MATCH guard: kiểm tra actor có quyền start_match không */
    canStartMatch: ({ context, event }) => {
      if (event.type !== 'START_MATCH') return false;
      return canStartMatch(event.actorRole, context.mode);
    },
    /** Host / Judge S1 START_MATCH (không cần consensus) → COUNTDOWN_3S */
    isSingleControllerStart: ({ context, event }) => {
      if (event.type !== 'START_MATCH') return false;
      const m = context.mode;
      return (
        (m.hasHost && event.actorRole === 'host') ||
        (!m.hasHost && m.judgeType !== 'AI' && event.actorRole === 'judge_s1')
      );
    },
    /** No-Host + AI: START_MATCH bởi Captain → STARTING (collect consensus) */
    isConsensusStart: ({ context, event }) => {
      if (event.type !== 'START_MATCH') return false;
      return (
        !context.mode.hasHost &&
        context.mode.judgeType === 'AI' &&
        (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp')
      );
    },
    /** Cả 2 Captain đã vote → advance */
    bothCaptainsReady: ({ context, event }) => {
      if (event.type !== 'S1_READY') return false;
      const votes = new Set(context.startConsensusVotes);
      votes.add(event.actorUserId);
      // Cần có vote từ cả 2 đội
      // Trong 1v1: cả 2 debater = captain_prop + captain_opp
      // Trong 3v3: cả 2 Captain S1
      // Heuristic: votes.size >= 2 (2 Captain)
      return votes.size >= 2;
    },
    /** Controller có quyền skip/timer expired */
    canControllerSkip: ({ context, event }) => {
      if (event.type !== 'CONTROLLER_SKIP') return false;
      return isController(event.actorRole, context.mode);
    },
    /** Speaker skip — chỉ cho phép khi đến lượt speaker đó */
    canSpeakerSkip: ({ context, event }) => {
      if (event.type !== 'SPEAKER_SKIP') return false;
      const step = generateFlowFromMode(context.mode)[context.currentStepIndex];
      if (!step || step.phase !== 'speech') return false;
      // Check actorRole matches current speaker
      const currentSpeaker = step.speaker; // 'PRO_S1' / 'OPP_S2'
      const expectedRole: Role =
        currentSpeaker === 'PRO_S1'
          ? 'captain_prop'
          : currentSpeaker === 'PRO_S2' || currentSpeaker === 'PRO_S3'
            ? 'debater_prop'
            : currentSpeaker === 'OPP_S1'
              ? 'captain_opp'
              : 'debater_opp';
      if (event.actorRole !== expectedRole) return false;
      // Check slot matches
      const slot = currentSpeaker.split('_')[1]; // 'S1' | 'S2' | 'S3'
      return event.speakerSlot === slot;
    },
    /** Consensus skip — Captain trong noHost_ai_* */
    isConsensusSkip: ({ context, event }) => {
      if (event.type !== 'CONSENSUS_SKIP') return false;
      return (
        !context.mode.hasHost &&
        context.mode.judgeType === 'AI' &&
        (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp')
      );
    },
    /** Cả 2 Captain đã đồng ý skip Prep/CE */
    bothCaptainsSkip: ({ context, event }) => {
      if (event.type !== 'CONSENSUS_SKIP') return false;
      const votes = new Set(context.consensusSkipVotes);
      votes.add(event.actorUserId);
      return votes.size >= 2;
    },
    /** Controller có quyền pause */
    canPause: ({ context, event }) => {
      if (event.type !== 'PAUSE') return false;
      // noHost_ai_*: không có pause (Consolidated §4.2)
      if (!context.mode.hasHost && context.mode.judgeType === 'AI') return false;
      return isController(event.actorRole, context.mode);
    },
    /** Controller có quyền resume */
    canResume: ({ context, event }) => {
      if (event.type !== 'RESUME') return false;
      if (!context.mode.hasHost && context.mode.judgeType === 'AI') return false;
      return isController(event.actorRole, context.mode);
    },
    /** Surrender — chỉ Captain trong mọi mode */
    canSurrender: ({ event }) => {
      if (event.type !== 'SURRENDER') return false;
      return event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp';
    },
    /** Idempotency: surrender chưa trigger */
    surrenderNotTriggered: ({ context }) => context.surrendered === false,
    /** Request draw — chỉ Captain */
    canRequestDraw: ({ event }) => {
      if (event.type !== 'REQUEST_DRAW') return false;
      return event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp';
    },
    /** Accept draw — chỉ Captain của đội đối */
    canAcceptDraw: ({ context, event }) => {
      if (event.type !== 'ACCEPT_DRAW') return false;
      if (event.actorRole !== 'captain_prop' && event.actorRole !== 'captain_opp') {
        return false;
      }
      const acceptTeam = event.actorRole === 'captain_prop' ? 'proposition' : 'opposition';
      // Cần pending request từ đội đối
      for (const [team] of context.pendingDrawRequests) {
        if (team !== acceptTeam) return true;
      }
      return false;
    },
    /** No Host + AI: judge_s1 disconnect → pause + no handoff */
    canJudgeS1Disconnect: ({ context, event }) => {
      if (event.type !== 'JUDGE_S1_DISCONNECT') return false;
      return !context.mode.hasHost && context.mode.judgeType !== 'AI';
    },
    /** CONTROLLER_START guard */
    canControllerStart: ({ context, event }) => {
      if (event.type !== 'CONTROLLER_START') return false;
      return isController(event.actorRole, context.mode);
    },
    /** JUDGE_SUBMIT_ALL — host_human_* + noHost_human_* */
    isJudgeSubmitAll: ({ context, event }) => {
      if (event.type !== 'JUDGE_SUBMIT_ALL') return false;
      return context.mode.judgeType !== 'AI';
    },
    /** MANUAL mode (Host / Judge S1) — pause đến controller bấm Start */
    isManualMode: ({ context }) => context.mode.phaseTransition === 'MANUAL',
    /** AUTO_TIMED mode — sau mute + 10s tự động advance */
    isAutoTimedMode: ({ context }) => context.mode.phaseTransition === 'AUTO_TIMED',
    /** Host + Human mode: AI không tự verdict */
    isAIJudge: ({ context }) => context.mode.judgeType === 'AI',
  },
  actions: {
    setInitialStepIndex: assign({
      currentStepIndex: () => 1, // PREP_7MIN is index 1 (after MOTION at index 0)
    }),
    advanceToNextStep: assign(({ context }) => {
      const flow = generateFlowFromMode(context.mode);
      const next = flow[context.currentStepIndex + 1];
      const now = Date.now();
      const phaseEndsAt = next && next.durationSec > 0 ? now + next.durationSec * 1000 : null;
      return {
        currentStepIndex: context.currentStepIndex + 1,
        phaseStatus: 'active' as PhaseLifecycleStatus,
        phaseStartedAt: now,
        phaseEndsAt,
      };
    }),
    setPhaseActive: assign({
      phaseStatus: () => 'active' as PhaseLifecycleStatus,
      phaseStartedAt: () => Date.now(),
    }),
    setPhaseIdle: assign({
      phaseStatus: () => 'idle' as PhaseLifecycleStatus,
      phaseStartedAt: null,
      phaseEndsAt: null,
    }),
    setPhasePaused: assign({
      phaseStatus: () => 'paused' as PhaseLifecycleStatus,
      pausedAt: () => Date.now(),
    }),
    setPhaseTransition: assign({
      phaseStatus: () => 'transition' as PhaseLifecycleStatus,
      phaseStartedAt: null,
      phaseEndsAt: null,
    }),
    setPhaseCompleted: assign({
      phaseStatus: () => 'completed' as PhaseLifecycleStatus,
      phaseStartedAt: null,
      phaseEndsAt: null,
    }),
    setJudgeS1Disconnected: assign({
      judgeS1Disconnected: () => true,
    }),
    clearJudgeS1Disconnected: assign({
      judgeS1Disconnected: () => false,
    }),
    addStartVote: assign(({ context, event }) => {
      if (event.type !== 'S1_READY') return {};
      const next = new Set(context.startConsensusVotes);
      next.add(event.actorUserId);
      return { startConsensusVotes: next };
    }),
    addConsensusSkipVote: assign(({ context, event }) => {
      if (event.type !== 'CONSENSUS_SKIP') return {};
      const next = new Set(context.consensusSkipVotes);
      next.add(event.actorUserId);
      return { consensusSkipVotes: next };
    }),
    clearConsensusSkipVotes: assign({
      consensusSkipVotes: () => new Set<string>(),
    }),
    clearStartVotes: assign({
      startConsensusVotes: () => new Set<string>(),
    }),
    addPendingDrawRequest: assign(({ context, event }) => {
      if (event.type !== 'REQUEST_DRAW') return {};
      const team = event.actorRole === 'captain_prop' ? 'proposition' : 'opposition';
      const next = new Map(context.pendingDrawRequests);
      next.set(team, { requestedBy: event.actorUserId, requestedAt: Date.now() });
      return { pendingDrawRequests: next };
    }),
    clearPendingDrawRequests: assign({
      pendingDrawRequests: () => new Map(),
    }),
    recordSurrender: assign(({ event }) => {
      if (event.type !== 'SURRENDER') return {};
      const team = event.actorRole === 'captain_prop' ? 'proposition' : 'opposition';
      return {
        surrendered: { team, userId: event.actorUserId } as const,
      };
    }),
    recordDrawAccepted: assign(({ context, event }) => {
      if (event.type !== 'ACCEPT_DRAW') return {};
      const propUser = context.pendingDrawRequests.get('proposition')?.requestedBy ?? '';
      const oppUser = event.actorUserId;
      return {
        drawAccepted: { propositionUserId: propUser, oppositionUserId: oppUser } as const,
        pendingDrawRequests: new Map() as MatchContext['pendingDrawRequests'],
      };
    }),
  },
  delays: {
    INITIAL_COUNTDOWN: DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000,
    TRANSITION_MUTE: DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000,
    AUTO_TRANSITION_COUNTDOWN: DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS * 1000,
  },
}).createMachine({
  id: 'match',
  initial: 'ROOM_WAITING',
  context: ({ input }) => createInitialContext(input.mode, input.roomId),
  states: {
    ROOM_WAITING: {
      on: {
        START_MATCH: [
          {
            guard: 'isSingleControllerStart',
            target: 'COUNTDOWN_3S',
            actions: ['setInitialStepIndex'],
          },
          {
            guard: 'isConsensusStart',
            target: 'STARTING',
            actions: ['addStartVote'],
          },
        ],
        // Surrender / Draw có thể xảy ra ngay cả khi chưa start
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
        REQUEST_DRAW: {
          guard: 'canRequestDraw',
          actions: ['addPendingDrawRequest'],
        },
        ACCEPT_DRAW: {
          guard: 'canAcceptDraw',
          target: 'COMPLETED',
          actions: ['recordDrawAccepted', 'setPhaseCompleted'],
        },
      },
    },

    STARTING: {
      on: {
        S1_READY: [
          {
            guard: 'bothCaptainsReady',
            target: 'COUNTDOWN_3S',
            actions: ['addStartVote', 'clearStartVotes', 'setInitialStepIndex'],
          },
          { actions: ['addStartVote'] },
        ],
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
        REQUEST_DRAW: {
          guard: 'canRequestDraw',
          actions: ['addPendingDrawRequest'],
        },
        ACCEPT_DRAW: {
          guard: 'canAcceptDraw',
          target: 'COMPLETED',
          actions: ['recordDrawAccepted', 'setPhaseCompleted'],
        },
      },
    },

    COUNTDOWN_3S: {
      after: {
        INITIAL_COUNTDOWN: {
          target: 'PREP_7MIN',
          actions: ['setPhaseActive'],
        },
      },
      on: {
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    PREP_7MIN: {
      on: {
        TIMER_EXPIRED: {
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        CONTROLLER_SKIP: {
          guard: 'canControllerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        CONSENSUS_SKIP: [
          {
            guard: 'bothCaptainsSkip',
            target: 'TRANSITION',
            actions: ['addConsensusSkipVote', 'clearConsensusSkipVotes', 'setPhaseTransition'],
          },
          { actions: ['addConsensusSkipVote'] },
        ],
        PAUSE: {
          guard: 'canPause',
          target: 'PAUSED_PREP',
          actions: ['setPhasePaused'],
        },
        JUDGE_S1_DISCONNECT: {
          guard: 'canJudgeS1Disconnect',
          target: 'PAUSED_PREP',
          actions: ['setJudgeS1Disconnected', 'setPhasePaused'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
        REQUEST_DRAW: {
          guard: 'canRequestDraw',
          actions: ['addPendingDrawRequest'],
        },
        ACCEPT_DRAW: {
          guard: 'canAcceptDraw',
          target: 'COMPLETED',
          actions: ['recordDrawAccepted', 'setPhaseCompleted'],
        },
      },
    },

    PAUSED_PREP: {
      on: {
        RESUME: {
          guard: 'canResume',
          target: 'PREP_7MIN',
          actions: ['setPhaseActive'],
        },
        JUDGE_S1_RECONNECT: {
          target: 'PREP_7MIN',
          actions: ['clearJudgeS1Disconnected', 'setPhaseActive'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    TRANSITION: {
      after: {
        TRANSITION_MUTE: [
          {
            guard: 'isManualMode',
            target: 'IDLE_BEFORE_NEXT',
            actions: ['setPhaseIdle'],
          },
          {
            guard: 'isAutoTimedMode',
            target: 'AUTO_ADVANCE_WAIT',
            actions: ['setPhaseIdle'],
          },
        ],
      },
    },

    AUTO_ADVANCE_WAIT: {
      after: {
        AUTO_TRANSITION_COUNTDOWN: {
          target: 'NEXT_ACTIVE_PHASE',
          actions: ['advanceToNextStep'],
        },
      },
    },

    NEXT_ACTIVE_PHASE: {
      // Pseudo-state để route đến phase tiếp theo dựa trên currentStepIndex
      always: [
        {
          guard: ({ context }) => {
            const flow = generateFlowFromMode(context.mode);
            const next = flow[context.currentStepIndex];
            return !next || next.speaker === 'COMPLETED';
          },
          target: 'COMPLETED',
          actions: ['setPhaseCompleted'],
        },
        {
          guard: ({ context }) => {
            const flow = generateFlowFromMode(context.mode);
            const next = flow[context.currentStepIndex];
            return next?.phase === 'cross_exam';
          },
          target: 'CROSS_EXAM',
        },
        {
          guard: ({ context }) => {
            const flow = generateFlowFromMode(context.mode);
            const next = flow[context.currentStepIndex];
            return next?.phase === 'judge_feedback';
          },
          target: 'JUDGE_FEEDBACK',
        },
        { target: 'ROUND_SPEECH' },
      ],
    },

    IDLE_BEFORE_NEXT: {
      on: {
        CONTROLLER_START: {
          guard: 'canControllerStart',
          target: 'NEXT_ACTIVE_PHASE',
          actions: ['advanceToNextStep'],
        },
        CONTROLLER_SKIP: {
          guard: 'canControllerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    ROUND_SPEECH: {
      on: {
        TIMER_EXPIRED: {
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        SPEAKER_SKIP: {
          guard: 'canSpeakerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        CONTROLLER_SKIP: {
          guard: 'canControllerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        PAUSE: {
          guard: 'canPause',
          target: 'PAUSED_SPEECH',
          actions: ['setPhasePaused'],
        },
        JUDGE_S1_DISCONNECT: {
          guard: 'canJudgeS1Disconnect',
          target: 'PAUSED_SPEECH',
          actions: ['setJudgeS1Disconnected', 'setPhasePaused'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    PAUSED_SPEECH: {
      on: {
        RESUME: {
          guard: 'canResume',
          target: 'ROUND_SPEECH',
          actions: ['setPhaseActive'],
        },
        JUDGE_S1_RECONNECT: {
          target: 'ROUND_SPEECH',
          actions: ['clearJudgeS1Disconnected', 'setPhaseActive'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    CROSS_EXAM: {
      on: {
        TIMER_EXPIRED: {
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        CONTROLLER_SKIP: {
          guard: 'canControllerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        CONSENSUS_SKIP: [
          {
            guard: 'bothCaptainsSkip',
            target: 'TRANSITION',
            actions: ['addConsensusSkipVote', 'clearConsensusSkipVotes', 'setPhaseTransition'],
          },
          { actions: ['addConsensusSkipVote'] },
        ],
        PAUSE: {
          guard: 'canPause',
          target: 'PAUSED_CE',
          actions: ['setPhasePaused'],
        },
        JUDGE_S1_DISCONNECT: {
          guard: 'canJudgeS1Disconnect',
          target: 'PAUSED_CE',
          actions: ['setJudgeS1Disconnected', 'setPhasePaused'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    PAUSED_CE: {
      on: {
        RESUME: {
          guard: 'canResume',
          target: 'CROSS_EXAM',
          actions: ['setPhaseActive'],
        },
        JUDGE_S1_RECONNECT: {
          target: 'CROSS_EXAM',
          actions: ['clearJudgeS1Disconnected', 'setPhaseActive'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    JUDGE_FEEDBACK: {
      on: {
        JUDGE_SUBMIT_ALL: [
          {
            guard: 'isJudgeSubmitAll',
            target: 'TRANSITION',
            actions: ['setPhaseTransition'],
          },
        ],
        CONTROLLER_SKIP: {
          guard: 'canControllerSkip',
          target: 'TRANSITION',
          actions: ['setPhaseTransition'],
        },
        AI_VERDICT_READY: [
          {
            guard: 'isAIJudge',
            target: 'TRANSITION',
            actions: ['setPhaseTransition'],
          },
        ],
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    PAUSED_JUDGE_FEEDBACK: {
      on: {
        RESUME: {
          guard: 'canResume',
          target: 'JUDGE_FEEDBACK',
          actions: ['setPhaseActive'],
        },
        JUDGE_S1_RECONNECT: {
          target: 'JUDGE_FEEDBACK',
          actions: ['clearJudgeS1Disconnected', 'setPhaseActive'],
        },
        SURRENDER: {
          guard: ({ event }) =>
            event.type === 'SURRENDER' &&
            (event.actorRole === 'captain_prop' || event.actorRole === 'captain_opp'),
          target: 'COMPLETED',
          actions: ['recordSurrender', 'setPhaseCompleted'],
        },
      },
    },

    COMPLETED: {
      type: 'final',
    },
  },
});

export type { MatchContext, MatchEvent, PhaseLifecycleStatus } from './matchStates';
export { createInitialContext } from './matchStates';

// ── Public API ─────────────────────────────────────────────────────

/**
 * Helper để debug — in ra current speaker + announcement cho transition.
 */
export function debugTransitionInfo(mode: DebateModeConfig, stepIndex: number): string {
  const flow = generateFlowFromMode(mode);
  const step = flow[stepIndex];
  const next = flow[stepIndex + 1];
  if (!step || !next) return 'Transition complete';
  return getTransitionAnnouncement(step.speaker as never, next.phase, mode.id);
}