import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';

const SPEECH_SECONDS = 4 * 60;
const CE_SECONDS = 3 * 60;
const PREP_SECONDS = 60;
const JUDGING_SECONDS = 10 * 60;

type DebateStep = {
  speaker: string;
  phase: string;
  timeLimit: number;
  ce?: {
    askingTeam: 'proposition' | 'opposition';
    answeringTeam: 'proposition' | 'opposition';
    quotaPerTeam: number;
    questionsAsked: number;
    currentRole: 'asker' | 'answerer';
  };
};

const DEBATE_FLOW: DebateStep[] = [
  { speaker: 'HOST', phase: 'motion', timeLimit: PREP_SECONDS },
  { speaker: 'PRO_S1', phase: 'speech', timeLimit: SPEECH_SECONDS },
  { speaker: 'OPP_S1', phase: 'speech', timeLimit: SPEECH_SECONDS },
  {
    speaker: 'PRO_CE_1',
    phase: 'cross_exam',
    timeLimit: CE_SECONDS,
    ce: {
      askingTeam: 'proposition',
      answeringTeam: 'opposition',
      quotaPerTeam: 2,
      questionsAsked: 0,
      currentRole: 'asker',
    },
  },
  { speaker: 'PRO_S2', phase: 'speech', timeLimit: SPEECH_SECONDS },
  { speaker: 'OPP_S2', phase: 'speech', timeLimit: SPEECH_SECONDS },
  {
    speaker: 'OPP_CE_1',
    phase: 'cross_exam',
    timeLimit: CE_SECONDS,
    ce: {
      askingTeam: 'opposition',
      answeringTeam: 'proposition',
      quotaPerTeam: 2,
      questionsAsked: 0,
      currentRole: 'asker',
    },
  },
  { speaker: 'PRO_S3', phase: 'speech', timeLimit: SPEECH_SECONDS },
  { speaker: 'OPP_S3', phase: 'speech', timeLimit: SPEECH_SECONDS },
  {
    speaker: 'PRO_CE_2',
    phase: 'cross_exam',
    timeLimit: CE_SECONDS,
    ce: {
      askingTeam: 'proposition',
      answeringTeam: 'opposition',
      quotaPerTeam: 2,
      questionsAsked: 0,
      currentRole: 'asker',
    },
  },
  { speaker: 'JUDGES', phase: 'judge_feedback', timeLimit: 5 * 60 },
  { speaker: 'BOTH_TEAMS', phase: 'prep_1', timeLimit: PREP_SECONDS },
  { speaker: 'PRO_CLOSE', phase: 'closing', timeLimit: 2 * 60 },
  { speaker: 'OPP_CLOSE', phase: 'closing', timeLimit: 2 * 60 },
  { speaker: 'JUDGES', phase: 'final_judging', timeLimit: JUDGING_SECONDS },
  { speaker: 'COMPLETED', phase: 'completed', timeLimit: 0 },
];

function getStepIndex(speaker: string, phase: string) {
  return DEBATE_FLOW.findIndex((step) => step.speaker === speaker && step.phase === phase);
}

function assertHost(room: any, userId: string) {
  const isOwner = room.createdBy.toString() === userId;
  const isHost = room.hostId?.toString() === userId;
  if (!isOwner && !isHost) {
    throw new ForbiddenError('Only owner or host can control the debate');
  }
}

function getRequiredSlots(format: string) {
  const slots = format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3'];
  return ['proposition', 'opposition'].flatMap((team) =>
    slots.map((slot) => ({ team, slot })),
  );
}

function hasLockedRequiredPositions(room: any) {
  return getRequiredSlots(room.format).every(({ team, slot }) =>
    room.participants.some(
      (participant: any) =>
        participant.roomRole === 'debater' &&
        participant.team === team &&
        participant.speakerSlot === slot &&
        participant.positionLocked,
    ),
  );
}

function snapshotCurrentTurn(session: any, transcript = '') {
  const now = new Date();
  const duration = session.currentTurn.startTime
    ? now.getTime() - session.currentTurn.startTime.getTime()
    : 0;

  session.turnHistory.push({
    speaker: session.currentTurn.speaker,
    startTime: session.currentTurn.startTime || now,
    endTime: now,
    duration,
    transcript,
    crossExamination:
      session.currentTurn.phase === 'cross_exam'
        ? {
            questionsAsked: session.currentTurn.ceState?.questionsAsked || 0,
            questionsAnswered: session.currentTurn.ceState?.questionsAnswered || 0,
            timeRemainingPro: session.currentTurn.ceState?.askingTeam === 'proposition'
              ? session.currentTurn.timeRemaining
              : 0,
            timeRemainingOpp: session.currentTurn.ceState?.askingTeam === 'opposition'
              ? session.currentTurn.timeRemaining
              : 0,
            transcript: session.currentTurn.ceState?.transcript || [],
          }
        : null,
    aiAnalysis: null,
  });
}

