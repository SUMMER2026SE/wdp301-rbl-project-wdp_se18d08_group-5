import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { User } from '../../models/User.js';
import { getIO } from '../../socket/index.js';
import { aiService } from '../ai/ai.service.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { startDebate } from '../debate/debate.service.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

/**
 * Broadcast a compact room snapshot to every connected client in the room.
 * Used by routes that mutate the room (assign-role, position, lock, start…)
 * so the lobby stays in sync without forcing every client to poll REST.
 */
async function broadcastRoomState(roomId: string) {
  try {
    const io = getIO();
    if (!io) return;
    const room = await DebateRoom.findById(roomId).select('-password');
    if (!room) return;
    io.to(roomId.toString()).emit('room:state-updated', {
      roomId: room._id,
      room: await buildRoomPayload(room),
      status: room.status,
      currentPhase: room.currentPhase,
      participants: room.participants,
    });
  } catch (error) {
    console.error('broadcastRoomState error:', error);
  }
}

const SCORE_LIMITS = {
  logic: 30,
  rebuttal: 20,
  evidence: 15,
  crossExam: 15,
  strategy: 10,
  communication: 10,
} as const;

type ScoreCriterion = keyof typeof SCORE_LIMITS;
type DebateWinner = 'proposition' | 'opposition' | 'draw';

const HUMAN_JUDGE_WEIGHT = 1;
const AI_JUDGE_WEIGHT = 0.5;
const MAX_MOTION_LENGTH = 240;

function normalizeMotion(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new BadRequestError('motion must be a string');
  }

  const motion = value.trim().replace(/\s+/g, ' ');
  if (motion.length > MAX_MOTION_LENGTH) {
    throw new BadRequestError(`motion must be ${MAX_MOTION_LENGTH} characters or fewer`);
  }

  return motion;
}

function requireMotion(value: unknown) {
  const motion = normalizeMotion(value);
  if (!motion) {
    throw new BadRequestError('motion is required');
  }

  return motion;
}

async function buildRoomPayload(room: any) {
  const payload = room.toObject ? room.toObject() : room;
  const userIds = (payload.participants || []).map((participant: any) => participant.userId);
  const users = await User.find({ _id: { $in: userIds } }).select('username profile.displayName profile.avatar');
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  payload.participants = (payload.participants || []).map((participant: any) => {
    const user = usersById.get(participant.userId?.toString?.() || '');
    return {
      ...participant,
      username: user?.profile?.displayName || user?.username || participant.username,
      avatar: user?.profile?.avatar || participant.avatar || '',
    };
  });

  return payload;
}

function parseScoreCriterion(body: Record<string, unknown>, criterion: ScoreCriterion) {
  const value = body[criterion];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestError(`${criterion} must be a number`);
  }
  if (value < 0 || value > SCORE_LIMITS[criterion]) {
    throw new BadRequestError(`${criterion} must be between 0 and ${SCORE_LIMITS[criterion]}`);
  }
  return value;
}

function buildJudgeScore(body: Record<string, unknown>) {
  const score = {
    logic: parseScoreCriterion(body, 'logic'),
    rebuttal: parseScoreCriterion(body, 'rebuttal'),
    evidence: parseScoreCriterion(body, 'evidence'),
    crossExam: parseScoreCriterion(body, 'crossExam'),
    strategy: parseScoreCriterion(body, 'strategy'),
    communication: parseScoreCriterion(body, 'communication'),
    overall: 0,
  };

  score.overall =
    score.logic +
    score.rebuttal +
    score.evidence +
    score.crossExam +
    score.strategy +
    score.communication;

  return score;
}

function clampScore(value: unknown, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), max);
}

function normalizeAIJudgeResult(result: any) {
  const rawScore = result?.score || {};
  const score = {
    logic: clampScore(rawScore.logic, SCORE_LIMITS.logic),
    rebuttal: clampScore(rawScore.rebuttal, SCORE_LIMITS.rebuttal),
    evidence: clampScore(rawScore.evidence, SCORE_LIMITS.evidence),
    crossExam: clampScore(rawScore.crossExam, SCORE_LIMITS.crossExam),
    strategy: clampScore(rawScore.strategy, SCORE_LIMITS.strategy),
    communication: clampScore(rawScore.communication, SCORE_LIMITS.communication),
    overall: 0,
  };

  score.overall =
    score.logic +
    score.rebuttal +
    score.evidence +
    score.crossExam +
    score.strategy +
    score.communication;

  const verdict = ['proposition', 'opposition', 'draw'].includes(result?.verdict)
    ? result.verdict
    : 'draw';

  return {
    score,
    verdict,
    comments: typeof result?.comments === 'string' ? result.comments : '',
    strengths: Array.isArray(result?.strengths) ? result.strengths : [],
    weaknesses: Array.isArray(result?.weaknesses) ? result.weaknesses : [],
    fallacies: Array.isArray(result?.fallacies) ? result.fallacies : [],
    summary:
      typeof result?.summary === 'string'
        ? result.summary
        : typeof result?.comments === 'string'
          ? result.comments
          : '',
  };
}

