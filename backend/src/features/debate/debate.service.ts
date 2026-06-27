import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';

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
 * Human Host 3v3 Debate Flow (confirmed with user):
 *
 * Motion → 3s countdown → Prep (7m auto / skip) → IDLE
 * → Host Start → 3s countdown → PRO_S1 speech (3m / skip) → IDLE
 * → Host Start → 3s countdown → OPP_S1 speech (3m / skip) → IDLE
 * → Host Start → 3s countdown → CE Round 1 (2m / skip) → "End of Round 1" → IDLE
 * → Host Start → Judge Feedback (free / judge score) → IDLE
 * → Host Start → 3s countdown → PRO_S2 speech → IDLE
 * → Host Start → 3s countdown → OPP_S2 speech → IDLE
 * → Host Start → 3s countdown → CE Round 2 → "End of Round 2" → IDLE
 * → Host Start → Judge Feedback 2 → IDLE
 * → Host Start → 3s countdown → OPP_S3 speech (Round 3 closing) → IDLE
 * → Host Start → 3s countdown → PRO_S3 speech → "Finish Debate" → free → IDLE
 * → Host Start → 3s countdown → Final Judging → IDLE
 * → Host clicks End → Match ends
 *
 * Key differences from old flow:
 * - Motion has countdown (not auto-skip)
 * - Every phase transition goes to IDLE (waiting for host Start)
 * - CE: both teams can talk simultaneously
 * - Judge Feedback: no timer
 * - Round 3: OPP_S3 before PRO_S3
 * - Match ends only when host clicks End
 */
