import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { aggregateFinalScores } from '../../utils/scoring.js';
import { hasControlPanel } from '../../utils/roomPermissions.js';
import { DEBATE_DURATIONS } from './engine/config/duration.config.js';
import {
  getFlowAdapter,
  checkStartMatchParticipantsAdapter,
  canPerformAdapter,
} from './engine/adapter.js';
import { generateFinalDebateAnalysis } from './final-analysis.service.js';

// Re-export duration constants cho code cũ đang reference trực tiếp (backward-compat)
const TRANSITION_MUTE_SECONDS = DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS;
const AUTO_TRANSITION_COUNTDOWN = DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS;
const HOST_END_COUNTDOWN_SECONDS = DEBATE_DURATIONS.HOST_END_COUNTDOWN_SECONDS;
const noHostAiStartConsensus = new Map<string, Set<string>>();

type DebateStep = {
  speaker: string;
  phase: string;
  timeLimit: number;
  speakerCanEnd: boolean;
  hostCanEnd: boolean;
  formats?: Array<'1v1' | '3v3'>;
  ce?: {
    askingTeam: 'proposition' | 'opposition';
    answeringTeam: 'proposition' | 'opposition';
    quotaPerTeam: number;
    questionsAsked: number;
    currentRole: 'asker' | 'answerer';
  };
};

/**
 * Note lịch sử: trước đây 4 hard-coded arrays (DEBATE_FLOW_HOST_3V3/1V1 + NOHost_*)
 * định nghĩa flow cho từng mode. Nay đã được thay bằng `getFlowAdapter()` từ
 * engine — single source of truth. Code cũ vẫn dùng `getFlow()` export bên dưới
 * nhưng nó chỉ là thin wrapper gọi engine.
 */

export function getFlow(
  format?: '1v1' | '3v3',
  hostType?: 'human' | 'ai',
  judgeType?: 'human' | 'ai',
): DebateStep[] {
  // Delegate sang engine mới — single source of truth cho flow definition.
  // Xem engine/flowGenerator.ts + engine/config/modeConfigs.ts.
  return getFlowAdapter(format, hostType, judgeType) as DebateStep[];
}

export function getStepIndex(flow: DebateStep[], speaker: string, phase: string): number {
  return flow.findIndex((step) => step.speaker === speaker && step.phase === phase);
}

/**
 * Per docs/rule_*  §Start Match — only allow Start when ALL Main Participants
 * are present (debaters + host + human judges). AI judges don't add to the
 * total. The expected total depends on format × hostType × judgeType.
 */
export function checkStartMatchParticipants(room: any): { ready: boolean; reason?: string; counts?: any } {
  // Delegate sang engine mới — single source of truth cho requiredParticipants.
  // Xem engine/adapter.ts → checkStartMatchParticipantsAdapter.
  return checkStartMatchParticipantsAdapter(room);
}

function assertHost(room: any, userId: string) {
  const participant = room.participants.find(
    (p: any) => p.userId.toString() === userId,
  );
  if (!participant) {
    throw new ForbiddenError('You are not in this room');
  }
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  if (effectiveRole !== 'host') {
    throw new ForbiddenError('Only the host can control the debate');
  }
}

export function snapshotCurrentTurn(session: any, transcript = '') {
  const now = new Date();
  const duration = session.currentTurn?.startTime
    ? now.getTime() - new Date(session.currentTurn.startTime).getTime()
    : 0;
  const turn = session.currentTurn as any;
  session.turnHistory = session.turnHistory || [];
  session.turnHistory.push({
    speaker: session.currentTurn.speaker,
    startTime: session.currentTurn.startTime || now,
    endTime: now,
    duration,
    transcript,
    crossExamination:
      session.currentTurn.phase === 'cross_exam'
        ? {
            questionsAsked: turn.ceState?.questionsAsked || 0,
            questionsAnswered: turn.ceState?.questionsAnswered || 0,
            timeRemainingPro: turn.ceState?.askingTeam === 'proposition' ? session.currentTurn.timeRemaining : 0,
            timeRemainingOpp: turn.ceState?.askingTeam === 'opposition' ? session.currentTurn.timeRemaining : 0,
            transcript: turn.ceState?.transcript || [],
          }
        : null,
    aiAnalysis: null,
  });
}

export function applyStep(session: any, step: DebateStep) {
  const turn = session.currentTurn as any;
  turn.speaker = step.speaker;
  turn.phase = step.phase;
  turn.startTime = new Date();
  turn.timeLimit = step.timeLimit;
  turn.timeRemaining = 0; // Starts at 00:00; set to timeLimit only when host starts
  turn.status = step.phase === 'completed' ? 'completed' : 'waiting_to_start';
  turn.phaseStatus = step.phase === 'completed' ? 'completed' : 'idle';
  turn.transitionEndsAt = null;
  if (step.ce) {
    turn.ceState = { ...step.ce, questionsAnswered: 0, transcript: [] };
  } else {
    turn.ceState = null;
  }
}

// `aggregateFinalScores` from utils/scoring.ts remains the single source of
// truth for scoring math. The earlier criteria-based helper at this location
// has been retired — judge verdicts are now round-based (speak/ce) and any
// aggregation must use the tie-breaker aware implementation.

// ─── Public service functions ────────────────────────────────────────────────