function applyStep(session: any, step: DebateStep) {
  const ceState = step.ce
    ? {
        ...step.ce,
        questionsAnswered: 0,
        transcript: [],
      }
    : undefined;

  session.currentTurn = {
    speaker: step.speaker,
    phase: step.phase,
    startTime: new Date(),
    timeLimit: step.timeLimit,
    timeRemaining: step.timeLimit,
    status: step.phase === 'completed' ? 'completed' : 'active',
    ...(ceState ? { ceState } : {}),
  };
}

function aggregateScores(verdicts: any[]) {
  const totals = {
    proposition: { total: 0, count: 0 },
    opposition: { total: 0, count: 0 },
  };

  verdicts.forEach((verdict) => {
    const target = (verdict.team ||
      (String(verdict.speaker || '').startsWith('PRO') ? 'proposition' : 'opposition')) as
      | 'proposition'
      | 'opposition';
    const values = Object.values(verdict.score || {}).filter((value) => typeof value === 'number') as number[];
    const scoreTotal = values.reduce((sum, value) => sum + value, 0);
    if (target === 'proposition' || target === 'opposition') {
      totals[target].total += scoreTotal;
      totals[target].count += 1;
    }
  });

  const proposition = totals.proposition.count ? totals.proposition.total / totals.proposition.count : 0;
  const opposition = totals.opposition.count ? totals.opposition.total / totals.opposition.count : 0;
  const winner = proposition === opposition ? 'draw' : proposition > opposition ? 'proposition' : 'opposition';

  return {
    teamProposition: { total: proposition, breakdown: {} },
    teamOpposition: { total: opposition, breakdown: {} },
    winner,
  };
}

export async function startDebate(roomId: string, userId: string) {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  assertHost(room, userId);

  if (!['waiting', 'ready'].includes(room.status)) {
    throw new BadRequestError('Room cannot be started in current state');
  }

  if (room.hostType === 'human' && !room.hostId) {
    throw new BadRequestError('Assign a host before starting the debate');
  }

  if (room.roomType === 'custom' && !room.motion.trim()) {
    throw new BadRequestError('Choose a debate topic before starting');
  }

  if (!hasLockedRequiredPositions(room)) {
    throw new BadRequestError('All debater positions must be filled and locked before starting');
  }

  const existingSession = await DebateSession.findOne({ roomId: room._id });
  if (existingSession) {
    throw new BadRequestError('Debate session already exists');
  }

  const session = new DebateSession({ roomId: room._id });
  applyStep(session, DEBATE_FLOW[0]);
  await session.save();

  room.status = 'active';
  room.currentPhase = 'motion';
  room.startedAt = new Date();
  await room.save();

  return { room, session };
}

export async function advanceTurn(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  assertHost(room, userId);

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  if (session.currentTurn.status === 'completed') {
    throw new BadRequestError('Debate is already completed');
  }

  const currentIndex = getStepIndex(session.currentTurn.speaker, session.currentTurn.phase);
  const nextStep = DEBATE_FLOW[Math.min(currentIndex + 1, DEBATE_FLOW.length - 1)];
  snapshotCurrentTurn(session, transcript);
  applyStep(session, nextStep);

  room.currentPhase = nextStep.phase;
  if (nextStep.phase === 'completed') {
    room.status = 'completed';
    room.endedAt = new Date();
  }

  await Promise.all([session.save(), room.save()]);
  return { room, session, currentTurn: session.currentTurn };
}

export async function finishPhase(roomId: string, userId: string, transcript = '') {
  return advanceTurn(roomId, userId, transcript);
}

export async function passCeTurn(roomId: string, userId: string, content = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  const participant = room.participants.find((item) => item.userId.toString() === userId);
  if (!participant) throw new ForbiddenError('Only room participants can pass CE turn');

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');
  if (session.currentTurn.phase !== 'cross_exam') {
    throw new BadRequestError('Current phase is not cross-exam');
  }

  const ceState = (session.currentTurn as any).ceState || {};
  if (participant.team !== ceState.askingTeam) {
    throw new ForbiddenError('Only the asking team can pass CE turn');
  }

  ceState.questionsAsked = (ceState.questionsAsked || 0) + 1;
  ceState.currentRole = ceState.currentRole === 'asker' ? 'answerer' : 'asker';
  ceState.transcript = ceState.transcript || [];
  ceState.transcript.push({
    team: participant.team,
    type: 'pass',
    content,
    timestamp: new Date(),
  });

  (session.currentTurn as any).ceState = ceState;

  if (ceState.questionsAsked >= (ceState.quotaPerTeam || 2)) {
    return finishPhase(roomId, userId, content);
  }

  await session.save();
  return { room, session, currentTurn: session.currentTurn };
}