function createEmptyScoreBreakdown() {
  return {
    logic: 0,
    rebuttal: 0,
    evidence: 0,
    crossExam: 0,
    strategy: 0,
    communication: 0,
    overall: 0,
  };
}

function getSpeakerTeam(speaker: unknown): 'proposition' | 'opposition' | null {
  if (typeof speaker !== 'string') return null;
  if (speaker.startsWith('PRO_')) return 'proposition';
  if (speaker.startsWith('OPP_')) return 'opposition';
  return null;
}

function getVerdictWeight(verdict: any) {
  return verdict?.source === 'ai' || verdict?.judgeId === null ? AI_JUDGE_WEIGHT : HUMAN_JUDGE_WEIGHT;
}

function getLatestVerdicts(verdicts: any[]) {
  const latestByJudgeAndSpeaker = new Map<string, any>();

  verdicts.forEach((verdict, index) => {
    const judgeKey = verdict?.source === 'ai'
      ? `ai:${verdict.speaker}:${index}`
      : `${verdict?.judgeId?.toString?.() || 'unknown'}:${verdict?.speaker || 'unknown'}`;
    latestByJudgeAndSpeaker.set(judgeKey, verdict);
  });

  return Array.from(latestByJudgeAndSpeaker.values());
}

function aggregateTeamScores(verdicts: any[], team: 'proposition' | 'opposition') {
  const totals = createEmptyScoreBreakdown();
  let totalWeight = 0;

  verdicts.forEach((verdict) => {
    if (getSpeakerTeam(verdict?.speaker) !== team || !verdict?.score) return;

    const weight = getVerdictWeight(verdict);
    totalWeight += weight;

    (Object.keys(SCORE_LIMITS) as ScoreCriterion[]).forEach((criterion) => {
      totals[criterion] += clampScore(verdict.score[criterion], SCORE_LIMITS[criterion]) * weight;
    });
    totals.overall += clampScore(verdict.score.overall, 100) * weight;
  });

  if (totalWeight === 0) {
    return { total: 0, breakdown: totals, weight: 0 };
  }

  const breakdown = createEmptyScoreBreakdown();
  (Object.keys(SCORE_LIMITS) as ScoreCriterion[]).forEach((criterion) => {
    breakdown[criterion] = Number((totals[criterion] / totalWeight).toFixed(2));
  });
  breakdown.overall = Number((totals.overall / totalWeight).toFixed(2));

  return {
    total: breakdown.overall,
    breakdown,
    weight: Number(totalWeight.toFixed(2)),
  };
}

function resolveWinnerFromVerdicts(verdicts: any[], propositionTotal: number, oppositionTotal: number): DebateWinner {
  const votes: Record<DebateWinner, number> = {
    proposition: 0,
    opposition: 0,
    draw: 0,
  };

  verdicts.forEach((verdict) => {
    if (!['proposition', 'opposition', 'draw'].includes(verdict?.winner)) return;
    votes[verdict.winner as DebateWinner] += getVerdictWeight(verdict);
  });

  const voteEntries = Object.entries(votes) as Array<[DebateWinner, number]>;
  const [topVote, secondVote] = voteEntries.sort((a, b) => b[1] - a[1]);
  if (topVote && topVote[1] > 0 && (!secondVote || topVote[1] > secondVote[1])) {
    return topVote[0];
  }

  const scoreDelta = propositionTotal - oppositionTotal;
  if (Math.abs(scoreDelta) < 0.5) return 'draw';
  return scoreDelta > 0 ? 'proposition' : 'opposition';
}

function resolveWinnerFromTeamScores(propositionTotal: number, oppositionTotal: number): DebateWinner {
  const scoreDelta = propositionTotal - oppositionTotal;
  if (Math.abs(scoreDelta) < 0.5) return 'draw';
  return scoreDelta > 0 ? 'proposition' : 'opposition';
}