export async function startDebate(roomId: string, userId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  // Enforce the rule: only allow Start when ALL Main Participants are present
  // (debaters + host + human judges). AI judges don't count toward the total.
  const participantsCheck = checkStartMatchParticipants(room);
  if (!participantsCheck.ready) {
    throw new BadRequestError(participantsCheck.reason || 'Not enough participants to start');
  }

  // No-host: require S1 debaters consensus (AI judge) or Judge S1 (Human judge)
  // to start. The owner has no special override in No-Host modes.
  const isNoHost = room.hostType !== 'human';
  const isAIJudge = room.judgeType === 'ai';

  const participant = room.participants.find(
    (p: any) => p.userId.toString() === userId,
  );
  const effectiveRole = participant
    ? participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole
    : null;

  // Engine-driven permission check (single source of truth cho "who can start_match")
  // canPerformAdapter bao trùm: Host có start_match trong host_*,
  // Judge S1 có start_match trong noHost_human_*,
  // Captain (S1 debater) có start_match trong noHost_ai_*.
  const engineCanStart = participant
    ? canPerformAdapter(
        {
          userId,
          roomRole: participant.roomRole ?? undefined,
          primaryRole: participant.primaryRole ?? undefined,
          team: participant.team ?? undefined,
          speakerSlot: participant.speakerSlot ?? undefined,
          hasControlPanel: hasControlPanel(room, userId),
        },
        'start_match',
        {
          format: room.format,
          hostType: room.hostType,
          judgeType: room.judgeType,
          judgeCount: room.judgeCount,
        },
      )
    : false;

  let isAuthorized = false;

  if (!isNoHost) {
    // Host mode: owner hoặc host có start_match (engine check confirm).
    // Owner override cũ vẫn giữ để backward-compat với rooms hiện có.
    const isOwner = room.createdBy.toString() === userId;
    isAuthorized = engineCanStart || (isOwner && effectiveRole !== null);
  } else {
    // No-Host mode: owner bypass is NOT allowed per rule
    if (isAIJudge) {
      // No-Host + AI: only S1 debaters consensus starts the debate
      isAuthorized =
        engineCanStart &&
        effectiveRole === 'debater' &&
        (participant as any).speakerSlot === 'S1';
    } else {
      // No-Host + Human Judge: only Judge S1 starts the debate
      isAuthorized =
        engineCanStart && effectiveRole === 'judge' && hasControlPanel(room, userId);
    }
  }

  if (!isAuthorized) {
    throw new ForbiddenError('Only the room owner or authorized debate controller can start the debate');
  }

  if (!['waiting', 'ready'].includes(room.status)) {
    throw new BadRequestError('Room cannot be started in current state');
  }
  if (!room.motion?.trim()) {
    throw new BadRequestError('Choose a debate topic before starting');
  }
  const existingSession = await DebateSession.findOne({ roomId: room._id });
  if (existingSession) throw new BadRequestError('Debate session already exists');

  if (isNoHost && isAIJudge) {
    const roomKey = room._id.toString();
    const consensusSet = noHostAiStartConsensus.get(roomKey) || new Set<string>();
    consensusSet.add(userId);
    noHostAiStartConsensus.set(roomKey, consensusSet);

    const s1Debaters = room.participants.filter((p: any) => {
      const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
      return role === 'debater' && p.speakerSlot === 'S1' && p.team;
    });
    const requiredUserIds = s1Debaters.map((p: any) => p.userId.toString());
    const allS1DebatersReady =
      requiredUserIds.length >= 2 &&
      requiredUserIds.every((requiredUserId: string) => consensusSet.has(requiredUserId));

    if (!allS1DebatersReady) {
      return {
        room,
        session: null,
        pendingStart: true,
        readyUserIds: Array.from(consensusSet),
        requiredUserIds,
        totalDebaters: requiredUserIds.length,
      };
    }

    noHostAiStartConsensus.delete(roomKey);
  } else {
    noHostAiStartConsensus.delete(room._id.toString());
  }

  const session = new DebateSession({ roomId: room._id });
  const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);

  // All configurations now start directly at the motion step (index 0).
  const startIdx = 0;
  
  applyStep(session, flow[startIdx]);
  room.status = 'active';
  room.currentPhase = flow[startIdx].phase;
  room.startedAt = new Date();

  // Unlock mic for all debaters + judges during free time (waiting_s1 phase)
  await unlockAllParticipantsMic(room);

  await Promise.all([session.save(), room.save()]);
  return { room, session };
}

export async function startPhase(roomId: string, userId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  // No-Host + Human Judge: Judge S1 acts as host and can start phases
  // Host mode: only host can start phases
  if (room.hostType !== 'human') {
    const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
    const effectiveRole = participant
      ? participant.roomRole === 'owner' ? (participant as any).primaryRole : participant.roomRole
      : null;
    const isJudgeS1 =
      participant &&
      effectiveRole === 'judge' &&
      hasControlPanel(room, userId);
    if (!isJudgeS1) {
      throw new ForbiddenError('Only Judge S1 can start phases in No-Host + Human Judge rooms');
    }
  } else {
    assertHost(room, userId);
  }

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (turn.phase === 'completed' || turn.status === 'completed') {
    throw new BadRequestError('Debate is already completed');
  }
  if (turn.phaseStatus !== 'idle') {
    throw new BadRequestError(`Cannot start phase in '${turn.phaseStatus}' state`);
  }
  turn.phaseStatus = 'active';
  turn.status = 'active';
  turn.startTime = new Date();
  turn.timeRemaining = turn.timeLimit || 0;
  await session.save();
  return { room, session, currentTurn: session.currentTurn };
}

export async function endPhaseByHost(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  if (room.hostType === 'human') {
    assertHost(room, userId);
  } else {
    // No-host rooms: only Judge S1 can use host-level controls
    const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
    const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
    const isJudgeS1 =
      participant &&
      effectiveRole === 'judge' &&
      hasControlPanel(room, userId);
    if (!isJudgeS1) {
      throw new ForbiddenError('Only Judge S1 can control this phase');
    }
  }
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (turn.phase === 'completed' || turn.status === 'completed') {
    throw new BadRequestError('Debate is already completed');
  }
  if (turn.phaseStatus !== 'active' && turn.phaseStatus !== 'paused') {
    throw new BadRequestError(`Cannot end phase in '${turn.phaseStatus}' state`);
  }
  const flow = getFlow(
    (room.format as '1v1' | '3v3') || '3v3',
    (room.hostType as 'human' | 'ai') || undefined,
    room.judgeType as 'human' | 'ai' | undefined,
  );
  const currentIndex = getStepIndex(flow, turn.speaker, turn.phase);
  if (currentIndex === -1) throw new BadRequestError('Current step not in flow');
  const currentStep = flow[currentIndex];

  const isNoHostHumanJudge = room.hostType !== 'human' && room.judgeType === 'human';
  // Engine-driven permission: skip_phase cho Host (host_*) hoặc Judge S1 (noHost_human_*).
  // Engine đã bao trùm logic này — code cũ check `currentStep.hostCanEnd` để override
  // cho noHost_human (Judge S1 = host thay thế).
  const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
  const engineCanSkip = participant
    ? canPerformAdapter(
        {
          userId,
          roomRole: participant.roomRole ?? undefined,
          primaryRole: participant.primaryRole ?? undefined,
          hasControlPanel: hasControlPanel(room, userId),
        },
        'skip_phase',
        {
          format: room.format,
          hostType: room.hostType,
          judgeType: room.judgeType,
          judgeCount: room.judgeCount,
        },
      )
    : false;
  if (!isNoHostHumanJudge && !engineCanSkip && !currentStep.hostCanEnd) {
    throw new BadRequestError('Host cannot end this phase');
  }
  
  await triggerTransition(roomId, transcript);
  const freshSession = await DebateSession.findOne({ roomId: room._id });
  return { room, session: freshSession, currentTurn: freshSession?.currentTurn };
}