export async function finishCe(roomId: string, userId: string, transcript = '') {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  const participant = room.participants.find((item) => item.userId.toString() === userId);
  const isController = room.createdBy.toString() === userId || room.hostId?.toString() === userId;
  const ceState = (await DebateSession.findOne({ roomId: room._id }))?.currentTurn as any;
  if (!participant && !isController) throw new ForbiddenError('Only participants or host can finish CE');
  if (ceState?.phase !== 'cross_exam') throw new BadRequestError('Current phase is not cross-exam');
  if (!isController && participant?.team !== ceState.ceState?.askingTeam) {
    throw new ForbiddenError('Only the asking team or host can finish CE');
  }

  return finishPhase(roomId, room.createdBy.toString(), transcript);
}

export async function endDebate(roomId: string, userId: string, summary = ''): Promise<any> {
  const room = await DebateRoom.findById(roomId);
  if (!room) throw new NotFoundError('Room not found');
  assertHost(room, userId);

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) throw new NotFoundError('Session not found');

  const verdicts = (session.finalScores as any)?.judgeVerdicts || [];
  const aggregate = aggregateScores(verdicts);
  session.finalScores = {
    ...(session.finalScores || {}),
    ...aggregate,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: verdicts,
  };
  session.aiSummary = summary || session.aiSummary;
  session.currentTurn.status = 'completed';
  session.currentTurn.phase = 'completed';

  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();

  await Promise.all([session.save(), room.save()]);
  const ranking = await applyDebateResult(roomId);

  return { room, session, ranking };
}

function getDebaterOrThrow(room: any, userId: string) {
  const participant = room.participants.find(
    (item: any) => item.userId.toString() === userId && item.roomRole === 'debater',
  );

  if (!participant || !participant.team) {
    throw new ForbiddenError('Only assigned debaters can use this action');
  }

  return participant;
}

function assertDebateInProgress(room: any) {
  if (!['active', 'paused'].includes(room.status)) {
    throw new BadRequestError('Debate is not in progress');
  }
}

async function completeDebateWithWinner(room: any, session: any, winner: 'proposition' | 'opposition' | 'draw', summary: string) {
  const propositionTotal = winner === 'proposition' ? 100 : winner === 'draw' ? 50 : 0;
  const oppositionTotal = winner === 'opposition' ? 100 : winner === 'draw' ? 50 : 0;

  session.finalScores = {
    ...(session.finalScores || {}),
    teamProposition: { total: propositionTotal, breakdown: {} },
    teamOpposition: { total: oppositionTotal, breakdown: {} },
    winner,
    winnerTeam: winner,
    aiVerdict: (session.finalScores as any)?.aiVerdict || null,
    judgeVerdicts: (session.finalScores as any)?.judgeVerdicts || [],
  };
  session.aiSummary = summary;
  session.currentTurn.status = 'completed';
  session.currentTurn.phase = 'completed';

  room.status = 'completed';
  room.currentPhase = 'completed';
  room.endedAt = new Date();

  await Promise.all([session.save(), room.save()]);
  const ranking = await applyDebateResult(room._id.toString());

  return { room, session, ranking };
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
    teamProposition: { total: 0, breakdown: {} },
    teamOpposition: { total: 0, breakdown: {} },
    winner: null,
    winnerTeam: null,
    aiVerdict: null,
    judgeVerdicts: [],
  }) as any;

  const drawRequests = Array.isArray(finalScores.drawRequests) ? finalScores.drawRequests : [];
  const oppositeRequest = drawRequests.find(
    (request: any) => request.status === 'pending' && request.team !== participant.team,
  );

  if (oppositeRequest) {
    oppositeRequest.status = 'accepted';
    oppositeRequest.acceptedBy = participant.userId;
    oppositeRequest.acceptedAt = new Date();
    finalScores.drawRequests = drawRequests;
    session.finalScores = finalScores;

    return completeDebateWithWinner(
      room,
      session,
      'draw',
      'Both teams agreed to a draw.',
    );
  }

  const existingRequest = drawRequests.find(
    (request: any) => request.status === 'pending' && request.team === participant.team,
  );

  if (!existingRequest) {
    drawRequests.push({
      requestedBy: participant.userId,
      requestedByName: participant.username,
      team: participant.team,
      status: 'pending',
      requestedAt: new Date(),
    });
  }

  finalScores.drawRequests = drawRequests;
  session.finalScores = finalScores;
  await session.save();

  return { room, session, currentTurn: session.currentTurn };
}