function aggregateFinalScores(session: any) {
  if (!session.finalScores) {
    session.finalScores = {
      teamProposition: { total: 0, breakdown: {} },
      teamOpposition: { total: 0, breakdown: {} },
      winner: 'draw',
      aiVerdict: 'pending',
      judgeVerdicts: [],
    };
  }

  const finalScores = session.finalScores as {
    teamProposition: any;
    teamOpposition: any;
    winner: DebateWinner;
    winnerTeam?: DebateWinner;
    aiVerdict: string | null;
    judgeVerdicts: any[];
    aggregatePolicy?: any;
  };
  const verdicts = getLatestVerdicts(finalScores.judgeVerdicts || []);
  const proposition = aggregateTeamScores(verdicts, 'proposition');
  const opposition = aggregateTeamScores(verdicts, 'opposition');
  const weightedVoteWinner = resolveWinnerFromVerdicts(verdicts, proposition.total, opposition.total);
  const winnerTeam = resolveWinnerFromTeamScores(proposition.total, opposition.total);

  const aiVotes = verdicts.filter((verdict) => verdict?.source === 'ai' && verdict?.winner);
  const latestAIVote = aiVotes[aiVotes.length - 1]?.winner || null;

  finalScores.teamProposition = {
    total: proposition.total,
    breakdown: proposition.breakdown,
    weight: proposition.weight,
  };
  finalScores.teamOpposition = {
    total: opposition.total,
    breakdown: opposition.breakdown,
    weight: opposition.weight,
  };
  finalScores.winner = winnerTeam;
  finalScores.winnerTeam = winnerTeam;
  finalScores.aiVerdict = latestAIVote;
  finalScores.aggregatePolicy = {
    humanJudgeWeight: HUMAN_JUDGE_WEIGHT,
    aiJudgeWeight: AI_JUDGE_WEIGHT,
    method: 'weighted_average_with_weighted_winner_votes',
    weightedVoteWinner,
    winnerMethod: 'compare_team_total_scores',
    verdictCount: verdicts.length,
    aggregatedAt: new Date(),
  };

  return finalScores;
}

async function judgeTurnWithAI(
  room: any,
  session: any,
  turnHistoryIndex: number,
  transcript: string,
) {
  if (room.judgeType !== 'ai' || !transcript.trim()) return null;

  const turn = session.turnHistory[turnHistoryIndex];
  if (!turn) return null;

  const aiResult = await aiService.judgeTurn(room._id.toString(), turn.speaker, transcript, {
    motion: room.motion,
    format: room.format,
    phase: turn.crossExamination ? 'cross_exam' : 'speech',
    participants: room.participants,
    currentPhase: room.currentPhase,
  });
  const normalized = normalizeAIJudgeResult(aiResult);

  turn.aiAnalysis = {
    score: normalized.score,
    strengths: normalized.strengths,
    weaknesses: normalized.weaknesses,
    fallacies: normalized.fallacies,
    summary: normalized.summary,
    verdict: normalized.verdict,
    comments: normalized.comments,
  };

  if (!session.finalScores) {
    session.finalScores = {
      teamProposition: { total: 0, breakdown: {} },
      teamOpposition: { total: 0, breakdown: {} },
      winner: 'draw',
      aiVerdict: 'pending',
      judgeVerdicts: [],
    };
  }

  const finalScores = session.finalScores as { judgeVerdicts: any[]; aiVerdict: string | null };
  finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];
  finalScores.judgeVerdicts.push({
    judgeId: null,
    judgeName: 'AI Judge',
    speaker: turn.speaker,
    winner: normalized.verdict,
    score: normalized.score,
    notes: normalized.summary,
    source: 'ai',
    submittedAt: new Date(),
  });
  aggregateFinalScores(session);

  await session.save();

  getIO().to(room._id.toString()).emit('ai:turn-judged', {
    roomId: room._id,
    speaker: turn.speaker,
    analysis: turn.aiAnalysis,
  });
  getIO().to(room._id.toString()).emit('score:updated', {
    roomId: room._id,
    judgeId: 'ai',
    speaker: turn.speaker,
    score: normalized.score,
    winner: normalized.verdict,
  });
  getIO().to(room._id.toString()).emit('score:aggregate-updated', {
    roomId: room._id,
    finalScores,
  });

  return normalized;
}

// POST /api/v1/rooms/create — Create custom room (UC-14)
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, format, hostType, judgeType, judgeCount, isPrivate, password, motion } = req.body;
    const userId = req.user!.userId;
    const user = await User.findById(userId).select('username profile.displayName profile.avatar');
    if (!user) throw new NotFoundError('User not found');

    const room = await DebateRoom.create({
      roomType: 'custom',
      title,
      motion: normalizeMotion(motion),
      format,
      hostType,
      judgeType,
      judgeCount: judgeCount || 1,
      isPrivate: isPrivate || false,
      password: isPrivate ? password : null,
      createdBy: userId,
      participants: [
        {
          userId,
          username: user.profile?.displayName || user.username,
          avatar: user.profile?.avatar || '',
          roomRole: 'owner',
          team: null,
          speakerSlot: null,
          positionLocked: false,
          muted: false,
        },
      ],
    });

    sendSuccess(res, room, 'Room created', 201);
  }),
);