export async function endPhaseBySpeaker(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (turn.phase === 'completed' || turn.status === 'completed') {
    throw new BadRequestError('Debate is already completed');
  }
  if (turn.phaseStatus !== 'active' && turn.phaseStatus !== 'paused') {
    throw new BadRequestError(`Cannot end phase in '${turn.phaseStatus}' state`);
  }
  const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);
  const currentIndex = getStepIndex(flow, turn.speaker, turn.phase);
  if (currentIndex === -1) throw new BadRequestError('Current step not in flow');
  const currentStep = flow[currentIndex];
  if (!currentStep.speakerCanEnd) throw new BadRequestError('Speaker cannot end this phase');
  const participant = room.participants.find((p: any) => p.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('Only room participants can end a speech');
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  const participantTeam = participant.team === 'proposition' ? 'PRO' : 'OPP';
  const participantSpeaker = participant.speakerSlot ? `${participantTeam}_${participant.speakerSlot}` : null;
  const isJudgeS1 = room.hostType !== 'human' && effectiveRole === 'judge' && hasControlPanel(room, userId);
  const hasHostControl = effectiveRole === 'host' || isJudgeS1;
  const isSameTeam1v1Speaker =
    room.format === '1v1' &&
    effectiveRole === 'debater' &&
    ((participant.team === 'proposition' && String(turn.speaker).startsWith('PRO_')) ||
      (participant.team === 'opposition' && String(turn.speaker).startsWith('OPP_')));

  if (participantSpeaker !== turn.speaker && !isSameTeam1v1Speaker && !hasHostControl) {
    throw new ForbiddenError('Only the active speaker (or host) can end the speech');
  }
  
  await triggerTransition(roomId, transcript);
  const freshSession = await DebateSession.findOne({ roomId: room._id });
  return { room, session: freshSession, currentTurn: freshSession?.currentTurn };
}

export async function advanceTurn(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  if (room.hostType === 'human') {
    assertHost(room, userId);
  } else {
    // No-host rooms: only Judge S1 can use host-level controls
    const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
    const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
    const isJudgeS1 =
      participant &&
      effectiveRole === 'judge' &&
      hasControlPanel(room, userId);
    if (!isJudgeS1) {
      throw new ForbiddenError('Only Judge S1 can advance the debate');
    }
  }
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  if (session.currentTurn.status === 'completed') {
    throw new BadRequestError('Debate is already completed');
  }
  return advanceTurnInternal(room, session, transcript);
}

export async function advanceTurnInternal(room: any, session: any, transcript = '') {
  const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);
  const currentIndex = getStepIndex(flow, session.currentTurn.speaker, session.currentTurn.phase);
  const nextStep = flow[Math.min(currentIndex + 1, flow.length - 1)];
  snapshotCurrentTurn(session, transcript);
  applyStep(session, nextStep);
  room.currentPhase = nextStep.phase;
  if (nextStep.phase === 'completed') {
    room.status = 'completed';
    room.endedAt = new Date();
    (session.currentTurn as any).status = 'completed';
    (session.currentTurn as any).phaseStatus = 'completed';
  }
  await Promise.all([session.save(), room.save()]);
  return { room, session, currentTurn: session.currentTurn };
}

/**
 * Compute the announcement text shown in the transition popup.
 * These messages follow the Debate Lifecycle in the rule docs:
 *   - Host+HumanJudge §14
 *   - Host+AIJudge §15
 *   - NoHost+AIJudge §13
 *   - NoHost+HumanJudge §15
 */
function computeTransitionAnnouncement(
  currentStep: DebateStep,
  nextStep: DebateStep,
  _format: '1v1' | '3v3',
): string {
  const { speaker: curr } = currentStep;
  const { speaker: next, phase: nextPhase } = nextStep;

  // OPP_S3 -> JUDGES_FB_3: "End of Round 3" per rule (all 4 docs)
  if (curr === 'OPP_S3' && nextPhase === 'judge_feedback') {
    return 'End of Round 3';
  }

  // PRO_S3 -> OPP_S3: opposition's final summary starts.
  if (curr === 'PRO_S3' && next === 'OPP_S3') {
    return 'Opposition turn';
  }

  // (Engine không còn phase `final_judging` — verdict xảy ra trong JUDGE_FEEDBACK_3,
  //  chuyển thẳng sang COMPLETED. Không còn 'AI Verdict' / 'Final Verdict' riêng.)

  // After speech, before CE (R1 or R2)
  if (curr.startsWith('OPP_S') && next.startsWith('CE_')) {
    return 'Get ready for cross-examination';
  }

  // After CE -> Free time / Judge feedback (rule: "End of Round N")
  if (curr.startsWith('CE_') && (next.startsWith('JUDGES_FB') || nextPhase === 'judge_feedback')) {
    const roundNum = curr.split('_')[1]?.toLowerCase();
    return `End of Round ${roundNum?.replace('round', '')}`;
  }

  // After Judge Feedback -> Next round start (PRO or OPP)
  if (curr.startsWith('JUDGES_FB') && (next.startsWith('PRO_') || next.startsWith('OPP_'))) {
    return 'Next round starting';
  }

  // After prep -> First speech
  if (curr === 'BOTH_TEAMS_PREP') {
    return 'Get ready to speak';
  }

  // After motion announcement -> prep
  if (curr === 'HOST') {
    return 'Preparation starts';
  }

  return 'Phase transition';
}