const DEBATE_FLOW_HOST_3V3: DebateStep[] = [
  // 0: Motion — host announces, then 3s countdown → prep
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 1: Prep — 7m auto / both teams skip / host skip
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: true },
  // 2: PRO_S1 speech
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 3: OPP_S1 speech
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 4: CE Round 1 — both teams can talk
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 5: Judge Feedback 1 — free, no timer, wait for scores
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 6: PRO_S2 speech
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 7: OPP_S2 speech
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 8: CE Round 2 — both teams can talk
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 9: Judge Feedback 2 — free, no timer
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 10: OPP_S3 — closing round starts with opposition
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 11: PRO_S3 — closing round ends with proposition
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  // 12: Final Judging — wait for host to click End
  { speaker: 'JUDGES', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  // 13: Match complete — room still active, host must click End
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * Human Host 1v1 — same structure but no S2/S3
 */
const DEBATE_FLOW_HOST_1V1: DebateStep[] = [
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: true,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: true },
  { speaker: 'JUDGES', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: true },
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * No-Host 3v3 (config: no host + human judge OR no host + AI judge).
 * Flow: 2 teams S1 both press Start → 3s → 7p prep → auto → speech cascade →
 * CE (10s auto-start) → free FB → AI scores → 10s → next round →
 * Round 3 (speech only, no CE) → Final → auto score + redirect.
 *
 * Key differences from HOST flow:
 * - No waiting-for-host idle state; phases auto-advance
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
  // 3: PRO_S1 speech
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 4: OPP_S1 speech
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 5: CE Round 1 — starts 10s after OPP_S1 ends
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 6: Judge Feedback 1 — free + AI scores
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // 7: PRO_S2 speech
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 8: OPP_S2 speech
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 9: CE Round 2 — starts 10s after OPP_S2 ends
  {
    speaker: 'CE_ROUND_2', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'opposition', answeringTeam: 'proposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  // 10: Judge Feedback 2 — free + AI scores
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // 11: OPP_S3 — closing round (no CE in round 3)
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 12: PRO_S3 — closing round ends
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  // 13: Final Judging — auto-score + end
  { speaker: 'JUDGES', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  // 14: Match complete — auto-ended
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
];

/**
 * No-Host 1v1 — same structure but PRO_S1/OPP_S1 repeat for closing.
 */
const DEBATE_FLOW_NOHost_1V1: DebateStep[] = [
  { speaker: 'WAITING_S1_START', phase: 'waiting_s1', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'HOST', phase: 'motion', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', timeLimit: PREP_SECONDS, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  {
    speaker: 'CE_ROUND_1', phase: 'cross_exam', timeLimit: CE_SECONDS, speakerCanEnd: false, hostCanEnd: false,
    ce: { askingTeam: 'proposition', answeringTeam: 'opposition', quotaPerTeam: 2, questionsAsked: 0, currentRole: 'asker' },
  },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS, speakerCanEnd: true, hostCanEnd: false },
  { speaker: 'JUDGES', phase: 'final_judging', timeLimit: 0, speakerCanEnd: false, hostCanEnd: false },
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

export function aggregateScores(verdicts: any[]) {
  const totals: Record<string, { total: number; count: number }> = { proposition: { total: 0, count: 0 }, opposition: { total: 0, count: 0 } };
  verdicts.forEach((verdict) => {
    const speakerKey = verdict.speaker || '';
    let target = 'opposition';
    if (String(speakerKey).startsWith('PRO')) target = 'proposition';
    if (target === 'proposition' || target === 'opposition') {
      const values = Object.values(verdict.score || {}).filter((v) => typeof v === 'number') as number[];
      totals[target].total += values.reduce((a, b) => a + b, 0);
      totals[target].count += 1;
    }
  });
  const proposition = totals.proposition.count ? totals.proposition.total / totals.proposition.count : 0;
  const opposition = totals.opposition.count ? totals.opposition.total / totals.opposition.count : 0;
  const winner = proposition === opposition ? 'draw' : proposition > opposition ? 'proposition' : 'opposition';
  return { teamProposition: { total: proposition, breakdown: {} }, teamOpposition: { total: opposition, breakdown: {} }, winner };
}

// ─── Public service functions ────────────────────────────────────────────────

export async function startDebate(roomId: string, userId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');

  // No-host: require either S1 debaters consensus (AI judge) or Judge S1 (Human judge)
  const isNoHost = room.hostType !== 'human';
  const isAIJudge = room.judgeType === 'ai';
  
  const isOwner = room.createdBy.toString() === userId;
  let isAuthorized = isOwner;

  if (!isAuthorized) {
    const participant = room.participants.find(
      (p: any) => p.userId.toString() === userId,
    );
    if (participant) {
      const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
      if (isNoHost) {
        if (isAIJudge) {
          isAuthorized = effectiveRole === 'debater' && (participant as any).speakerSlot === 'S1';
        } else {
          isAuthorized = effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
        }
      } else {
        isAuthorized = effectiveRole === 'host';
      }
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
  assertHost(room, userId);
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
  const expectedPrefix = String(turn.speaker || '').split('_')[0];
  const participant = room.participants.find((p: any) => p.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('Only room participants can end a speech');
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  const participantTeam = participant.team === 'proposition' ? 'PRO' : 'OPP';
  const isJudgeS1 = room.hostType !== 'human' && effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1';
  const hasHostControl = effectiveRole === 'host' || isJudgeS1;

  if (participantTeam !== expectedPrefix && !hasHostControl) {
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
  const { speaker: next } = nextStep;

  // After CE rounds (R1 -> free time, R2 -> free time)
  if (curr.startsWith('CE_')) {
    const roundNum = curr.split('_')[1]?.toLowerCase();
    return `End of ${roundNum}`;
  }

  // Round 3 transition: OPP before PRO
  if (curr === 'OPP_S3' && next === 'PRO_S3') {
    return 'Proposition turn';
  }

  // Final judging transition: after PRO_S3 (the closing speech)
  if (curr === 'PRO_S3') {
    return 'Finish Debate';
  }

  // Speech-to-speech in same round (after S1 Prop, before S1 Oppo, etc.)
  if (
    (curr === 'PRO_S1' && next === 'OPP_S1') ||
    (curr === 'PRO_S2' && next === 'OPP_S2')
  ) {
    return 'Opposition turn';
  }

  if (
    (curr === 'OPP_S1' && next === 'PRO_S2') ||
    (curr === 'OPP_S2' && next === 'PRO_S3')
  ) {
    return 'Proposition turn';
  }

  // After speech, before CE (R1 or R2)
  if (
    (curr.startsWith('OPP_S') && next.startsWith('CE_'))
  ) {
    return 'Get ready for cross-examination';
  }

  // After CE -> Free time / Judge feedback (rule: "Hết Round N")
  if (curr.startsWith('CE_') && next.startsWith('JUDGES_FB')) {
    const roundNum = curr.split('_')[1]?.toLowerCase();
    return `End of Round ${roundNum?.replace('round', '')}`;
  }

  // After Judge Feedback -> Next round start (PRO)
  if (curr.startsWith('JUDGES_FB') && next.startsWith('PRO_')) {
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

  timerService.stop(roomId);
  ceTimerService.stop(roomId);

  const room = await DebateRoom.findById(roomId);
  if (!room) return;

  const isNoHost = room.hostType !== 'human';
  const isAIJudge = room.judgeType === 'ai';

  // For waiting_s1 phase, handle immediately (no 3s mute delay)
  // This is triggered when both S1 debaters have pressed Start
  timerService.stop(roomId);
  ceTimerService.stop(roomId);

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

        // Broadcast entering final judging
        io?.to(roomId).emit('debate:phase-change', {
          phase: 'final_judging',
          phaseStatus: 'active',
          speaker: nextStep.speaker,
          announcement: 'Finish Debate',
        });
        io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });
        await session.save();
        await updatedRoom.save();

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

        await session.save();
        await updatedRoom.save();

        io?.to(roomId).emit('debate:phase-change', {
          phase: 'judge_feedback',
          phaseStatus: 'active',
          speaker: nextStep.speaker,
          announcement,
          waitingForJudge: true,
        });
        io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

        if (isAIJudge) {
          // AI judge: request AI feedback, then auto-advance after 10s
          generateAIFeedback(roomId, nextStep.speaker);
          setTimeout(async () => {
            io?.to(roomId).emit('debate:ai-feedback-received', {});
            triggerTransition(roomId).catch(console.error);
          }, 10000);
        } else {
          // Human judge: broadcast that we're waiting for judge scores + vote
          io?.to(roomId).emit('debate:waiting-judge-feedback', {
            phase: 'judge_feedback',
            waitingForVotes: true,
          });
        }
        return;
      }

      // === Human Host: stay idle, wait for host Start ===
      if (!isNoHost) {
        // Unlock mic for all debaters + judges (free time)
        await unlockAllParticipantsMic(updatedRoom);

        io?.to(roomId).emit('debate:transition-start', {
          duration: TRANSITION_MUTE_SECONDS,
          announcement,
          waitingForHost: true,
        });
        io?.to(roomId).emit('debate:mute-lock', { reason: 'transition' });

        setTimeout(async () => {
          try {
            io?.to(roomId).emit('debate:phase-change', {
              phase: nextStep.phase,
              phaseStatus: 'idle',
              speaker: nextStep.speaker,
              announcement,
              waitingForHost: true,
            });
            io?.to(roomId).emit('debate:turn-status-change', { turnStatus: 'idle', phaseStatus: 'idle' });
            const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
            const state = await buildRoomStatePayload(
              roomId,
              updatedRoom.hostId ? updatedRoom.hostId.toString() : updatedRoom.createdBy.toString(),
            );
            if (state) io?.to(roomId).emit('room:state-restore', state);
          } catch (err) {
            console.error('Human host transition error:', err);
          }
        }, TRANSITION_MUTE_SECONDS * 1000);
        return;
      }

      // === No-Host: auto-start after 10s countdown ===
      io?.to(roomId).emit('debate:transition-start', {
        duration: AUTO_TRANSITION_COUNTDOWN,
        isAuto: true,
        announcement,
      });
      io?.to(roomId).emit('debate:mute-lock', { reason: 'transition' });

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

      await Promise.all([session.save(), updatedRoom.save()]);
    } catch (err) {
      console.error('Error in transition timeout:', err);
    }
  }, TRANSITION_MUTE_SECONDS * 1000);
}

/**
 * Generate AI feedback during judge feedback phases.
 * Called after entering a judge_feedback phase in AI judge mode.
 */
async function generateAIFeedback(roomId: string, speaker: string) {
  try {
    const { getIO } = await import('../../socket/index.js');
    const { aiService } = await import('../ai/ai.service.js');
    const session = await DebateSession.findOne({ roomId });
    if (!session) return;

    const history = session.turnHistory || [];
    const speakerPrefix = speaker.replace('JUDGES_FB_', '').toUpperCase();
    const lastSpeech = history.filter((t: any) => String(t.speaker).toUpperCase().includes(speakerPrefix));

    if (lastSpeech.length > 0) {
      const speech = lastSpeech[lastSpeech.length - 1];
      const room = await DebateRoom.findById(roomId);
      const result = await aiService.judgeTurn(roomId, speech.speaker, speech.transcript, {
        motion: room?.motion,
        turnHistory: history.slice(-5),
      });

      const io = getIO();
      io?.to(roomId).emit('debate:ai-feedback', {
        speaker: speech.speaker,
        feedback: result,
      });
    }
  } catch (err) {
    console.error('AI feedback generation error:', err);
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
  const isController = room.createdBy.toString() === userId || room.hostId?.toString() === userId;
  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  const turn = session.currentTurn as any;
  if (!participant && !isController) throw new ForbiddenError('Only participants or host can finish CE');
  if (turn?.phase !== 'cross_exam') throw new BadRequestError('Current phase is not cross-exam');
  if (turn?.phaseStatus !== 'active') throw new BadRequestError('Cross-examination is not active');
  if (!isController && participant?.team !== turn?.ceState?.askingTeam) {
    throw new ForbiddenError('Only the asking team or host can finish CE');
  }
  return endPhaseByHost(roomId, room.createdBy.toString(), transcript);
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
  const aggregate = aggregateScores(verdicts);
  session.finalScores = {
    ...(session.finalScores || {}),
    ...aggregate,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: verdicts,
  };
  session.aiSummary = summary || session.aiSummary;
  (session.currentTurn as any).status = 'completed';
  (session.currentTurn as any).phase = 'completed';
  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();
  await Promise.all([session.save(), room.save()]);

  // Broadcast debate ended BEFORE applying ranking (so frontend can redirect)
  io?.to(roomId).emit('debate:ended', { roomId });
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