// GET /api/v1/rooms — List rooms / Live Matches (UC-25/65)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, format, roomType, page = '1', limit = '20' } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (format) filter.format = format;
    if (roomType) filter.roomType = roomType;

    // Default: show active/waiting rooms
    if (!status) filter.status = { $in: ['waiting', 'ready', 'active'] };

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [rooms, total] = await Promise.all([
      DebateRoom.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DebateRoom.countDocuments(filter),
    ]);

    sendPaginated(res, rooms, { page: pageNum, limit: limitNum, total });
  }),
);

// GET /api/v1/rooms/:id — Room detail
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('-password');
    if (!room) throw new NotFoundError('Room not found');
    sendSuccess(res, await buildRoomPayload(room));
  }),
);

// PUT /api/v1/rooms/:id — Edit room (UC-16)
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('+password');
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can edit the room');
    }
    if (['active', 'paused', 'completed'].includes(room.status)) {
      throw new BadRequestError('Cannot edit a room that has already started');
    }

    const {
      title,
      format,
      hostType,
      judgeType,
      judgeCount,
      isPrivate,
      password,
      motion,
    } = req.body;

    if (title !== undefined) room.title = title;
    if (format !== undefined) room.format = format;
    if (hostType !== undefined) room.hostType = hostType;
    if (judgeType !== undefined) room.judgeType = judgeType;
    if (judgeCount !== undefined) room.judgeCount = judgeCount;
    if (motion !== undefined) room.motion = normalizeMotion(motion);
    if (isPrivate !== undefined) {
      room.isPrivate = isPrivate;
      room.password = isPrivate ? password || room.password : null;
    }
    if (isPrivate && password !== undefined) {
      room.password = password;
    }

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, room, 'Room updated');
  }),
);

// DELETE /api/v1/rooms/:id — Delete room (UC-17)
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can delete the room');
    }
    if (room.status === 'active' || room.status === 'paused') {
      throw new BadRequestError('Cannot delete a room while a debate is in progress');
    }

    await room.deleteOne();
    sendSuccess(res, null, 'Room deleted');
  }),
);

// POST /api/v1/rooms/:id/assign-role — Assign host/judge role (UC-22)
router.post(
  '/:id/assign-role',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, role, team, speakerSlot } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can assign roles');
    }
    if (!['debater', 'host', 'judge', 'viewer'].includes(role)) {
      throw new BadRequestError('Role must be debater, host, judge, or viewer');
    }

    const participant = room.participants.find((p) => p.userId.toString() === userId);
    if (!participant) {
      throw new NotFoundError('Participant not found');
    }

    room.judges = (room.judges || []).filter(
      (judge) => judge.userId.toString() !== participant.userId.toString(),
    ) as any;

    if (role === 'host') {
      const previousHost = room.hostId
        ? room.participants.find((p) => p.userId.toString() === room.hostId?.toString())
        : null;
      if (previousHost && previousHost.userId.toString() !== participant.userId.toString()) {
        previousHost.roomRole =
          previousHost.userId.toString() === room.createdBy.toString() ? 'owner' : 'viewer';
        previousHost.team = null;
        previousHost.speakerSlot = null;
        previousHost.positionLocked = false;
      }
      room.hostId = participant.userId as any;
      room.hostType = 'human';
      participant.roomRole = 'host';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
    }

    if (role === 'judge') {
      participant.roomRole = 'judge';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
      }
      room.judges.push({ userId: participant.userId as any, username: participant.username });
    }

    if (role === 'debater') {
      if (team !== undefined && !['proposition', 'opposition', null].includes(team)) {
        throw new BadRequestError('Team must be proposition or opposition');
      }
      if (speakerSlot !== undefined && !['S1', 'S2', 'S3', null].includes(speakerSlot)) {
        throw new BadRequestError('speakerSlot must be S1, S2, or S3');
      }
      participant.roomRole = 'debater';
      participant.team = team ?? null;
      participant.speakerSlot = speakerSlot ?? null;
      participant.positionLocked = false;
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
      }
    }

    if (role === 'viewer') {
      participant.roomRole =
        participant.userId.toString() === room.createdBy.toString() ? 'owner' : 'viewer';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
      }
    }

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, room, 'Participant assignment updated');
  }),
);