export async function triggerTransition(
  roomId: string,
  _transcript = '',
  _options?: { isJudgeFeedback?: boolean },
) {
  const { getIO } = await import('../../socket/index.js');
  const { timerService } = await import('../../socket/timer.service.js');
  const { ceTimerService } = await import('../../socket/ce.socket.js');
  const io = getIO();

  // Clear prep consensus for this room to avoid stale states
  const { prepConsensus } = await import('../../socket/debate.socket.js');
  prepConsensus.delete(roomId);

  // ── Step 1: stop the running timer FIRST so no more `debate:timer-update`
  // broadcasts land on the clients during the popup. Without this, a tick
  // already in flight may keep the displayed timer one second too long.
  timerService.stop(roomId);
  ceTimerService.stop(roomId);

  const room = await DebateRoom.findById(roomId);
  if (!room) return;

  const isNoHost = room.hostType !== 'human';
  const isAIJudge = room.judgeType === 'ai';

  // ── Step 2: freeze the session timer in DB + broadcast timeRemaining: 0
  // BEFORE emitting transition-start. This guarantees every client receives
  // "00:00" simultaneously with the popup so the user never sees a delay
  // between the popup appearing and the timer stopping. Matches the rule:
  //   "Timer reset to 00:00" happens at the START of the transition popup.
  try {
    const preSession = await DebateSession.findOne({ roomId: room._id });
    if (preSession && preSession.currentTurn) {
      preSession.currentTurn.timeRemaining = 0;
      preSession.currentTurn.phaseStatus = 'transition';
      if (typeof (preSession.currentTurn as any).status === 'string') {
        (preSession.currentTurn as any).status = 'transition';
      }
      await preSession.save();
      io?.to(roomId).emit('debate:timer-update', {
        timeRemaining: 0,
        totalTime: preSession.currentTurn.timeLimit,
        phaseStatus: 'transition',
        frozen: true,
      });
    }
  } catch (err) {
    // Fail-open: even if the freeze + emit fails, still emit the popup so
    // users see a consistent transition-state UI.
    console.error('Failed to freeze timer on transition-start:', err);
    io?.to(roomId).emit('debate:timer-update', {
      timeRemaining: 0,
      phaseStatus: 'transition',
      frozen: true,
    });
  }

  // Pre-compute the announcement so the popup can be shown immediately at
  // t=0 with the correct text (matching the rule: "Mute + Lock Chat (3s) —
  // popup: <announcement>"). Without this, the popup only appears after the
  // 3s mute, which is the opposite of the documented UX.
  let preAnnouncement = '';
  try {
    const preSession = await DebateSession.findOne({ roomId: room._id });
    if (preSession) {
      const preFormat = (room.format as '1v1' | '3v3') || '3v3';
      const preFlow = getFlow(preFormat, (room.hostType as 'human' | 'ai') || undefined);
      const preIdx = getStepIndex(preFlow, preSession.currentTurn.speaker, preSession.currentTurn.phase);
      if (preIdx !== -1) {
        const next = preFlow[Math.min(preIdx + 1, preFlow.length - 1)];
        preAnnouncement = computeTransitionAnnouncement(preFlow[preIdx], next, preFormat);
      }
    }
  } catch (err) {
    console.error('Pre-announcement compute error:', err);
  }

  // ── Step 3: emit the transition popup. This is what turns the popup on for
  // every client at the same instant as the timer-update(0) above, so they
  // appear as a single synchronized event.
  const isAutoAdvance = isNoHost && isAIJudge;
  io?.to(roomId).emit('debate:transition-start', {
    duration: isAutoAdvance
      ? TRANSITION_MUTE_SECONDS + AUTO_TRANSITION_COUNTDOWN
      : TRANSITION_MUTE_SECONDS,
    isAuto: isAutoAdvance,
    announcement: preAnnouncement,
    waitingForHost: !isAutoAdvance,
  });
  io?.to(roomId).emit('debate:mute-lock', { reason: 'transition' });

  setTimeout(async () => {
    try {
      const updatedRoom = await DebateRoom.findById(roomId);
      if (!updatedRoom) return;
      const session = await DebateSession.findOne({ roomId: updatedRoom._id });
      if (!session) return;

      const format = (updatedRoom.format as '1v1' | '3v3') || '3v3';
      const flow = getFlow(format, (updatedRoom.hostType as 'human' | 'ai') || undefined);
      const currentIndex = getStepIndex(flow, session.currentTurn.speaker, session.currentTurn.phase);
      const nextStep = flow[Math.min(currentIndex + 1, flow.length - 1)];

      // === Handle WAITING_S1_START → motion (both S1 pressed Start) ===
      if (session.currentTurn.phase === 'waiting_s1') {
        applyStep(session, nextStep);
        updatedRoom.currentPhase = nextStep.phase;
        await session.save();
        await updatedRoom.save();

        io?.to(roomId).emit('debate:phase-change', {
          phase: 'motion',
          phaseStatus: 'active',
          speaker: 'HOST',
          announcement: 'Preparation starts',
        });
        io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

        const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
        const state = await buildRoomStatePayload(
          roomId,
          updatedRoom.hostId ? updatedRoom.hostId.toString() : updatedRoom.createdBy.toString(),
        );
        if (state) io?.to(roomId).emit('room:state-restore', state);

        // Auto-start prep_7 after brief motion announcement
        setTimeout(async () => {
          const roomAfter = await DebateRoom.findById(roomId);
          const sessionAfter = await DebateSession.findOne({ roomId });
          if (!roomAfter || !sessionAfter) return;
          const turn = sessionAfter.currentTurn as any;
          turn.phaseStatus = 'active';
          turn.status = 'active';
          turn.startTime = new Date();
          turn.timeRemaining = turn.timeLimit || 0;
          await sessionAfter.save();
          io?.to(roomId).emit('debate:phase-change', {
            phase: 'prep_7',
            phaseStatus: 'active',
            speaker: 'BOTH_TEAMS_PREP',
          });
          io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });
          timerService.start(roomId, turn.timeLimit, 'prep_7', () => {
            triggerTransition(roomId).catch(console.error);
          });
        }, 1000);
        return;
      }

      const currentStep = flow[currentIndex];
      const announcement = computeTransitionAnnouncement(currentStep, nextStep, format);

      // === Handle COMPLETED phase ===
      if (nextStep.phase === 'completed') {
        if (isNoHost) {
          // Auto-end the debate for no-host rooms
          (session.currentTurn as any).status = 'completed';
          (session.currentTurn as any).phase = 'completed';
          (session.currentTurn as any).phaseStatus = 'completed';
          updatedRoom.status = 'completed';
          updatedRoom.currentPhase = 'completed';
          updatedRoom.endedAt = new Date();
          const aggregate = aggregateFinalScores(session, updatedRoom);
          session.finalScores = {
            ...(session.finalScores || {}),
            ...aggregate,
            resultSource: 'judging',
          } as any;
          session.markModified('finalScores');
          await Promise.all([session.save(), updatedRoom.save()]);

          if (updatedRoom.judgeType === 'ai') {
            try {
              await generateFinalDebateAnalysis(roomId);
            } catch (error) {
              console.error('AI final debate analysis failed during auto-complete:', error);
            }
          }

          const completedSession = await DebateSession.findOne({ roomId: updatedRoom._id });
          io?.to(roomId).emit('debate:ended', {
            roomId,
            isAuto: true,
            result: {
              winner: (completedSession?.finalScores as any)?.winner || null,
              finalScores: completedSession?.finalScores || null,
            },
          });
          io?.emit('debate:ended', { roomId, isAuto: true });
          io?.emit('room:update', { action: 'completed', roomId });
          await applyDebateResult(roomId);
        } else {
          // Human host: stay idle, waiting for host to click End
          (session.currentTurn as any).status = 'waiting_to_start';
          (session.currentTurn as any).phaseStatus = 'idle';
          await Promise.all([session.save(), updatedRoom.save()]);
          io?.to(roomId).emit('debate:match-ready-to-end', { announcement, speaker: nextStep.speaker, phase: nextStep.phase });
          io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'idle', phaseStatus: 'idle' });
          const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
          const state = await buildRoomStatePayload(roomId, updatedRoom.hostId ? updatedRoom.hostId.toString() : updatedRoom.createdBy.toString());
          if (state) io?.to(roomId).emit('room:state-restore', state);
        }
        return;
      }

      // === Handle JUDGE_FEEDBACK phase ===
      if (nextStep.phase === 'judge_feedback') {
        // Unlock mic for all debaters + judges (free time)
        await unlockAllParticipantsMic(updatedRoom);

        // Snapshot current turn history with the old phase, then advance to
        // judge_feedback as 'active' (free time, no timer).
        // The phase stays 'active' until the Control Panel holder (Host or
        // Judge S1, depending on mode) explicitly ends the phase via Skip.
        // Per the rule docs the judge may submit scores during this phase,
        // but ending it is always gated on Skip, not on the Start button.
        snapshotCurrentTurn(session, '');
        applyStep(session, nextStep);
        session.currentTurn.phaseStatus = 'active';
        session.currentTurn.status = 'active';
        updatedRoom.currentPhase = nextStep.phase;
        await session.save();
        await updatedRoom.save();

        io?.to(roomId).emit('debate:phase-change', {
          phase: 'judge_feedback',
          phaseStatus: 'active',
          speaker: nextStep.speaker,
          announcement,
          waitingForJudge: true,
          waitingForControllerSkip: !isAIJudge,
        });
        io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

        if (isAIJudge) {
          // No-Host + AI Judge: this is the Mode 4 / Rank Queue path. The
          // AI is the judge, so once it submits the per-round score the
          // debate auto-transitions with no user action required.
          // Per the rule: "AI Judge submits score → Judge Feedback ends
          // immediately → Transition Phase starts immediately."
          const humanJudgeCount = updatedRoom.participants.filter((p: any) => {
            const r = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
            return r === 'judge';
          }).length;

          if (humanJudgeCount === 0 || nextStep.speaker === 'JUDGES_FB_3') {
            // JUDGES_FB_3: AI already generated feedback for R3 speeches in the
            // previous OPP_S3→PRO_S3 transition. Auto-advance to COMPLETED
            // (không còn FINAL_JUDGING phase riêng) sau 3s.
            console.log(`[triggerTransition] Auto-advancing from ${nextStep.speaker} (AI judge, no human judges or R3 FB)`);
            setTimeout(async () => {
              triggerTransition(roomId).catch(console.error);
            }, 3000);
            return;
          }

          // AI judge: generate feedback, auto-advance after a short delay so
          // participants can read the feedback before transition.
          (async () => {
            const feedbackShown = await generateAIFeedback(roomId, nextStep.speaker);
            if (!feedbackShown) {
              console.warn('AI feedback not available within timeout, advancing anyway');
            }
            io?.to(roomId).emit('debate:ai-feedback-received', {});
            setTimeout(async () => {
              triggerTransition(roomId).catch(console.error);
            }, 5000);
          })();
        } else {
          // Human judge: wait for judge scores.
          // - For host_human_*: nếu là JUDGE_FEEDBACK_3 (sau Round 3), Host phải
          //   bấm End để kết thúc — KHÔNG tự advance. Đợi Host End tối đa 5 phút,
          //   hết 5 phút → auto-complete.
          // - Các case khác (host_ai_*, noHost_*): Host/Judge S1 bấm Skip như cũ.
          const isHostHuman =
            updatedRoom.hostType === 'human' && updatedRoom.judgeType !== 'ai';
          const isJudgesFb3 = nextStep.speaker === 'JUDGES_FB_3';

          if (isHostHuman && isJudgesFb3) {
            // host_human_*: JUDGE_FEEDBACK_3 → AWAITING_HOST_END (chờ Host End 5p)
            io?.to(roomId).emit('debate:awaiting-host-end', {
              phase: 'judge_feedback',
              speaker: nextStep.speaker,
              hostEndCountdownSec: HOST_END_COUNTDOWN_SECONDS,
              announcement: 'Host can now end the debate',
            });

            // Schedule auto-complete sau 5 phút nếu Host không End
            setTimeout(async () => {
              try {
                const freshRoom = await DebateRoom.findById(roomId);
                const freshSession = await DebateSession.findOne({ roomId: freshRoom?._id });
                if (!freshRoom || !freshSession) return;
                // Chỉ auto-complete nếu vẫn còn ở JUDGE_FEEDBACK_3
                if (
                  freshSession.currentTurn.speaker !== 'JUDGES_FB_3' ||
                  freshSession.currentTurn.phase !== 'judge_feedback'
                ) {
                  return;
                }
                console.log(
                  `[triggerTransition] host_human_* auto-completing after ${HOST_END_COUNTDOWN_SECONDS}s (Host did not End)`,
                );
                await endDebateByHost(roomId, 'system', 'Host did not End within 5 minutes');
              } catch (err) {
                console.error('Auto-complete on Host timeout error:', err);
              }
            }, HOST_END_COUNTDOWN_SECONDS * 1000);
            return;
          }

          // Human judge (host_ai_*, noHost_*): wait for judge scores. The phase
          // only ends when the Control Panel holder (Host or Judge S1 in no-host
          // mode) clicks Skip. Submitting scores is not enough on its own.
          io?.to(roomId).emit('debate:waiting-judge-feedback', {
            phase: 'judge_feedback',
            waitingForVotes: true,
          });
        }
        return;
      }

      // === Human Host + No-Host+Human-Judge (Judge S1 controls): stay idle, wait for Start ===
      // The 3s mute popup was already emitted at t=0. After the 3s mute we
      // broadcast the phase-change to idle so the host / Judge S1 can click Start.
      // NOTE: for NH+AI (auto-advance), this branch is skipped — the system
      // handles the auto-transition further down in this function.
      if (!isAutoAdvance) {
        // Unlock mic for all debaters + judges (free time during waiting_to_start)
        await unlockAllParticipantsMic(updatedRoom);

        // Advance the session step immediately so the DB reflects the new
        // phase + waiting_to_start status. The Host's "Start" click then
        // moves it to active with the proper timer.
        // Snapshot current turn history with the old phase, then apply the
        // next step as waiting_to_start so the Start endpoint can pick it up.
        snapshotCurrentTurn(session, '');
        applyStep(session, nextStep);
        updatedRoom.currentPhase = nextStep.phase;
        await session.save();
        await updatedRoom.save();

        setTimeout(async () => {
          try {
            io?.to(roomId).emit('debate:phase-change', {
              phase: nextStep.phase,
              phaseStatus: 'idle',
              speaker: nextStep.speaker,
              announcement,
              waitingForHost: true,
            });
            io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'waiting_to_start', phaseStatus: 'idle' });
            const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
            const state = await buildRoomStatePayload(
              roomId,
              updatedRoom.hostId ? updatedRoom.hostId.toString() : updatedRoom.createdBy.toString(),
            );
            if (state) io?.to(roomId).emit('room:state-restore', state);
          } catch (err) {
            console.error('Human host / NH+HJ transition error:', err);
          }
        }, TRANSITION_MUTE_SECONDS * 1000);
        return;
      }

      // === No-Host + AI Judge: auto-start after 10s countdown ===
      // Note: the 3s mute popup was already emitted at t=0. After the 10s
      // countdown (10s after the 3s mute, so 13s total) we activate the next
      // phase and clear the popup via phase-change.
      io?.to(roomId).emit('debate:mute-lock', { reason: 'transition' });

      // Snapshot + advance session to the next step so the DB matches the
      // upcoming active phase once the 10s countdown completes.
      snapshotCurrentTurn(session, '');
      applyStep(session, nextStep);
      updatedRoom.currentPhase = nextStep.phase;
      await session.save();
      await updatedRoom.save();

      setTimeout(async () => {
        try {
          const freshRoom = await DebateRoom.findById(roomId);
          if (!freshRoom) return;
          const freshSession = await DebateSession.findOne({ roomId: freshRoom._id });
          if (!freshSession) return;

          const turn = freshSession.currentTurn as any;
          turn.phaseStatus = 'active';
          turn.status = 'active';
          turn.startTime = new Date();
          turn.timeRemaining = turn.timeLimit || 0;
          await freshSession.save();

          io?.to(roomId).emit('debate:phase-change', {
            phase: turn.phase,
            phaseStatus: 'active',
            speaker: turn.speaker,
            turnStatus: 'active',
          });
          io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

          if (turn.phase === 'cross_exam') {
            const { initCEForRoom, startCEForRoom } = await import('../../socket/ce.socket.js');
            initCEForRoom(roomId);
            startCEForRoom(roomId);
          } else if (turn.timeLimit > 0) {
            timerService.start(roomId, turn.timeLimit, turn.phase, () => {
              triggerTransition(roomId).catch(console.error);
            });
          }

          const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
          const state = await buildRoomStatePayload(
            roomId,
            freshRoom.hostId ? freshRoom.hostId.toString() : freshRoom.createdBy.toString(),
          );
          if (state) io?.to(roomId).emit('room:state-restore', state);
        } catch (err) {
          console.error('No-host auto transition error:', err);
        }
      }, AUTO_TRANSITION_COUNTDOWN * 1000);
    } catch (err) {
      console.error('Error in transition timeout:', err);
    }
  }, TRANSITION_MUTE_SECONDS * 1000);
}

