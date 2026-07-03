import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { aggregateFinalScores } from '../../utils/scoring.js';

const SPEECH_SECONDS = 3 * 60;
const CE_SECONDS = 2 * 60;
const PREP_SECONDS = 7 * 60;
const TRANSITION_MUTE_SECONDS = 3;
const AUTO_TRANSITION_COUNTDOWN = 10;

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
 * Human Host 3v3 Debate Flow — aligned with rule_host_judgeHuman.md §14:
 *
 * Round order: R1 (Prop→Opp→CE), R2 (Opp→Prop→CE), R3 (Opp→Prop, no CE)
 * Round 2: "(Same flow as Round 1)" → Pro→Opp, so S2 = Opp→Prop
 * Round 3: Opposition speaks FIRST (Opp→Prop), then "Finish Debate"
 * JUDGES_FB_3 step added so human judges can submit R3 scores before FINAL_JUDGING
 */
const DEBATE_FLOW_HOST_3V3: DebateStep[] = [
  // 0: Motion — host announces, then 3s countdown → prep
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 1: Prep — 7m auto / both teams skip / host skip
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: true },
  // 2: PROP1 speech (PRO_S1)
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 3: OPP1 speech (OPP_S1)
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 4: CE Round 1 — both teams can talk
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 5: Judge Feedback 1 — free, no timer, wait for scores
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 6: PROP2 speech (PRO_S2) — "(Same flow as Round 1)"
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 7: OPP2 speech (OPP_S2)
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 8: CE Round 2 — both teams can talk
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 9: Judge Feedback 2 — free, no timer
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 10: OPP3 speech (OPP_S3) — Rule: Opp speaks FIRST in Round 3
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 11: PROP3 speech (PRO_S3) — "Finish Debate" after this
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 12: Judge Feedback 3 — judges submit R3 scores (no CE in R3)
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 13: Final Judging — "Finish Debate" → host clicks End → match ends
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 14: Match complete — host must click End
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * Human Host 1v1 — rule_host_judgeHuman.md §14:
 * R1: PRO→OPP→CE, R2: OPP→PRO→CE, R3: OPP→PRO (no CE), JUDGES_FB_3, FINAL_JUDGING
 */
const DEBATE_FLOW_HOST_1V1: DebateStep[] = [
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: true },
  // Round 1: Prop → Opp → CE
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // Round 2: Opp → Prop → CE (per "Same flow as Round 1")
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // Round 3: Opp → Prop (no CE), JUDGES_FB_3, Final Judging
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * No-Host 3v3 (config: no host + human judge OR no host + AI judge).
 * rule_noHost_JudgeAI.md §13 and rule_noHost_JudgeHuman.md §15:
 *
 * R1: Prop→Opp→CE, R2: Prop→Opp→CE, R3: Opp→Prop (no CE)
 * R2: "(Same flow as Round 1)" → PRO_S2 first, OPP_S2 second
 * R3: Opposition FIRST (Opp→Prop) per rule: "[S3 Opposition] → [S3 Proposition]"
 * JUDGES_FB_3 added so human judges can submit R3 scores before FINAL_JUDGING
 *
 * Key differences from HOST flow:
 * - No waiting-for-host idle state; phases auto-advance (3s mute + 10s)
 * - CE starts automatically 10s after OPP speech ends
 * - Judge Feedback = free period + AI-generated feedback scores
 * - Match ends automatically after Final Judging (no host End needed)
 */