// POST /api/v1/rooms/:id/join — Join room (UC-17)
router.post(
  '/:id/join',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('+password');
    if (!room) throw new NotFoundError('Room not found');
    if (room.status !== 'waiting' && room.status !== 'ready') {
      throw new BadRequestError('Room is not accepting participants');
    }

    // Check password
    if (room.isPrivate && room.password) {
      if (req.body.password !== room.password) {
        throw new ForbiddenError('Incorrect room password');
      }
    }

    // Check if already in room
    const alreadyIn = room.participants.some(
      (p) => p.userId.toString() === req.user!.userId,
    );
    if (alreadyIn) throw new BadRequestError('Already in room');

    const user = await User.findById(req.user!.userId).select('username profile.displayName profile.avatar');
    if (!user) throw new NotFoundError('User not found');

    room.participants.push({
      userId: req.user!.userId as any,
      username: user.profile?.displayName || user.username,
      avatar: user.profile?.avatar || '',
      roomRole: 'viewer',
      team: null,
      speakerSlot: null,
      positionLocked: false,
      muted: false,
    });

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, room, 'Joined room');
  }),
);

// POST /api/v1/rooms/:id/position — Select position (UC-18)
router.post(
  '/:id/position',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { team, speakerSlot } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const participant = room.participants.find(
      (p) => p.userId.toString() === req.user!.userId,
    );
    if (!participant) throw new BadRequestError('Not in room');
    if (participant.positionLocked) throw new BadRequestError('Position is locked');
    if (participant.roomRole !== 'debater') {
      throw new ForbiddenError('Only assigned debaters can select team and speaker slot');
    }

    if (team) participant.team = team;
    if (speakerSlot) participant.speakerSlot = speakerSlot;

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, room, 'Position updated');
  }),
);

// POST /api/v1/rooms/:id/position/lock — Lock positions (UC-19, Owner only)
// Locks ALL assigned participants: debaters, human host, and judges. The owner
// is not part of the lock list because they are the operator, not a debater.
router.post(
  '/:id/position/lock',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only owner can lock positions');
    }

    let lockedCount = 0;
    room.participants.forEach((p) => {
      if (p.userId.toString() === room.createdBy.toString()) return;
      if (p.roomRole === 'viewer') return;
      if (p.roomRole === 'debater' && (!p.team || !p.speakerSlot)) return;
      p.positionLocked = true;
      lockedCount += 1;
    });
    room.status = room.status === 'waiting' ? 'ready' : room.status;
    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, { room, lockedCount }, `All positions locked (${lockedCount} participants)`);
  }),
);

// POST /api/v1/rooms/:id/lock — Alias for checklist/Postman compatibility
router.post(
  '/:id/lock',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only owner can lock positions');
    }

    let lockedCount = 0;
    room.participants.forEach((p) => {
      if (p.userId.toString() === room.createdBy.toString()) return;
      if (p.roomRole === 'viewer') return;
      if (p.roomRole === 'debater' && (!p.team || !p.speakerSlot)) return;
      p.positionLocked = true;
      lockedCount += 1;
    });
    room.status = room.status === 'waiting' ? 'ready' : room.status;
    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, { room, lockedCount }, `All positions locked (${lockedCount} participants)`);
  }),
);

// POST /api/v1/rooms/:id/start — Start debate (UC-22)
router.post(
  '/:id/start',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await startDebate(req.params.id, req.user!.userId);

    // Notify every client in the room so participants auto-navigate from
    // the lobby to the live debate screen.
    const io = getIO();
    const roomIdStr = req.params.id;
    io.to(roomIdStr).emit('debate:started', {
      roomId: roomIdStr,
      session: result.session,
      room: result.room,
    });
    await broadcastRoomState(roomIdStr);

    sendSuccess(res, result, 'Debate started');
  }),
);

// POST /api/v1/rooms/:id/host/motion — Host/owner selects debate topic before start
router.post(
  '/:id/host/motion',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) {
      throw new ForbiddenError('Only host or owner can update the debate topic');
    }
    if (!['waiting', 'ready'].includes(room.status)) {
      throw new BadRequestError('Cannot update the topic after the debate has started');
    }

    room.motion = requireMotion(req.body.motion);
    await room.save();

    getIO().to(req.params.id).emit('room:motion-updated', {
      roomId: room._id,
      motion: room.motion,
    });

    sendSuccess(res, { motion: room.motion }, 'Debate topic updated');
  }),
);

// POST /api/v1/rooms/:id/leave — Leave room (UC-23)
router.post(
  '/:id/leave',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== req.user!.userId,
    ) as any;
    await room.save();
    await broadcastRoomState(room._id.toString());

    sendSuccess(res, null, 'Left room');
  }),
);