/**
 * Generate AI feedback during judge feedback phases.
 * Called after entering a judge_feedback phase in AI judge mode.
 * Returns true when feedback was generated successfully, false on error
 * or timeout. The caller uses the return value to decide whether to wait
 * for feedback before starting the 10s transition countdown.
 */
async function generateAIFeedback(roomId: string, speaker: string): Promise<boolean> {
  try {
    const { getIO } = await import('../../socket/index.js');
    const { aiService } = await import('../ai/ai.service.js');
    const session = await DebateSession.findOne({ roomId });
    if (!session) return false;

    const history = session.turnHistory || [];

    // JUDGES_FB_X maps to a specific round number; judge both speakers of that round.
    // JE_FB_1 -> round 1: PRO_S1 + OPP_S1
    // JUDGES_FB_2 -> round 2: PRO_S2 + OPP_S2
    // JUDGES_FB_3 -> round 3: PRO_S3 + OPP_S3
    const match = speaker.match(/^JUDGES_FB_(\d+)$/i);
    const roundNum = match ? parseInt(match[1], 10) : null;

    let speakersToJudge: string[] = [];

    if (roundNum !== null) {
      // Determine which speakers belong to this round.
      // In 1v1 flow: each round has unique single speakers (PRO_S1, OPP_S1, PRO_S2, OPP_S2, PRO_S3, OPP_S3).
      // In 3v3 flow: each round has team-prefixed speakers (PRO_S1, OPP_S1, PRO_S2, OPP_S2, PRO_S3, OPP_S3).
      // Map round → speaker suffixes that belong to that round.
      const roundSlotSuffixes: Record<number, string[]> = {
        1: ['S1'],   // PRO_S1, OPP_S1
        2: ['S2'],   // PRO_S2, OPP_S2
        3: ['S3'],   // PRO_S3, OPP_S3
      };
      const slotSuffixes = roundSlotSuffixes[roundNum] || [];
      if (slotSuffixes.length > 0) {
        speakersToJudge = history
          .filter((t: any) => {
            const tSpeaker = String(t.speaker || '').toUpperCase();
            // Must match the exact round suffix AND be a PRO_ or OPP_ speaker
            return slotSuffixes.some((suffix) => {
              return tSpeaker === `PRO_${suffix}` || tSpeaker === `OPP_${suffix}`;
            });
          })
          .map((t: any) => t.speaker);
      }
    }

    // Fallback: if round cannot be determined, judge the most recent speech
    if (speakersToJudge.length === 0) {
      const lastEntry = history[history.length - 1];
      if (lastEntry?.transcript) {
        speakersToJudge = [lastEntry.speaker];
      }
    }

    // Deduplicate while preserving order (latest occurrences first)
    const seen = new Set<string>();
    const uniqueSpeakers: string[] = [];
    for (const sp of [...speakersToJudge].reverse()) {
      if (!seen.has(sp)) {
        seen.add(sp);
        uniqueSpeakers.unshift(sp);
      }
    }

    const room = await DebateRoom.findById(roomId);
    const io = getIO();

    for (const sp of uniqueSpeakers) {
      const speechEntry = history.filter((t: any) => t.speaker === sp).pop();
      if (!speechEntry?.transcript) continue;

      try {
        const result = await aiService.judgeTurn(roomId, sp, speechEntry.transcript, {
          motion: room?.motion,
          turnHistory: history.slice(-5),
        });

        io?.to(roomId).emit('debate:ai-feedback', {
          speaker: sp,
          feedback: result,
        });
      } catch (err) {
        console.error(`AI feedback error for speaker ${sp}:`, err);
      }
    }

    return uniqueSpeakers.length > 0;
  } catch (err) {
    console.error('AI feedback generation error:', err);
    return false;
  }
}

