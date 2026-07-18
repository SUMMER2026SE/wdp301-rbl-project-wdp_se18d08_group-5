/**
 * matchStates.ts — TypeScript types & context cho Match State Machine.
 *
 * Match State Machine điều khiển vòng đời của 1 trận đấu, từ khi phòng được
 * tạo đến khi kết thúc hoàn toàn. Tham chiếu:
 * - docs/rule_host_judgeAI.md §15
 * - docs/rule_host_judgeHuman.md §14
 * - docs/rule_noHost_JudgeAI.md §13
 * - docs/rule_noHost_JudgeHuman.md §15
 * - docs/Debate_Rule_Consolidated.md §5-§7
 *
 * Thiết kế:
 * - ROOM_WAITING → STARTING → COUNTDOWN_3S → PREP_7MIN → (loop ROUND_SPEECH × 2,
 *   CROSS_EXAM, JUDGE_FEEDBACK) × 3 → COMPLETED.
 * - Mỗi phase có thể bị gián đoạn bởi TRANSITION (3s mute + lock chat).
 * - Trong MANUAL mode, phase sau TRANSITION dừng ở IDLE_BEFORE_NEXT chờ controller.
 * - Trong AUTO_TIMED mode, phase sau TRANSITION tự động chuyển sau 10s.
 */

import type { DebateModeConfig, Role, Team } from '../config/types';

/**
 * Lifecycle state của 1 phase. Cùng giá trị với phaseStatus trong DebateSession model.
 */
export type PhaseLifecycleStatus =
  | 'idle' // chờ controller bấm Start (chỉ MANUAL mode)
  | 'active' // phase đang chạy, timer đếm ngược
  | 'paused' // controller pause (chỉ host_* / noHost_human_*)
  | 'transition' // 3s mute giữa 2 phase
  | 'completed';

/**
 * Toàn bộ context của 1 match instance — lưu trong state machine.
 */
export interface MatchContext {
  /** Room ID — dùng để lock per-room và broadcast socket */
  roomId: string;
  /** Mode config (suy ra từ room settings) */
  mode: DebateModeConfig;
  /** Index hiện tại trong flow array — dùng cho replay/debug */
  currentStepIndex: number;
  /** Trạng thái của phase hiện tại */
  phaseStatus: PhaseLifecycleStatus;
  /** Server timestamp khi phase hiện tại bắt đầu */
  phaseStartedAt: number | null;
  /** Server timestamp khi phase hiện tại kết thúc (cho timer countdown đồng bộ) */
  phaseEndsAt: number | null;
  /** Khi pause, lưu thời điểm pause để tính resume */
  pausedAt: number | null;
  /** Pending draw requests — Map<team, {requestedBy, requestedAt}> */
  pendingDrawRequests: Map<Team, { requestedBy: string; requestedAt: number }>;
  /** Consensus skip votes cho Prep/CE trong noHost_ai_* */
  consensusSkipVotes: Set<string>;
  /** Start consensus votes cho noHost_ai_* — Set<userId> của Captain đã bấm Start */
  startConsensusVotes: Set<string>;
  /** Judge S1 disconnect (Open Point #2) */
  judgeS1Disconnected: boolean;
  /** Surrender đã trigger — lưu info để idempotent */
  surrendered: false | { team: Team; userId: string };
  /** Draw đã trigger — lưu info để idempotent */
  drawAccepted: false | { propositionUserId: string; oppositionUserId: string };
}

/**
 * Mọi event mà state machine có thể nhận.
 *
 * Lưu ý:
 * - actorRole là role derive từ participant (xem permissionMatrix.deriveRole).
 * - actorUserId là userId của participant thực hiện action.
 * - State machine dùng canPerform() để guard permission.
 */
export type MatchEvent =
  // ── Match start ──────────────────────────────────────────────
  | { type: 'START_MATCH'; actorRole: Role; actorUserId: string }
  | { type: 'S1_READY'; actorRole: 'captain_prop' | 'captain_opp'; actorUserId: string }
  // ── Phase điều khiển ────────────────────────────────────────
  | { type: 'CONTROLLER_START'; actorRole: Role; actorUserId: string }
  | { type: 'TIMER_EXPIRED' }
  | {
      type: 'SPEAKER_SKIP';
      actorRole: Role;
      actorUserId: string;
      speakerSlot: 'S1' | 'S2' | 'S3';
    }
  | { type: 'CONTROLLER_SKIP'; actorRole: Role; actorUserId: string }
  | { type: 'CONTROLLER_END'; actorRole: 'host'; actorUserId: string }
  | { type: 'CONSENSUS_SKIP'; actorRole: Role; actorUserId: string }
  // ── Judge ────────────────────────────────────────────────────
  | { type: 'JUDGE_SUBMIT_ALL'; actorRole: 'judge_s1' | 'judge'; actorUserId: string }
  | { type: 'AI_VERDICT_READY' }
  // ── Pause / Resume ───────────────────────────────────────────
  | { type: 'PAUSE'; actorRole: Role; actorUserId: string }
  | { type: 'RESUME'; actorRole: Role; actorUserId: string }
  // ── Surrender / Draw ─────────────────────────────────────────
  | { type: 'SURRENDER'; actorRole: Role; actorUserId: string }
  | { type: 'REQUEST_DRAW'; actorRole: Role; actorUserId: string }
  | { type: 'ACCEPT_DRAW'; actorRole: Role; actorUserId: string }
  // ── Judge S1 connection (Open Point #2) ──────────────────────
  | { type: 'JUDGE_S1_DISCONNECT'; userId: string }
  | { type: 'JUDGE_S1_RECONNECT'; userId: string };

/**
 * Initial context cho state machine.
 */
export function createInitialContext(mode: DebateModeConfig, roomId: string): MatchContext {
  return {
    roomId,
    mode,
    currentStepIndex: 0,
    phaseStatus: 'idle',
    phaseStartedAt: null,
    phaseEndsAt: null,
    pausedAt: null,
    pendingDrawRequests: new Map(),
    consensusSkipVotes: new Set(),
    startConsensusVotes: new Set(),
    judgeS1Disconnected: false,
    surrendered: false,
    drawAccepted: false,
  };
}