// POST /api/v1/rooms/:id/kick — Kick participant (UC-24)
router.post(
  '/:id/kick',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only owner can kick');
    }

    const { userId } = req.body;
    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== userId,
    ) as any;
    await room.save();
    await broadcastRoomState(room._id.toString());

    sendSuccess(res, room, 'Participant kicked');
  }),
);

// POST /api/v1/rooms/:id/host/pause — Pause debate (UC-25)
router.post(
  '/:id/host/pause',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can pause');
    if (room.status !== 'active') {
      throw new BadRequestError('Room is not active');
    }

    room.status = 'paused';
    await room.save();

    sendSuccess(res, { status: room.status }, 'Debate paused');
  }),
);

// POST /api/v1/rooms/:id/host/resume — Resume debate (UC-26)
router.post(
  '/:id/host/resume',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can resume');
    if (room.status !== 'paused') {
      throw new BadRequestError('Room is not paused');
    }

    room.status = 'active';
    await room.save();

    sendSuccess(res, { status: room.status }, 'Debate resumed');
  }),
);

// POST /api/v1/rooms/:id/host/next-turn — Advance the debate turn (UC-27)
router.post(
  '/:id/host/next-turn',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, phase, timeLimit, transcript } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can advance turns');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    const currentTurn = session.currentTurn;
    const now = new Date();

    if (currentTurn.startTime) {
      const duration = now.getTime() - currentTurn.startTime.getTime();
      session.turnHistory.push({
        speaker: currentTurn.speaker,
        startTime: currentTurn.startTime,
        endTime: now,
        duration,
        transcript: transcript || '',
        crossExamination: currentTurn.phase === 'cross_exam' ? { questionsAsked: 0, questionsAnswered: 0, timeRemainingPro: 0, timeRemainingOpp: 0, transcript: [] } : null,
        aiAnalysis: null,
      });
      await judgeTurnWithAI(room, session, session.turnHistory.length - 1, transcript || '');
    }

    session.currentTurn = {
      speaker: nextSpeaker || currentTurn.speaker,
      phase: phase || currentTurn.phase,
      startTime: new Date(),
      timeLimit: timeLimit ?? currentTurn.timeLimit,
      timeRemaining: timeLimit ?? currentTurn.timeRemaining,
      status: 'active',
    };

    await session.save();
    sendSuccess(res, session.currentTurn, 'Turn advanced');
  }),
);

// POST /api/v1/rooms/:id/host/issue-card — Issue yellow card (UC-28)
router.post(
  '/:id/host/issue-card',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can issue cards');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    session.cards.push({
      type: 'yellow',
      issuedTo: userId,
      issuedBy: req.user!.userId as any,
      reason,
      timestamp: new Date(),
    });
    await session.save();

    sendSuccess(res, { userId, reason }, 'Yellow card issued');
  }),
);

// POST /api/v1/rooms/:id/host/kick — Kick participant from active debate (UC-29)
router.post(
  '/:id/host/kick',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can kick');

    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, room, 'Participant kicked from debate');
  }),
);