/**
 * Unlock mic for all participants during free-time phases
 * (judge_feedback, completed, waiting_s1).
 * Used so debaters/judges can freely discuss and judges can chat in free time.
 */
async function unlockAllParticipantsMic(room: any) {
  if (!room) return;
  for (const p of room.participants) {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    if (role === 'debater' || role === 'judge') {
      p.speakingAllowed = true;
      p.muted = false;
    }
  }
  await room.save();
}

/**
 * Compute AI feedback during judge feedback phases.
 * Called after entering a judge_feedback phase in AI judge mode.
 * Returns true when feedback was generated successfully, false on error
 * or timeout. The caller uses the return value to decide whether to wait
 * for feedback before starting the 10s transition countdown.
 *
 * Lưu ý: Phase `final_judging` đã bỏ — AI Judge giờ verdict inline trong
 * JUDGE_FEEDBACK_3, không cần helper riêng cho AI final verdict.
 */

export async function finishPhase(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  const participant = room.participants.find((p: any) => p.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('You are not in this room');
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

  if (room.hostType !== 'human' && room.judgeType === 'ai') {
    // No-host + AI judge: debater skip (speaker ends speech), auto-trigger transition
    return endPhaseBySpeaker(roomId, userId, transcript);
  }

  if (room.hostType !== 'human' && room.judgeType !== 'ai') {
    // No-host + Human judge: Judge S1 can end phases (acts as host)
    const isJudgeS1 = effectiveRole === 'judge' && hasControlPanel(room, userId);
    if (isJudgeS1) {
      return endPhaseByHost(roomId, userId, transcript);
    }
    return endPhaseBySpeaker(roomId, userId, transcript);
  }

  if (effectiveRole === 'host') {
    return endPhaseByHost(roomId, userId, transcript);
  } else {
    return endPhaseBySpeaker(roomId, userId, transcript);
  }
}

export async function passCeTurn(roomId: string, userId: string, content = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  const participant = room.participants.find((item: any) => item.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('Only room participants can pass CE turn');
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (turn.phase !== 'cross_exam') throw new BadRequestError('Current phase is not cross-exam');
  if (turn.phaseStatus !== 'active') throw new BadRequestError('Cross-examination is not active');
  if (!participant.team) throw new ForbiddenError('Participant must be on a team');

  // Record the pass — quota is tracked in ceTimerService on the server side
  const ceState = turn.ceState || {};
  const teamKey = participant.team === 'proposition' ? 'questionsPro' : 'questionsOpp';
  ceState[teamKey] = (ceState[teamKey] || 0) + 1;
  turn.ceState = ceState;
  turn.ceState.transcript = ceState.transcript || [];
  turn.ceState.transcript.push({ team: participant.team, type: 'pass', content, timestamp: new Date() });

  // In the new model, CE ends when both teams exhaust quota (tracked in CE timer service)
  // This function is a fallback for manual pass-through
  await session.save();
  return { room, session, currentTurn: session.currentTurn };
}

export async function finishCe(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  const participant = room.participants.find((item: any) => item.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('Only room participants can finish CE');
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (turn?.phase !== 'cross_exam') throw new BadRequestError('Current phase is not cross-exam');
  if (turn?.phaseStatus !== 'active') throw new BadRequestError('Cross-examination is not active');
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  const isController = participant.roomRole === 'owner' || effectiveRole === 'host';
  const isAskingTeam = participant.team === turn?.ceState?.askingTeam;
  if (!isController && !isAskingTeam) {
    throw new ForbiddenError('Only the asking team or host can finish CE');
  }
  // Pass the ACTUAL caller userId, not the room creator — critical for No-Host+JudgeHuman
  // where Judge S1 (not creator) ends CE and must be the one who ends phase.
  return endPhaseByHost(roomId, userId, transcript);
}

async function completeDebateWithWinner(
  room: any,
  session: any,
  winner: 'proposition' | 'opposition' | 'draw',
  summary: string,
  resultSource: 'surrender' | 'agreed_draw' | 'forfeit',
) {
  session.finalScores = {
    ...(session.finalScores || {}),
    teamProposition: { total: winner === 'proposition' ? 100 : winner === 'draw' ? 50 : 0, breakdown: {} },
    teamOpposition: { total: winner === 'opposition' ? 100 : winner === 'draw' ? 50 : 0, breakdown: {} },
    winner,
    winnerTeam: winner,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: (session.finalScores as any)?.judgeVerdicts || [],
    resultSource,
  };
  session.aiSummary = summary;
  (session.currentTurn as any).status = 'completed';
  (session.currentTurn as any).phase = 'completed';
  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();
  await Promise.all([session.save(), room.save()]);
  await applyDebateResult(room._id.toString());

  // Broadcast debate ended
  const { getIO } = await import('../../socket/index.js');
  const io = getIO();
  io?.to(room._id.toString()).emit('debate:ended', { roomId: room._id.toString() });
  io?.emit('debate:ended', { roomId: room._id.toString() });
  io?.emit('room:update', { action: 'completed', roomId: room._id.toString() });

  return { room, session };
}

export async function endDebate(roomId: string, userId: string, summary = ''): Promise<any> {
  return endDebateInternal(roomId, userId, summary, { requireHost: true });
}

/**
 * Host bấm End để kết thúc trận từ JUDGE_FEEDBACK_3 (host_human_* path).
 * Hoặc hệ thống tự gọi sau 5 phút countdown (userId='system').
 *
 * - Host: assertHost(room, userId) — phải là Host mới được End.
 * - 'system': bỏ qua permission check (auto-complete sau countdown).
 */
export async function endDebateByHost(roomId: string, userId: string, summary = ''): Promise<any> {
  return endDebateInternal(roomId, userId, summary, { requireHost: false });
}

async function endDebateInternal(
  roomId: string,
  userId: string,
  summary: string,
  options: { requireHost: boolean },
): Promise<any> {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  if (userId !== 'system') {
    if (room.hostType === 'human') {
      if (options.requireHost) {
        assertHost(room, userId);
      } else {
        // endDebateByHost: chỉ cần Host role, không yêu cầu room ownership
        const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
        const effectiveRole = participant
          ? participant.roomRole === 'owner'
            ? participant.primaryRole
            : participant.roomRole
          : null;
        if (effectiveRole !== 'host') {
          throw new ForbiddenError('Only the host can end the debate');
        }
      }
    } else {
      // No-host rooms: only Judge S1 can end the debate
      const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
      const effectiveRole = participant
        ? participant.roomRole === 'owner'
          ? participant.primaryRole
          : participant.roomRole
        : null;
      const isJudgeS1 =
        participant && effectiveRole === 'judge' && hasControlPanel(room, userId);
      if (!isJudgeS1) {
        throw new ForbiddenError('Only Judge S1 can end the debate');
      }
    }
  }

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');

  const { getIO } = await import('../../socket/index.js');
  const io = getIO();

  const verdicts = (session.finalScores as any)?.judgeVerdicts || [];
  // Use the same authoritative aggregator that the score-submission endpoint
  // uses, so End Match and auto-complete produce identical results. The
  // legacy `aggregateScores` helper predates per-round scoring and silently
  // ignores the "5 items × 20 points" scale documented in ruleScore.md.
  const aggregate = aggregateFinalScores(session, room);
  session.finalScores = {
    ...(session.finalScores || {}),
    ...aggregate,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: verdicts,
    resultSource: 'judging',
  };
  session.markModified('finalScores');
  session.aiSummary = summary || session.aiSummary;
  (session.currentTurn as any).status = 'completed';
  (session.currentTurn as any).phase = 'completed';
  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();
  await Promise.all([session.save(), room.save()]);

  let completedSession = session;
  if (room.judgeType === 'ai') {
    try {
      await generateFinalDebateAnalysis(roomId);
      completedSession = await DebateSession.findOne({ roomId: room._id }) || session;
    } catch (error) {
      console.error('AI final debate analysis failed while ending debate:', error);
    }
  }

  // Broadcast debate ended BEFORE applying ranking (so frontend can redirect)
  io?.to(roomId).emit('debate:ended', {
    roomId,
    result: {
      winner: (completedSession.finalScores as any)?.winner || aggregate.winner,
      finalScores: completedSession.finalScores || aggregate,
    },
  });
  io?.emit('debate:ended', { roomId });
  io?.emit('room:update', { action: 'completed', roomId });

  const ranking = await applyDebateResult(roomId);
  return { room, session: completedSession, ranking };
}

function getDebaterOrThrow(room: any, userId: string) {
  const participant = room.participants.find((item: any) => {
    if (item.userId.toString() !== userId) return false;
    const role = item.roomRole === 'owner' ? item.primaryRole : item.roomRole;
    return role === 'debater';
  });
  if (!participant || !participant.team) throw new ForbiddenError('Only assigned debaters can use this action');
  return participant;
}

function assertDebateInProgress(room: any) {
  if (!['active', 'paused'].includes(room.status)) {
    throw new BadRequestError('Debate is not in progress');
  }
}

export async function surrenderDebate(roomId: string, userId: string): Promise<any> {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  assertDebateInProgress(room);
  const participant = getDebaterOrThrow(room, userId);
  const winner = participant.team === 'proposition' ? 'opposition' : 'proposition';
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  return completeDebateWithWinner(
    room,
    session,
    winner,
    `${participant.username} surrendered. ${winner} wins.`,
    'surrender',
  );
}

export async function requestDraw(roomId: string, userId: string): Promise<any> {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  assertDebateInProgress(room);
  const participant = getDebaterOrThrow(room, userId);
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const finalScores = (session.finalScores || {
    teamProposition: { total: 0, breakdown: {} }, teamOpposition: { total: 0, breakdown: {} },
    winner: null, winnerTeam: null, aiVerdict: null, judgeVerdicts: [],
  }) as any;
  const drawRequests: any[] = Array.isArray(finalScores.drawRequests) ? finalScores.drawRequests : [];
  const oppositeRequest = drawRequests.find((r: any) => r.status === 'pending' && r.team !== participant.team);
  if (oppositeRequest) {
    oppositeRequest.status = 'accepted';
    oppositeRequest.acceptedBy = participant.userId;
    oppositeRequest.acceptedAt = new Date();
    session.finalScores = finalScores;
    return completeDebateWithWinner(
      room,
      session,
      'draw',
      'Both teams agreed to a draw.',
      'agreed_draw',
    );
  }
  const existingRequest = drawRequests.find((r: any) => r.status === 'pending' && r.team === participant.team);
  if (!existingRequest) {
    drawRequests.push({ requestedBy: participant.userId, requestedByName: participant.username, team: participant.team, status: 'pending', requestedAt: new Date() });
  }
  finalScores.drawRequests = drawRequests;
  session.finalScores = finalScores;
  await session.save();
  return { room, session, currentTurn: session.currentTurn };
}

export { completeDebateWithWinner };

export async function advanceFromMotionToPrep(roomId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) return;
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session || session.currentTurn.status !== 'active') return;

  const phase = session.currentTurn.phase;
  if (phase !== 'motion') return;

  const { timerService } = await import('../../socket/timer.service.js');
  const { getIO } = await import('../../socket/index.js');
  const io = getIO();

  const format = (room.format as '1v1' | '3v3') || '3v3';
  const flow = getFlow(format, room.hostType as 'human' | 'ai');
  const currentIndex = flow.findIndex(
    (s) => s.speaker === session.currentTurn.speaker && s.phase === session.currentTurn.phase,
  );
  const prepStep = flow[Math.min(currentIndex + 1, flow.length - 1)];
  
  applyStep(session, prepStep);
  session.currentTurn.timeRemaining = prepStep.timeLimit || 0;
  session.currentTurn.startTime = new Date();
  await session.save();
  
  room.currentPhase = prepStep.phase;
  await room.save();

  timerService.start(roomId, prepStep.timeLimit || 0, prepStep.phase, () => {
    triggerTransition(roomId).catch(console.error);
  });

  if (io) {
    io.to(roomId).emit('debate:phase-change', {
      phase: prepStep.phase,
      phaseStatus: 'active',
      speaker: prepStep.speaker,
    });
    io.to(roomId).emit('debate:turn-status-change', {
      turnStatus: 'active',
      phaseStatus: 'active',
    });

    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(roomId, '');
    if (state) io.to(roomId).emit('room:state-restore', state);
  }
}

export async function autoStartDebateCountdown(roomId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) return;
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) return;

  session.currentTurn.status = 'active';
  session.currentTurn.phaseStatus = 'active';
  session.currentTurn.startTime = new Date();
  await session.save();

  const { getIO } = await import('../../socket/index.js');
  const io = getIO();
  if (io) {
    io.to(roomId).emit('debate:countdown-start', { durationMs: 3000 });
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(roomId, '');
    if (state) io.to(roomId).emit('room:state-restore', state);
  }

  setTimeout(() => {
    advanceFromMotionToPrep(roomId).catch(console.error);
  }, 3000);
}