const DEBATE_FLOW_NOHost_3V3: DebateStep[] = [
  // 0: Waiting for S1 consensus — no timer, waiting for S1 from both teams
  { speaker: 'WAITING_S1_START', phase: 'waiting_s1', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // 1: Motion announcement
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // 2: Prep — 7m auto, both teams can skip
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: false },
  // Round 1: Prop → Opp → CE → Judge FB
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Round 2: "(Same flow as Round 1)" → PRO first, OPP second
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Round 3: Opp → Prop (no CE) — Opp FIRST per rule
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // Judge Feedback 3 (human judges submit R3 scores)
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Final Judging — auto score + redirect (no-host AI) or wait for score (no-host human)
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Match complete — auto-ended
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * No-Host 1v1 — rule_noHost_JudgeAI.md §13 and rule_noHost_JudgeHuman.md §15:
 * R1: Prop→Opp→CE, R2: Prop→Opp→CE, R3: Opp→Prop (no CE)
 * JUDGES_FB_3 added so human judges can submit R3 scores
 */
const DEBATE_FLOW_NOHost_1V1: DebateStep[] = [
  { speaker: 'WAITING_S1_START', phase: 'waiting_s1', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: false },
  // Round 1: Prop → Opp → CE
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Round 2: Prop → Opp → CE (per "Same flow as Round 1")
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Round 3: Opp → Prop (no CE) — Opp FIRST per rule
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // Judge Feedback 3 (human judges submit R3 scores)
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Final Judging
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // Complete
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

export function getFlow(format?: '1v1' | '3v3', hostType?: 'human' | 'ai'): DebateStep[] {
  if (!format || format === '3v3') {
    return hostType === 'ai' ? DEBATE_FLOW_NOHost_3V3 : DEBATE_FLOW_HOST_3V3;
  }
  return hostType === 'ai' ? DEBATE_FLOW_NOHost_1V1 : DEBATE_FLOW_HOST_1V1;
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
  const getEffectiveRole = (p: any) =>
    p?.roomRole === 'owner' ? p?.primaryRole : p?.roomRole;

  const is1v1 = room.format === '1v1';
  const debaterCount = is1v1 ? 2 : 6;
  const hasHost = room.hostType === 'human';
  const isAIJudge = room.judgeType === 'ai';
  const requiredJudges = isAIJudge ? 0 : (room.judgeCount || 1);

  const participants = (room.participants || []) as any[];
  let currentDebaters = 0;
  let currentHost = 0;
  let currentJudges = 0;
  const debatersWithoutPosition: string[] = [];

  participants.forEach((p) => {
    const role = getEffectiveRole(p);
    if (role === 'debater') {
      if (p.team && p.speakerSlot) {
        currentDebaters += 1;
      } else {
        debatersWithoutPosition.push(p.username || p.userId?.toString() || 'unknown');
      }
    } else if (role === 'host') {
      currentHost += 1;
    } else if (role === 'judge') {
      currentJudges += 1;
    }
  });

  const missingDebaters = Math.max(0, debaterCount - currentDebaters);
  const missingHost = hasHost ? Math.max(0, 1 - currentHost) : 0;
  const missingJudges = Math.max(0, requiredJudges - currentJudges);

  if (missingDebaters > 0 || missingHost > 0 || missingJudges > 0) {
    const reasons: string[] = [];
    if (missingDebaters > 0) reasons.push(`need ${missingDebaters} more debater(s) (${currentDebaters}/${debaterCount})`);
    if (missingHost > 0) reasons.push(`need a Host (${currentHost}/1)`);
    if (missingJudges > 0) reasons.push(`need ${missingJudges} more judge(s) (${currentJudges}/${requiredJudges})`);
    return {
      ready: false,
      reason: `Cannot start: ${reasons.join(', ')}.`,
      counts: { currentDebaters, currentHost, currentJudges, debaterCount, hasHost, requiredJudges },
    };
  }

  if (debatersWithoutPosition.length > 0) {
    return {
      ready: false,
      reason: `Debater(s) without team/slot: ${debatersWithoutPosition.join(', ')}`,
      counts: { currentDebaters, currentHost, currentJudges, debaterCount, hasHost, requiredJudges },
    };
  }

  return {
    ready: true,
    counts: { currentDebaters, currentHost, currentJudges, debaterCount, hasHost, requiredJudges },
  };
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

  let isAuthorized = false;

  if (!isNoHost) {
    // Host mode: owner or host can start
    const isOwner = room.createdBy.toString() === userId;
    isAuthorized = isOwner || effectiveRole === 'host';
  } else {
    // No-Host mode: owner bypass is NOT allowed per rule
    if (isAIJudge) {
      // No-Host + AI: only S1 debaters consensus starts the debate
      isAuthorized = effectiveRole === 'debater' && (participant as any).speakerSlot === 'S1';
    } else {
      // No-Host + Human Judge: only Judge S1 starts the debate
      isAuthorized = effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
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

  const session = new DebateSession({ roomId: room._id });
  const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);

  // No-host + AI judge: start at WAITING_S1_START step (index 0)
  // No-host + Human judge: Judge S1 already started, begin at motion step (index 1)
  // Human host: start at motion step (index 0)
  let startIdx = 0;
  if (isNoHost && isAIJudge) startIdx = 0;
  else if (isNoHost && !isAIJudge) startIdx = 1;
  else startIdx = 0;

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
      (participant as any).speakerSlot === 'S1';
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
      (participant as any).speakerSlot === 'S1';
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
  const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);
  const currentIndex = getStepIndex(flow, turn.speaker, turn.phase);
  if (currentIndex === -1) throw new BadRequestError('Current step not in flow');
  const currentStep = flow[currentIndex];
  
  const isNoHostHumanJudge = room.hostType !== 'human' && room.judgeType === 'human';
  if (!isNoHostHumanJudge && !currentStep.hostCanEnd) {
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
  const isJudgeS1 = room.hostType !== 'human' && effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
  const hasHostControl = effectiveRole === 'host' || isJudgeS1;

  if (participantSpeaker !== turn.speaker && !hasHostControl) {
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
      (participant as any).speakerSlot === 'S1';
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
  if (curr === 'OPP_S3' && (nextPhase === 'judge_feedback' || nextPhase === 'final_judging')) {
    return 'End of Round 3';
  }

  // PRO_S3 -> JUDGES_FB_3: "Proposition turn" (proposition's final summary starts)
  if (curr === 'PRO_S3' && nextPhase === 'judge_feedback') {
    return 'Proposition turn';
  }

  // After JUDGES_FB_3 (R3 feedback) -> FINAL_JUDGING: "AI Verdict" (all 4 docs)
  if (curr === 'JUDGES_FB_3' && nextPhase === 'final_judging') {
    return 'AI Verdict';
  }

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
          (session.currentTurn as any).phaseStatus = 'completed';
          updatedRoom.status = 'completed';
          updatedRoom.endedAt = new Date();
          await Promise.all([session.save(), updatedRoom.save()]);
          io?.to(roomId).emit('debate:ended', { roomId, isAuto: true });
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

      // === Handle FINAL_JUDGING phase ===
      if (nextStep.phase === 'final_judging') {
        // Unlock mic for all debaters + judges (free time)
        await unlockAllParticipantsMic(updatedRoom);

        // Snapshot current turn history, then advance the session step
        // to final_judging as 'active' (free time, no timer).
        snapshotCurrentTurn(session, '');
        applyStep(session, nextStep);
        session.currentTurn.phaseStatus = 'active';
        session.currentTurn.status = 'active';
        updatedRoom.currentPhase = nextStep.phase;
        await session.save();
        await updatedRoom.save();

        // Broadcast entering final judging
        io?.to(roomId).emit('debate:phase-change', {
          phase: 'final_judging',
          phaseStatus: 'active',
          speaker: nextStep.speaker,
          announcement: 'Finish Debate',
        });
        io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

        if (isNoHost) {
          // Auto: compute AI verdict + end debate
          setTimeout(async () => {
            try {
              const verdictResult = await computeAIFeedbackAndFinalize(roomId);
              io?.to(roomId).emit('debate:ended', { roomId, isAuto: true, verdict: verdictResult });
            } catch (err) {
              console.error('AI final verdict error:', err);
              io?.to(roomId).emit('debate:ended', { roomId, isAuto: true });
            }
          }, 10000); // 10s after "Finish Debate"
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
            // previous OPP_S3→PRO_S3 transition. Auto-advance to FINAL_JUDGING
            // after a short delay (no UI interaction needed).
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
          // Human judge: wait for judge scores. The phase only ends when the
          // Control Panel holder (Host or Judge S1 in no-host mode) clicks
          // Skip. Submitting scores is not enough on its own.
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
 * (judge_feedback, final_judging, completed, waiting_s1).
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
 * Compute AI final verdict and end the debate.
 * Called when entering final_judging phase in AI judge mode.
 */
async function computeAIFeedbackAndFinalize(roomId: string) {
  try {
    const { aiService } = await import('../ai/ai.service.js');
    const room = await DebateRoom.findById(roomId);
    const session = await DebateSession.findOne({ roomId });
    if (!room || !session) return null;

    // Generate AI final verdict
    const result = await aiService.finalVerdict(roomId, {
      turnHistory: session.turnHistory || [],
      motion: room.motion,
    });

    // Apply the result
    const verdict = result.winner as 'proposition' | 'opposition' | 'draw' || 'draw';
    const summary = result.summary || result.verdict || 'AI Judge Final Verdict';

    // Update session with AI verdict
    session.finalScores = {
      ...(session.finalScores || {}),
      teamProposition: { total: verdict === 'proposition' ? 100 : verdict === 'draw' ? 50 : 0, breakdown: {} },
      teamOpposition: { total: verdict === 'opposition' ? 100 : verdict === 'draw' ? 50 : 0, breakdown: {} },
      winner: verdict,
      winnerTeam: verdict,
      aiVerdict: verdict,
      judgeVerdicts: [],
    } as any;
    session.aiSummary = summary;
    room.status = 'completed';
    room.currentPhase = 'completed';
    room.endedAt = new Date();

    await Promise.all([session.save(), room.save()]);
    await applyDebateResult(roomId);

    return { winner: verdict, summary };
  } catch (err) {
    console.error('AI final verdict error:', err);
    return null;
  }
}

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
    const isJudgeS1 = effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
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

async function completeDebateWithWinner(room: any, session: any, winner: 'proposition' | 'opposition' | 'draw', summary: string) {
  session.finalScores = {
    ...(session.finalScores || {}),
    teamProposition: { total: winner === 'proposition' ? 100 : winner === 'draw' ? 50 : 0, breakdown: {} },
    teamOpposition: { total: winner === 'opposition' ? 100 : winner === 'draw' ? 50 : 0, breakdown: {} },
    winner,
    winnerTeam: winner,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: (session.finalScores as any)?.judgeVerdicts || [],
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
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  if (room.hostType === 'human') {
    assertHost(room, userId);
  } else {
    // No-host rooms: only Judge S1 can end the debate (debaters can surrender/request draw)
    const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
    const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
    const isJudgeS1 =
      participant &&
      effectiveRole === 'judge' &&
      (participant as any).speakerSlot === 'S1';
    if (!isJudgeS1) {
      throw new ForbiddenError('Only Judge S1 can end the debate');
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
  };
  session.markModified('finalScores');
  session.aiSummary = summary || session.aiSummary;
  (session.currentTurn as any).status = 'completed';
  (session.currentTurn as any).phase = 'completed';
  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();
  await Promise.all([session.save(), room.save()]);

  // Broadcast debate ended BEFORE applying ranking (so frontend can redirect)
  io?.to(roomId).emit('debate:ended', { roomId, result: { winner: aggregate.winner, finalScores: aggregate } });
  io?.emit('debate:ended', { roomId });
  io?.emit('room:update', { action: 'completed', roomId });

  const ranking = await applyDebateResult(roomId);
  return { room, session, ranking };
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
  return completeDebateWithWinner(room, session, winner, `${participant.username} surrendered. ${winner} wins.`);
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
    return completeDebateWithWinner(room, session, 'draw', 'Both teams agreed to a draw.');
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