// POST /api/v1/rooms/:id/host/mute — Mute/unmute a participant (UC-30)
router.post(
  '/:id/host/mute',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action, type } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can mute participants');

    const participant = room.participants.find((p) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    const muteAction = type || action;
    if (!['mute', 'unmute'].includes(muteAction)) {
      throw new BadRequestError('Mute type must be mute or unmute');
    }

    participant.muted = muteAction === 'mute';
    await room.save();

    sendSuccess(res, { userId, muted: participant.muted }, `Participant ${participant.muted ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/rooms/:id/host/viewer-chat — Enable/disable viewer chat (UC-58)
router.post(
  '/:id/host/viewer-chat',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { enabled } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) {
      throw new ForbiddenError('Only host or owner can control viewer chat');
    }

    if (typeof enabled !== 'boolean') {
      throw new BadRequestError('enabled must be a boolean');
    }

    room.viewerChatEnabled = enabled;
    await room.save();

    getIO().to(req.params.id).emit('chat:viewer-chat-updated', {
      roomId: room._id,
      viewerChatEnabled: room.viewerChatEnabled,
    });

    sendSuccess(
      res,
      { viewerChatEnabled: room.viewerChatEnabled },
      `Viewer chat ${room.viewerChatEnabled ? 'enabled' : 'disabled'}`,
    );
  }),
);

// POST /api/v1/rooms/:id/host/transfer — Transfer human host role (UC-59)
router.post(
  '/:id/host/transfer',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const requesterId = req.user!.userId;
    const isHost = room.hostId?.toString() === requesterId;
    const isOwner = room.createdBy.toString() === requesterId;
    if (!isHost && !isOwner) {
      throw new ForbiddenError('Only host or owner can transfer host role');
    }

    if (!userId || typeof userId !== 'string') {
      throw new BadRequestError('userId is required');
    }
    if (room.hostId?.toString() === userId) {
      throw new BadRequestError('User is already the host');
    }

    const nextHost = room.participants.find((participant) => participant.userId.toString() === userId);
    if (!nextHost) throw new NotFoundError('Target participant not found');

    const previousHostId = room.hostId?.toString() || null;
    const previousHost = previousHostId
      ? room.participants.find((participant) => participant.userId.toString() === previousHostId)
      : null;

    if (previousHost && previousHost.roomRole === 'host') {
      previousHost.roomRole =
        previousHost.userId.toString() === room.createdBy.toString() ? 'owner' : 'viewer';
    }

    room.hostType = 'human';
    room.hostId = nextHost.userId as any;
    nextHost.roomRole = 'host';
    room.judges = (room.judges || []).filter(
      (judge) => judge.userId.toString() !== nextHost.userId.toString(),
    ) as any;

    await room.save();

    getIO().to(req.params.id).emit('room:host-transferred', {
      roomId: room._id,
      previousHostId,
      hostId: room.hostId,
      hostType: room.hostType,
      participants: room.participants,
    });
    getIO().to(req.params.id).emit('room:participant-update', {
      participants: room.participants,
    });

    sendSuccess(
      res,
      {
        hostId: room.hostId,
        hostType: room.hostType,
        previousHostId,
        participants: room.participants,
      },
      'Host role transferred',
    );
  }),
);

// POST /api/v1/rooms/:id/judge/submit-score — Judge submit score (UC-35)
router.post(
  '/:id/judge/submit-score',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, winner, notes } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const judge = room.participants.find(
      (participant) => participant.userId.toString() === req.user!.userId,
    );
    if (!judge || judge.roomRole !== 'judge') {
      throw new ForbiddenError('Only human judges assigned to this room can submit scores');
    }

    if (!speaker || typeof speaker !== 'string') {
      throw new BadRequestError('speaker is required');
    }
    if (winner !== undefined && !['proposition', 'opposition', 'draw'].includes(winner)) {
      throw new BadRequestError('winner must be proposition, opposition, or draw');
    }

    const scorePayload = buildJudgeScore(req.body);

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    if (!session.finalScores) {
      session.finalScores = {
        teamProposition: { total: 0, breakdown: {} },
        teamOpposition: { total: 0, breakdown: {} },
        winner: 'draw',
        aiVerdict: 'pending',
        judgeVerdicts: [],
      };
    }

    const finalScores = session.finalScores as {
      judgeVerdicts: any[];
    };
    finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];

    const existingVerdictIndex = finalScores.judgeVerdicts.findIndex(
      (verdict) =>
        verdict.judgeId?.toString() === req.user!.userId &&
        verdict.speaker === speaker,
    );

    const verdictPayload = {
      judgeId: req.user!.userId as any,
      judgeName: judge.username,
      speaker,
      winner: winner || null,
      score: scorePayload,
      notes: typeof notes === 'string' ? notes.trim() : '',
      submittedAt: new Date(),
    };

    if (existingVerdictIndex >= 0) {
      finalScores.judgeVerdicts[existingVerdictIndex] = verdictPayload;
    } else {
      finalScores.judgeVerdicts.push(verdictPayload);
    }
    const aggregatedScores = aggregateFinalScores(session);

    await session.save();

    getIO().to(req.params.id).emit('score:updated', {
      roomId: req.params.id,
      judgeId: req.user!.userId,
      speaker,
      score: scorePayload,
      winner: winner || null,
      aggregateWinner: aggregatedScores.winner,
      finalScores: aggregatedScores,
    });
    getIO().to(req.params.id).emit('score:aggregate-updated', {
      roomId: req.params.id,
      finalScores: aggregatedScores,
    });

    sendSuccess(
      res,
      {
        speaker,
        winner: winner || null,
        score: scorePayload,
        notes: verdictPayload.notes,
        finalScores: aggregatedScores,
      },
      existingVerdictIndex >= 0 ? 'Score updated' : 'Score submitted',
    );
  }),
);

// GET /api/v1/rooms/:id/scores — Get current scores for the room (UC-36)
router.get(
  '/:id/scores',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('participants judgeType');
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    const aggregatedScores = aggregateFinalScores(session);
    await session.save();

    sendSuccess(res, {
      finalScores: aggregatedScores,
      judgeVerdicts: aggregatedScores.judgeVerdicts || [],
      turnHistory: session.turnHistory,
      participants: room.participants,
    });
  }),
);

// POST /api/v1/rooms/:id/scores/aggregate — Aggregate human judges + AI scores (UC-62)
router.post(
  '/:id/scores/aggregate',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    const isJudge = room.participants.some(
      (participant) =>
        participant.userId.toString() === req.user!.userId &&
        participant.roomRole === 'judge',
    );
    if (!isHost && !isOwner && !isJudge) {
      throw new ForbiddenError('Only host, owner, or judge can aggregate scores');
    }

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const aggregatedScores = aggregateFinalScores(session);
    await session.save();

    getIO().to(req.params.id).emit('score:aggregate-updated', {
      roomId: req.params.id,
      finalScores: aggregatedScores,
    });

    sendSuccess(res, aggregatedScores, 'Scores aggregated');
  }),
);

// GET /api/v1/rooms/:id/winner — Determine winner by team totals (UC-63)
router.get(
  '/:id/winner',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('participants judgeType');
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const finalScores = aggregateFinalScores(session);
    await session.save();

    sendSuccess(res, {
      winnerTeam: finalScores.winnerTeam || finalScores.winner,
      propositionTotal: finalScores.teamProposition.total,
      oppositionTotal: finalScores.teamOpposition.total,
      finalScores,
      participants: room.participants,
    });
  }),
);

// POST /api/v1/rooms/:id/winner — Recompute and broadcast winner (UC-63)
router.post(
  '/:id/winner',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    const isJudge = room.participants.some(
      (participant) =>
        participant.userId.toString() === req.user!.userId &&
        participant.roomRole === 'judge',
    );
    if (!isHost && !isOwner && !isJudge) {
      throw new ForbiddenError('Only host, owner, or judge can determine winner');
    }

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const finalScores = aggregateFinalScores(session);
    await session.save();

    const payload = {
      roomId: req.params.id,
      winnerTeam: finalScores.winnerTeam || finalScores.winner,
      propositionTotal: finalScores.teamProposition.total,
      oppositionTotal: finalScores.teamOpposition.total,
      finalScores,
    };

    getIO().to(req.params.id).emit('score:winner-determined', payload);
    getIO().to(req.params.id).emit('score:aggregate-updated', {
      roomId: req.params.id,
      finalScores,
    });

    sendSuccess(res, payload, 'Winner determined');
  }),
);

// POST /api/v1/rooms/:id/cross-exam/pass-turn — Pass the cross-exam turn (UC-32)
router.post(
  '/:id/cross-exam/pass-turn',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, transcript } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    const now = new Date();
    const duration = now.getTime() - session.currentTurn.startTime.getTime();
    session.turnHistory.push({
      speaker: session.currentTurn.speaker,
      startTime: session.currentTurn.startTime,
      endTime: now,
      duration,
      transcript: transcript || '',
      crossExamination: { questionsAsked: 0, questionsAnswered: 0, timeRemainingPro: 0, timeRemainingOpp: 0, transcript: [] },
      aiAnalysis: null,
    });
    await judgeTurnWithAI(room, session, session.turnHistory.length - 1, transcript || '');

    session.currentTurn = {
      speaker: nextSpeaker || session.currentTurn.speaker,
      phase: 'cross_exam',
      startTime: new Date(),
      timeLimit: session.currentTurn.timeLimit,
      timeRemaining: session.currentTurn.timeRemaining,
      status: 'active',
    };

    await session.save();
    sendSuccess(res, session.currentTurn, 'Cross-exam turn passed');
  }),
);

// POST /api/v1/rooms/:id/cross-exam/finish — Finish cross-examination (UC-33)
router.post(
  '/:id/cross-exam/finish',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    session.currentTurn.status = 'completed';
    session.currentTurn.phase = 'judge_feedback';
    await session.save();

    sendSuccess(res, session.currentTurn, 'Cross-exam finished');
  }),
);

// GET /api/v1/rooms/:id/session — Get session data (UC-31)
router.get(
  '/:id/session',
  asyncHandler(async (req: Request, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    sendSuccess(res, session);
  }),
);

// GET /api/v1/rooms/:id/replay — Get replay data
router.get(
  '/:id/replay',
  asyncHandler(async (req: Request, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const room = await DebateRoom.findById(req.params.id).select('title motion format participants');
    sendSuccess(res, { room, session });
  }),
);

// POST /api/v1/rooms/:id/result — Apply final result to ranking for rank rooms
router.post(
  '/:id/result',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can finalize result');

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    aggregateFinalScores(session);
    await session.save();

    const rankingResult = await applyDebateResult(req.params.id);
    sendSuccess(res, rankingResult, rankingResult.applied ? 'Result applied' : 'Result not applied');
  }),
);

export default router;
