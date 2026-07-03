import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { roomParticipantGuard, roomHostOrOwnerGuard, roomOwnerGuard, roomControllerGuard } from '../../middleware/roomGuard.js';

const roomControllerGuardDefault = roomControllerGuard();
import { validate } from '../../middleware/validate.js';
import {
  assignParticipantSchema,
  selectPositionSchema,
  updateMotionSchema,
  updateRoomSchema,
  joinRoomSchema,
} from './room.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { User } from '../../models/User.js';
import { getIO } from '../../socket/index.js';
import { aiService } from '../ai/ai.service.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { startDebate, triggerTransition, endPhaseByHost, endPhaseBySpeaker } from '../debate/debate.service.js';
import { timerService } from '../../socket/timer.service.js';
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

function getLockableParticipantStats(room: any) {
  let lockedCount = 0;
  let lockableCount = 0;

  const canLockParticipant = (participant: any) => {
    const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

    if (!effectiveRole || effectiveRole === 'viewer') return false;
    if (!['debater', 'host', 'judge'].includes(effectiveRole)) return false;
    if (effectiveRole === 'debater' && (!participant.team || !participant.speakerSlot)) return false;

    return true;
  };

  room.participants.forEach((participant: any) => {
    if (!canLockParticipant(participant)) return;

    lockableCount += 1;
    participant.positionLocked = true;
    lockedCount += 1;
  });

  return {
    lockedCount,
    lockableCount,
    participantCount: room.participants.length,
  };
}

function getLockPositionsMessage(stats: { lockedCount: number; lockableCount: number; participantCount: number }) {
  if (stats.lockedCount === 0) {
    return `No assigned positions to lock (${stats.participantCount} participants in room)`;
  }

  return `All assigned positions locked (${stats.lockedCount}/${stats.lockableCount} required)`;
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

function getEffectiveRoomRole(participant: any) {
  return participant?.roomRole === 'owner' ? participant.primaryRole : participant?.roomRole;
}

// Returns the list of speakers expected to be scored across the full debate.
// Per docs/ruleScore.md: each round scores the Round-N speaker from each side,
// and rounds 1-2 also score cross-examination. For 3v3 the full list is:
//   PRO_S1, OPP_S1, PRO_S2, OPP_S2, PRO_S3, OPP_S3
// For 1v1 it's the single speaker from each side.
//
// Note: rounds 1 and 2 CE scores are stored on the speaker verdict (crossExam
// field), not as separate verdicts. So the expected speaker set is just the
// two speakers per round across all rounds.
function getExpectedScoringSpeakersForRoom(room: any): string[] {
  const format = room.format;
  if (format === '1v1') {
    return ['PRO_S1', 'OPP_S1'];
  }
  return ['PRO_S1', 'OPP_S1', 'PRO_S2', 'OPP_S2', 'PRO_S3', 'OPP_S3'];
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

function aggregateFinalScores(session: any, _room?: any) {
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
  const isRoundBased = verdicts.some((v: any) => v.round !== undefined);

  if (isRoundBased) {
    const judgeIds = Array.from(new Set(verdicts.map((v) => v.judgeId?.toString() || 'unknown')));
    
    let sumProp = 0;
    let sumOpp = 0;
    let validJudgesCount = 0;

    let sumPropS3 = 0;
    let sumOppS3 = 0;
    let countS3 = 0;

    let sumPropR2 = 0;
    let sumOppR2 = 0;
    let countR2 = 0;

    const judgeVotes = { proposition: 0, opposition: 0, draw: 0 };

    judgeIds.forEach((jId) => {
      const judgeVerdicts = verdicts.filter((v) => (v.judgeId?.toString() || 'unknown') === jId);
      
      let judgePropTotal = 0;
      let judgeOppTotal = 0;

      judgeVerdicts.forEach((v) => {
        const isProp = String(v.speaker).startsWith('PRO');
        // buildRoundScore stores speak in score.logic and ce in score.crossExam
        const speakVal = Number(v.score?.logic) || 0;
        const ceVal = Number(v.score?.crossExam) || 0;
        const scoreVal = speakVal + ceVal;

        if (isProp) {
          judgePropTotal += scoreVal;
        } else {
          judgeOppTotal += scoreVal;
        }

        const roundNum = Number(v.round);
        if (roundNum === 3) {
          // S3 only has speech score (no CE). Use total score for tiebreaker consistency.
          if (isProp) sumPropS3 += scoreVal;
          else sumOppS3 += scoreVal;
          countS3 += 1;
        } else if (roundNum === 2) {
          // R2: total score = speech + CE. Use full total for tiebreaker per ruleScore.md.
          if (isProp) sumPropR2 += scoreVal;
          else sumOppR2 += scoreVal;
          countR2 += 1;
        }
      });

      sumProp += judgePropTotal;
      sumOpp += judgeOppTotal;
      validJudgesCount += 1;

      if (judgePropTotal > judgeOppTotal) {
        judgeVotes.proposition += 1;
      } else if (judgePropTotal < judgeOppTotal) {
        judgeVotes.opposition += 1;
      } else {
        judgeVotes.draw += 1;
      }
    });

    const propositionTotal = validJudgesCount ? sumProp / validJudgesCount : 0;
    const oppositionTotal = validJudgesCount ? sumOpp / validJudgesCount : 0;

    // Determine which rounds have been scored across all judges
    const scoredRounds = new Set(verdicts.map((v: any) => Number(v.round)).filter((r: number) => r >= 1 && r <= 3));
    const allRoundsScored = scoredRounds.has(1) && scoredRounds.has(2) && scoredRounds.has(3);

    // Only determine winner when ALL 3 rounds have been scored
    let winnerTeam: DebateWinner | null = null;
    if (allRoundsScored) {
      const delta = propositionTotal - oppositionTotal;
      if (Math.abs(delta) < 0.01) {
        const avgPropS3 = countS3 ? sumPropS3 / countS3 : 0;
        const avgOppS3 = countS3 ? sumOppS3 / countS3 : 0;
        const s3Delta = avgPropS3 - avgOppS3;

        if (Math.abs(s3Delta) > 0.01) {
          winnerTeam = s3Delta > 0 ? 'proposition' : 'opposition';
        } else if (countR2 > 0) {
          // Tiebreaker step 2: compare Round 2 totals. Per ruleScore.md §Tie Break Rule,
          // this applies to ALL formats (1v1 and 3v3), not just 3v3.
          const avgPropR2 = sumPropR2 / countR2;
          const avgOppR2 = sumOppR2 / countR2;
          const r2Delta = avgPropR2 - avgOppR2;

          if (Math.abs(r2Delta) > 0.01) {
            winnerTeam = r2Delta > 0 ? 'proposition' : 'opposition';
          } else {
            if (judgeVotes.proposition > judgeVotes.opposition) {
              winnerTeam = 'proposition';
            } else if (judgeVotes.proposition < judgeVotes.opposition) {
              winnerTeam = 'opposition';
            } else {
              winnerTeam = 'draw';
            }
          }
        } else {
          if (judgeVotes.proposition > judgeVotes.opposition) {
            winnerTeam = 'proposition';
          } else if (judgeVotes.proposition < judgeVotes.opposition) {
            winnerTeam = 'opposition';
          } else {
            winnerTeam = 'draw';
          }
        }
      } else {
        winnerTeam = delta > 0 ? 'proposition' : 'opposition';
      }
    }

    finalScores.teamProposition = { total: propositionTotal, breakdown: {} };
    finalScores.teamOpposition = { total: oppositionTotal, breakdown: {} };
    finalScores.winner = winnerTeam as any;
    finalScores.winnerTeam = winnerTeam as any;
    finalScores.aiVerdict = null;
    finalScores.aggregatePolicy = {
      humanJudgeWeight: HUMAN_JUDGE_WEIGHT,
      aiJudgeWeight: AI_JUDGE_WEIGHT,
      method: 'round_based_average_with_tie_breakers',
      winnerMethod: allRoundsScored ? 'tie_breaker_rules_applied' : 'pending_more_rounds',
      scoredRounds: Array.from(scoredRounds),
      verdictCount: verdicts.length,
      aggregatedAt: new Date(),
    };
  } else {
    // Legacy criteria-based aggregation
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
  }

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
  aggregateFinalScores(session, room);

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
          primaryRole: 'viewer',
          muted: false,
        },
      ],
    });

    const io = getIO();
    if (io) {
      io.emit('room:update', { action: 'create', roomId: room._id.toString() });
    }

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

    // Default: show active/waiting rooms. Completed/ended matches should
    // never show up on the live list — they belong in the replay/history page.
    if (!status) {
      filter.status = { $in: ['waiting', 'ready', 'active', 'paused'] };
    } else if (status === 'completed') {
      // Explicit completed filter is allowed (for history views), but we keep
      // the broader inclusive list below just in case.
      filter.status = 'completed';
    }

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
  roomOwnerGuard,
  validate(updateRoomSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
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
    const io = getIO();
    if (io) {
      io.emit('room:update', { action: 'update', roomId: room._id.toString() });
    }
    sendSuccess(res, room, 'Room updated');
  }),
);

// DELETE /api/v1/rooms/:id — Delete room (UC-17)
router.delete(
  '/:id',
  authenticate,
  roomOwnerGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status === 'active' || room.status === 'paused') {
      throw new BadRequestError('Cannot delete a room while a debate is in progress');
    }

    await room.deleteOne();
    const io = getIO();
    if (io) {
      io.emit('room:update', { action: 'delete', roomId: room._id.toString() });
    }
    sendSuccess(res, null, 'Room deleted');
  }),
);

// POST /api/v1/rooms/:id/assign-role — Assign host/judge role (UC-22)
router.post(
  '/:id/assign-role',
  authenticate,
  roomHostOrOwnerGuard,
  validate(assignParticipantSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, role, team, speakerSlot } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) {
      throw new NotFoundError('Participant not found');
    }

    // The room creator is always 'owner' — any other role assignment is a side
    // permission, not a replacement.  The host can also assign roles.
    const isRoomCreator = participant.userId.toString() === room.createdBy.toString();

    room.judges = (room.judges || []).filter(
      (judge: any) => judge.userId.toString() !== participant.userId.toString(),
    ) as any;

    if (role === 'host') {
      const previousHost = room.hostId
        ? room.participants.find((p: any) => p.userId.toString() === room.hostId?.toString())
        : null;
      if (previousHost && previousHost.userId.toString() !== participant.userId.toString()) {
        // Previous host goes back to viewer (or owner if they were the room creator)
        const wasCreator = previousHost.userId.toString() === room.createdBy.toString();
        previousHost.roomRole = wasCreator ? 'owner' : 'viewer';
        previousHost.team = null;
        previousHost.speakerSlot = null;
        previousHost.positionLocked = false;
        if (wasCreator) previousHost.primaryRole = 'viewer';
      }
      room.hostId = participant.userId as any;
      room.hostType = 'human';
      // The room creator keeps 'owner' even while also being the host.  Anyone
      // else becomes 'host'.
      participant.roomRole = isRoomCreator ? 'owner' : 'host';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
      if (isRoomCreator) participant.primaryRole = 'host';
    }

    if (role === 'judge') {
      // The room creator cannot be demoted to judge — they keep 'owner' regardless
      participant.roomRole = isRoomCreator ? 'owner' : 'judge';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
      if (isRoomCreator) participant.primaryRole = 'judge';
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
        room.hostType = 'ai';
      }
      // Only push non-owner judges into the judges list.
      // Owner-as-judge uses effective role (primaryRole) for judge counts.
      if (!isRoomCreator) {
        room.judges.push({ userId: participant.userId as any, username: participant.username });
      }
    }

    if (role === 'debater') {
      if (team !== undefined && !['proposition', 'opposition', null].includes(team)) {
        throw new BadRequestError('Team must be proposition or opposition');
      }
      if (speakerSlot !== undefined && !['S1', 'S2', 'S3', null].includes(speakerSlot)) {
        throw new BadRequestError('speakerSlot must be S1, S2, or S3');
      }
      // The room creator cannot be demoted to debater — they keep 'owner'
      if (isRoomCreator) {
        participant.roomRole = 'owner';
        participant.primaryRole = 'debater';
      } else {
        participant.roomRole = 'debater';
        participant.primaryRole = null;
      }
      participant.team = team ?? null;
      participant.speakerSlot = speakerSlot ?? null;
      if (participant.team && participant.speakerSlot) {
        const slotTaken = room.participants.some((p: any) =>
          p.userId.toString() !== participant.userId.toString() &&
          getEffectiveRoomRole(p) === 'debater' &&
          p.team === participant.team &&
          p.speakerSlot === participant.speakerSlot,
        );
        if (slotTaken) throw new BadRequestError('Speaker slot is already taken');
      }
      participant.positionLocked = false;
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
        room.hostType = 'ai';
      }
    }

    if (role === 'viewer') {
      // The room creator always keeps 'owner' — they are never just a viewer
      participant.roomRole = isRoomCreator ? 'owner' : 'viewer';
      participant.team = null;
      participant.speakerSlot = null;
      participant.positionLocked = false;
      if (isRoomCreator) participant.primaryRole = 'viewer';
      if (room.hostId?.toString() === participant.userId.toString()) {
        room.hostId = null;
        room.hostType = 'ai';
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
  validate(joinRoomSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('+password');
    if (!room) throw new NotFoundError('Room not found');
    if (!['waiting', 'ready', 'active', 'paused'].includes(room.status)) {
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
  roomParticipantGuard(),
  validate(selectPositionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { team, speakerSlot } = req.body;
    const room = (req as any).room;
    const participant = (req as any).participant;
    if (participant.positionLocked) throw new BadRequestError('Position is locked');
    if (getEffectiveRoomRole(participant) !== 'debater') {
      throw new ForbiddenError('Only assigned debaters can select team and speaker slot');
    }

    const slotTaken = room.participants.some((p: any) =>
      p.userId.toString() !== participant.userId.toString() &&
      getEffectiveRoomRole(p) === 'debater' &&
      p.team === team &&
      p.speakerSlot === speakerSlot,
    );
    if (slotTaken) throw new BadRequestError('Speaker slot is already taken');

    if (team) participant.team = team;
    if (speakerSlot) participant.speakerSlot = speakerSlot;

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, room, 'Position updated');
  }),
);

// POST /api/v1/rooms/:id/position/lock — Lock positions (UC-19, Owner only)
// Locks assigned participants: debaters, human host, and judges. A room owner
// is lockable only after being explicitly assigned one of those roles.
router.post(
  '/:id/position/lock',
  authenticate,
  roomOwnerGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const stats = getLockableParticipantStats(room);
    room.status = room.status === 'waiting' ? 'ready' : room.status;
    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, { room, ...stats }, getLockPositionsMessage(stats));
  }),
);

// POST /api/v1/rooms/:id/lock — Alias for checklist/Postman compatibility
router.post(
  '/:id/lock',
  authenticate,
  roomOwnerGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const stats = getLockableParticipantStats(room);
    room.status = room.status === 'waiting' ? 'ready' : room.status;
    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, { room, ...stats }, getLockPositionsMessage(stats));
  }),
);

// POST /api/v1/rooms/:id/position/unlock — Unlock all positions (Owner only)
router.post(
  '/:id/position/unlock',
  authenticate,
  roomOwnerGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const canLockParticipant = (participant: any) => {
      const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

      if (!effectiveRole || effectiveRole === 'viewer') return false;
      if (!['debater', 'host', 'judge'].includes(effectiveRole)) return false;
      if (effectiveRole === 'debater' && (!participant.team || !participant.speakerSlot)) return false;

      return true;
    };

    let unlockedCount = 0;
    room.participants.forEach((participant: any) => {
      if (!participant.positionLocked) return;
      if (!canLockParticipant(participant)) return;
      participant.positionLocked = false;
      unlockedCount += 1;
    });

    // If positions were unlocked, roll status back to 'waiting' so the owner
    // can reconfigure the room before starting.
    if (unlockedCount > 0 && room.status === 'ready') {
      room.status = 'waiting';
    }

    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(
      res,
      { room, unlockedCount },
      unlockedCount === 0
        ? 'No positions were locked'
        : `Unlocked ${unlockedCount} participant${unlockedCount === 1 ? '' : 's'}`,
    );
  }),
);

// POST /api/v1/rooms/:id/position/lock-user — Toggle a single participant's lock (Owner only)
const toggleLockSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  locked: z.boolean(),
});

router.post(
  '/:id/position/lock-user',
  authenticate,
  roomOwnerGuard,
  validate(toggleLockSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    const { userId, locked } = req.body;

    const canLockParticipant = (participant: any) => {
      const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

      if (!effectiveRole || effectiveRole === 'viewer') return false;
      if (!['debater', 'host', 'judge'].includes(effectiveRole)) return false;
      if (effectiveRole === 'debater' && (!participant.team || !participant.speakerSlot)) return false;

      return true;
    };

    const target = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!target) throw new NotFoundError('Participant not found in room');
    if (!canLockParticipant(target)) {
      throw new BadRequestError('This participant cannot be locked');
    }

    target.positionLocked = locked;
    await room.save();
    await broadcastRoomState(room._id.toString());
    sendSuccess(res, { room, userId, locked }, locked ? 'Position locked' : 'Position unlocked');
  }),
);

// POST /api/v1/rooms/:id/start — Start debate (UC-22)
router.post(
  '/:id/start',
  authenticate,
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await startDebate(req.params.id, (req as any).participant.userId.toString());

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
    if (io) {
      io.emit('room:update', { action: 'start', roomId: roomIdStr });
    }

    sendSuccess(res, result, 'Debate started');
  }),
);

// POST /api/v1/rooms/:id/host/motion — Host/owner selects debate topic before start
router.post(
  '/:id/host/motion',
  authenticate,
  roomControllerGuardDefault,
  validate(updateMotionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (!['waiting', 'ready'].includes(room.status)) {
      throw new BadRequestError('Cannot update the topic after the debate has started');
    }

    room.motion = req.body.motion;
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
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    const userId = req.user!.userId;
    const { newOwnerId } = req.body;

    const isOwner = room.createdBy.toString() === userId;

    // 1. Remove from participants
    room.participants = room.participants.filter(
      (p: any) => p.userId.toString() !== userId,
    ) as any;

    if (room.participants.length === 0) {
      await room.deleteOne();
      sendSuccess(res, null, 'Left room and deleted room as it became empty');
      return;
    }

    // 2. Clear host status if leaving user was the host
    if (room.hostId?.toString() === userId) {
      room.hostId = null;
      room.hostType = 'ai';
    }

    // 3. Remove from judges if leaving user was a judge
    room.judges = (room.judges || []).filter(
      (j: any) => j.userId.toString() !== userId,
    ) as any;

    // 4. Handle owner transfer
    if (isOwner && room.participants.length > 0) {
      let successor = null;
      if (newOwnerId) {
        successor = room.participants.find(
          (p: any) => p.userId.toString() === newOwnerId.toString(),
        );
      }
      if (!successor) {
        successor = room.participants[0];
      }

      if (successor) {
        room.createdBy = successor.userId;
        const prevRole = successor.roomRole;
        successor.roomRole = 'owner';

        if (prevRole === 'debater') {
          successor.primaryRole = 'debater';
        } else if (prevRole === 'host') {
          successor.primaryRole = 'host';
          room.hostId = successor.userId;
        } else if (prevRole === 'judge') {
          successor.primaryRole = 'judge';
        } else {
          successor.primaryRole = 'viewer';
        }
      }
    }

    await room.save();
    await broadcastRoomState(room._id.toString());

    sendSuccess(res, null, 'Left room');
  }),
);

// POST /api/v1/rooms/:id/kick — Kick participant (UC-24)
router.post(
  '/:id/kick',
  authenticate,
  roomOwnerGuard,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const { userId } = req.body;

    // 1. Remove from participants
    room.participants = room.participants.filter(
      (p: any) => p.userId.toString() !== userId,
    ) as any;

    // 2. Clear host status if kicked user was the host
    if (room.hostId?.toString() === userId) {
      room.hostId = null;
      room.hostType = 'ai';
    }

    // 3. Remove from judges if kicked user was a judge
    room.judges = (room.judges || []).filter(
      (j: any) => j.userId.toString() !== userId,
    ) as any;

    // 4. Invalidate ready state — kick can remove a required role
    // (host, judge, or S1 debater), making the room unsafe to start.
    if (room.status === 'ready') {
      room.status = 'waiting';
    }

    await room.save();
    await broadcastRoomState(room._id.toString());

    sendSuccess(res, room, 'Participant kicked');
  }),
);

// POST /api/v1/rooms/:id/host/pause — Pause debate (UC-25)
router.post(
  '/:id/host/pause',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'active') {
      throw new BadRequestError('Room is not active');
    }

    room.status = 'paused';
    await room.save();

    // Determine correct timer based on active phase
    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.pauseType = 'host';
      session.pausedAt = new Date();
      await session.save();
    }

    const isCrossExam = session?.currentTurn?.phase === 'cross_exam';
    let timeRemaining = 0;
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.pause(room._id.toString());
      const ceState = ceTimerService.getState(room._id.toString());
      if (ceState) {
        timeRemaining = ceState.sharedRemaining;
      }
    } else {
      timerService.pause(req.params.id);
      timeRemaining = timerService.getTimeRemaining(req.params.id);
    }

    // Broadcast pause to every client so they show a synchronized overlay.
    const io = getIO();
    io.to(req.params.id).emit('debate:paused', {
      pausedAt: Date.now(),
      timeRemaining,
      pauseType: 'host',
      pausesUsed: session?.pausesUsed || { proposition: 0, opposition: 0 },
    });

    sendSuccess(res, { status: room.status }, 'Debate paused');
  }),
);

// POST /api/v1/rooms/:id/host/resume — Resume debate (UC-26)
router.post(
  '/:id/host/resume',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    if (room.status !== 'paused') {
      throw new BadRequestError('Room is not paused');
    }

    room.status = 'active';
    await room.save();

    // Determine correct timer based on active phase
    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.pauseType = null;
      session.pausedAt = null;
      await session.save();
    }

    const isCrossExam = session?.currentTurn?.phase === 'cross_exam';
    if (isCrossExam) {
      const { ceTimerService } = await import('../../socket/ce.socket.js');
      ceTimerService.resume(room._id.toString());
    } else {
      timerService.resume(req.params.id);
    }

    // Broadcast resume to every client
    const io = getIO();
    io.to(req.params.id).emit('debate:resumed', {
      resumedAt: Date.now(),
    });

    sendSuccess(res, { status: room.status }, 'Debate resumed');
  }),
);

// POST /api/v1/rooms/:id/host/next-turn — Advance the debate turn (UC-27)
router.post(
  '/:id/host/next-turn',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await triggerTransition(req.params.id, req.body.transcript || '');
    sendSuccess(res, { transitioning: true }, 'Turn advanced transition started');
  }),
);

// POST /api/v1/rooms/:id/host/issue-card — Issue yellow card (UC-28)
router.post(
  '/:id/host/issue-card',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = (req as any).room;

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
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = (req as any).room;

    room.participants = room.participants.filter(
      (p: any) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, room, 'Participant kicked from debate');
  }),
);

// POST /api/v1/rooms/:id/host/mute — Mute/unmute a participant (UC-30)
router.post(
  '/:id/host/mute',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action, type } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    const muteAction = type || action;
    if (!['mute', 'unmute'].includes(muteAction)) {
      throw new BadRequestError('Mute type must be mute or unmute');
    }

    participant.muted = muteAction === 'mute';
    await room.save();

    const io = getIO();
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
    if (state) {
      io.to(room._id.toString()).emit('room:state-restore', state);
    }

    sendSuccess(res, { userId, muted: participant.muted }, `Participant ${participant.muted ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/rooms/:id/host/mute-chat — Mute/unmute participant chat
router.post(
  '/:id/host/mute-chat',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action, type } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    const muteAction = type || action;
    if (!['mute', 'unmute'].includes(muteAction)) {
      throw new BadRequestError('Mute action must be mute or unmute');
    }

    participant.chatMuted = muteAction === 'mute';
    await room.save();

    const io = getIO();
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
    if (state) {
      io.to(room._id.toString()).emit('room:state-restore', state);
    }

    sendSuccess(res, { userId, chatMuted: participant.chatMuted }, `Participant chat ${participant.chatMuted ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/rooms/:id/host/mute-camera — Mute/unmute participant camera
router.post(
  '/:id/host/mute-camera',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action, type } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    const muteAction = type || action;
    if (!['mute', 'unmute'].includes(muteAction)) {
      throw new BadRequestError('Mute action must be mute or unmute');
    }

    participant.cameraMuted = muteAction === 'mute';
    await room.save();

    const io = getIO();
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
    if (state) {
      io.to(room._id.toString()).emit('room:state-restore', state);
    }

    // Also broadcast video host-toggle event for WebRTC live update
    io.to(room._id.toString()).emit('video:host-toggle', {
      userId: participant.userId.toString(),
      active: muteAction === 'unmute',
      byUserId: req.user!.userId,
    });

    sendSuccess(res, { userId, cameraMuted: participant.cameraMuted }, `Participant camera ${participant.cameraMuted ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/rooms/:id/host/viewer-chat — Enable/disable viewer chat (UC-58)
router.post(
  '/:id/host/viewer-chat',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { enabled } = req.body;
    const room = (req as any).room;

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
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = (req as any).room;

    if (!userId || typeof userId !== 'string') {
      throw new BadRequestError('userId is required');
    }
    if (room.hostId?.toString() === userId) {
      throw new BadRequestError('User is already the host');
    }

    const nextHost = room.participants.find((participant: any) => participant.userId.toString() === userId);
    if (!nextHost) throw new NotFoundError('Target participant not found');

    const previousHostId = room.hostId?.toString() || null;
    const previousHost = previousHostId
      ? room.participants.find((participant: any) => participant.userId.toString() === previousHostId)
      : null;

    if (previousHost && previousHost.roomRole === 'host') {
      previousHost.roomRole =
        previousHost.userId.toString() === room.createdBy.toString() ? 'owner' : 'viewer';
    }

    room.hostType = 'human';
    room.hostId = nextHost.userId as any;
    nextHost.roomRole = 'host';
    room.judges = (room.judges || []).filter(
      (judge: any) => judge.userId.toString() !== nextHost.userId.toString(),
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
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, winner, notes, logic, rebuttal, evidence, crossExam, strategy, communication } = req.body;
    const room = (req as any).room;

    const judge = (req as any).participant;
    if (getEffectiveRoomRole(judge) !== 'judge') {
      throw new ForbiddenError('Only human judges assigned to this room can submit scores');
    }

    const scorePayload = buildJudgeScore({ logic, rebuttal, evidence, crossExam, strategy, communication });

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
    // Mongoose doesn't detect changes inside embedded mixed-type subdocuments
    // by default — mark the field so the next save() persists the new verdicts.
    session.markModified('finalScores');
    const aggregatedScores = aggregateFinalScores(session, room);

    // Determine if we should automatically complete the debate
    const assignedJudges = room.participants.filter((p: any) => getEffectiveRoomRole(p) === 'judge');
    const isOPPS3 = speaker === 'OPP_S3';
    
    const OPP_S3_verdicts = finalScores.judgeVerdicts.filter((v: any) => v.speaker === 'OPP_S3');
    const uniqueJudgesSubmitted = new Set(OPP_S3_verdicts.map((v: any) => v.judgeId?.toString()));
    const allJudgesSubmitted = assignedJudges.every((j: any) => uniqueJudgesSubmitted.has(j.userId.toString()));

    let autoCompleted = false;
    let winnerInfo = null;

    if (isOPPS3 && allJudgesSubmitted && assignedJudges.length > 0) {
      session.currentTurn.status = 'completed';
      session.currentTurn.phase = 'completed';

      room.status = 'completed';
      room.currentPhase = 'completed';
      room.endedAt = new Date();
      await room.save();

      autoCompleted = true;
      winnerInfo = {
        roomId: room._id.toString(),
        winnerTeam: aggregatedScores.winner,
        propositionTotal: aggregatedScores.teamProposition.total,
        oppositionTotal: aggregatedScores.teamOpposition.total,
        finalScores: aggregatedScores,
      };
    }

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

    if (autoCompleted && winnerInfo) {
      // Apply Elo/rankings result
      await applyDebateResult(room._id.toString()).catch((err) => {
        console.error('Failed to apply debate Elo result:', err);
      });

      const io = getIO();
      // Broadcast winner determined & ended
      io.to(room._id.toString()).emit('score:winner-determined', winnerInfo);
      io.to(room._id.toString()).emit('debate:ended', { roomId: room._id.toString(), result: winnerInfo });

      // Build and broadcast room state restore
      const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
      const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
      if (state) {
        io.to(room._id.toString()).emit('room:state-restore', state);
      }
    }

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

// Helper: convert new round-based scores { speak, ce, notes } into the legacy
// ScoreBreakdown shape so the existing aggregation logic keeps working without
// any data migration. speak maps to overall speech quality (split across the
// non-CE criteria); ce maps directly to crossExam.
// Per ruleScore.md §Final Summary: Round 3 has no cross-examination.
function buildRoundScore(input: { speak: number; ce: number }, round?: number) {
  const speakClamped = clampScore(input.speak, 20);
  // R3 has no CE per rule: ignore CE score
  const ceClamped = round === 3 ? 0 : clampScore(input.ce, 20);

  const score = {
    logic: speakClamped,
    rebuttal: 0,
    evidence: 0,
    crossExam: ceClamped,
    strategy: 0,
    communication: 0,
    overall: 0,
  };
  score.overall = speakClamped + ceClamped;
  return score;
}

// POST /api/v1/rooms/:id/judge/submit-round-scores — Round-based judge eval
// Payload:
//   { round: 1 | 2 | 3,
//     proposition: { speaker: 'PRO_S1' | 'PRO_S2' | 'PRO_S3', speak: 0-20, ce: 0-20, notes },
//     opposition: { speaker: 'OPP_S1' | 'OPP_S2' | 'OPP_S3', speak: 0-20, ce: 0-20, notes } }
//
// In Round 3, `ce` is ignored (Round 3 has no cross-examination).
//
// Records two judgeVerdicts (one per team) and triggers the same auto-complete
// logic as the legacy submit-score endpoint (only when the OPP_S3 speaker is
// involved AND all assigned judges have submitted).
router.post(
  '/:id/judge/submit-round-scores',
  authenticate,
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { round, proposition, opposition } = req.body as {
      round?: number;
      proposition?: { speaker?: string; speak?: number; ce?: number; notes?: string };
      opposition?: { speaker?: string; speak?: number; ce?: number; notes?: string };
    };

    if (!round || ![1, 2, 3].includes(round)) {
      throw new BadRequestError('round must be 1, 2, or 3');
    }
    if (!proposition || !opposition) {
      throw new BadRequestError('Both proposition and opposition scores are required');
    }

    const room = (req as any).room;
    const judge = (req as any).participant;
    if (getEffectiveRoomRole(judge) !== 'judge') {
      throw new ForbiddenError('Only human judges assigned to this room can submit scores');
    }

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
    const finalScores = session.finalScores as { judgeVerdicts: any[] };
    finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];

    const submissions: Array<{ team: 'proposition' | 'opposition'; speaker: string; payload: any }> = [];

    // Validate + push proposition verdict
    const propSpeaker = proposition.speaker;
    if (!propSpeaker || !propSpeaker.startsWith('PRO_')) {
      throw new BadRequestError('proposition.speaker must be a PRO_ speaker turn');
    }
    const propScore = buildRoundScore({ speak: Number(proposition.speak) || 0, ce: Number(proposition.ce) || 0 }, round);
    submissions.push({
      team: 'proposition',
      speaker: propSpeaker,
      payload: {
        judgeId: req.user!.userId as any,
        judgeName: judge.username,
        speaker: propSpeaker,
        winner: null,
        score: propScore,
        notes: typeof proposition.notes === 'string' ? proposition.notes.trim() : '',
        round,
        submittedAt: new Date(),
      },
    });

    // Validate + push opposition verdict
    const oppSpeaker = opposition.speaker;
    if (!oppSpeaker || !oppSpeaker.startsWith('OPP_')) {
      throw new BadRequestError('opposition.speaker must be an OPP_ speaker turn');
    }
    const oppScore = buildRoundScore({ speak: Number(opposition.speak) || 0, ce: Number(opposition.ce) || 0 }, round);
    submissions.push({
      team: 'opposition',
      speaker: oppSpeaker,
      payload: {
        judgeId: req.user!.userId as any,
        judgeName: judge.username,
        speaker: oppSpeaker,
        winner: null,
        score: oppScore,
        notes: typeof opposition.notes === 'string' ? opposition.notes.trim() : '',
        round,
        submittedAt: new Date(),
      },
    });

    // Upsert verdicts
    submissions.forEach(({ payload }) => {
      const existingIndex = finalScores.judgeVerdicts.findIndex(
        (v: any) =>
          v.judgeId?.toString() === req.user!.userId &&
          v.speaker === payload.speaker,
      );
      if (existingIndex >= 0) {
        finalScores.judgeVerdicts[existingIndex] = payload;
      } else {
        finalScores.judgeVerdicts.push(payload);
      }
    });
    // Mongoose doesn't detect changes inside embedded mixed-type subdocuments
    // by default — mark the field so the next save() persists the new verdicts.
    session.markModified('finalScores');

    const aggregatedScores = aggregateFinalScores(session, room);

    // Auto-complete the debate only when:
    // 1. OPP_S3 speaker was submitted in this round (last round per scoring rules)
    // 2. ALL assigned judges have submitted verdicts for ALL rounds
    //    (every expected speaker scored by every judge — partial scores would
    //    skew the team averages)
    const assignedJudges = room.participants.filter((p: any) => getEffectiveRoomRole(p) === 'judge');
    const involvesOPPS3 = submissions.some((s) => s.speaker === 'OPP_S3');
    const expectedSpeakers = getExpectedScoringSpeakersForRoom(room);
    const verdictByJudgeAndSpeaker = new Map<string, number>();
    (finalScores.judgeVerdicts || []).forEach((v: any) => {
      const key = `${v.judgeId?.toString() || 'unknown'}::${v.speaker}`;
      verdictByJudgeAndSpeaker.set(key, (verdictByJudgeAndSpeaker.get(key) || 0) + 1);
    });
    const allJudgesSubmitted =
      assignedJudges.length > 0 &&
      assignedJudges.every((j: any) =>
        expectedSpeakers.every((sp) => {
          const cnt = verdictByJudgeAndSpeaker.get(`${j.userId.toString()}::${sp}`) || 0;
          return cnt > 0;
        }),
      );

    let autoCompleted = false;
    let winnerInfo: any = null;

    if (involvesOPPS3 && allJudgesSubmitted) {
      session.currentTurn.status = 'completed';
      session.currentTurn.phase = 'completed';
      room.status = 'completed';
      room.currentPhase = 'completed';
      room.endedAt = new Date();
      await room.save();
      autoCompleted = true;
      winnerInfo = {
        roomId: room._id.toString(),
        winnerTeam: aggregatedScores.winner,
        propositionTotal: aggregatedScores.teamProposition.total,
        oppositionTotal: aggregatedScores.teamOpposition.total,
        finalScores: aggregatedScores,
      };
    }

    await session.save();

    const io = getIO();
    submissions.forEach(({ speaker }) => {
      io?.to(room._id.toString()).emit('score:updated', {
        roomId: room._id.toString(),
        judgeId: req.user!.userId,
        speaker,
        score: speaker.startsWith('PRO_') ? propScore : oppScore,
      });
    });
    io?.to(room._id.toString()).emit('score:aggregate-updated', {
      roomId: room._id.toString(),
      finalScores: aggregatedScores,
    });

    if (autoCompleted && winnerInfo) {
      await applyDebateResult(room._id.toString()).catch((err) => {
        console.error('Failed to apply debate Elo result:', err);
      });
      io?.to(room._id.toString()).emit('score:winner-determined', winnerInfo);
      io?.to(room._id.toString()).emit('debate:ended', { roomId: room._id.toString(), result: winnerInfo });

      const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
      const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
      if (state) io?.to(room._id.toString()).emit('room:state-restore', state);
    }

    sendSuccess(
      res,
      {
        round,
        proposition: { speaker: propSpeaker, score: propScore, notes: submissions[0].payload.notes },
        opposition: { speaker: oppSpeaker, score: oppScore, notes: submissions[1].payload.notes },
        finalScores: aggregatedScores,
        autoCompleted,
      },
      autoCompleted ? 'Round scores submitted and debate ended' : 'Round scores submitted',
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
    const aggregatedScores = aggregateFinalScores(session, room);
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
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const participant = (req as any).participant;
    const effectiveRole = getEffectiveRoomRole(participant);
    const isOwner = participant?.roomRole === 'owner';
    const isHost = effectiveRole === 'host';
    const isJudge = effectiveRole === 'judge';
    if (!isOwner && !isHost && !isJudge) {
      throw new ForbiddenError('Only host, owner, or judge can aggregate scores');
    }

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const room = (req as any).room;
    const aggregatedScores = aggregateFinalScores(session, room);
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

    const finalScores = aggregateFinalScores(session, room);
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

    const finalScores = aggregateFinalScores(session, room);
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
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, transcript } = req.body;
    const room = (req as any).room;
    const participant = (req as any).participant;
    if (!participant) throw new ForbiddenError('You are not in this room');
    if (!participant.team) throw new ForbiddenError('Participant must be on a team');

    const session = await DebateSession.findOne({ roomId: room._id });
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
  roomParticipantGuard(),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;
    const participant = (req as any).participant;
    if (!participant) throw new ForbiddenError('You are not in this room');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }
    if (session.currentTurn.phaseStatus !== 'active') {
      throw new BadRequestError('Cross-examination is not active');
    }

    // Require team membership or controller (host/owner) to finish CE
    const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
    const isController = participant.roomRole === 'owner' || effectiveRole === 'host';
    const isAskingTeam = participant.team === session.currentTurn.ceState?.askingTeam;
    if (!isController && !isAskingTeam) {
      throw new ForbiddenError('Only the asking team or host can finish cross-examination');
    }

    session.currentTurn.status = 'completed';
    session.currentTurn.phase = 'judge_feedback';
    await session.save();

    // Broadcast phase change so frontend exits cross-exam UI
    getIO().to(room._id.toString()).emit('debate:phase-change', {
      phase: 'judge_feedback',
      phaseStatus: 'active',
      speaker: 'JUDGES_FB_1',
      announcement: 'End of Round',
    });
    getIO().to(room._id.toString()).emit('debate:turn-status-change', { turnStatus: 'active', phaseStatus: 'active' });

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
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    const room = (req as any).room;
    aggregateFinalScores(session, room);
    await session.save();

    const rankingResult = await applyDebateResult(req.params.id);
    sendSuccess(res, rankingResult, rankingResult.applied ? 'Result applied' : 'Result not applied');
  }),
);

// POST /api/v1/rooms/:id/host/start-phase — Start the waiting phase
router.post(
  '/:id/host/start-phase',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    if (session.currentTurn.status !== 'waiting_to_start') {
      throw new BadRequestError('Current phase is already started or active');
    }

    if (session.currentTurn.phase === 'motion') {
      // Transition from 'motion' to the next step ('prep_7') immediately
      const { getFlow, getStepIndex, applyStep } = await import('../debate/debate.service.js');
      const flow = getFlow((room.format as '1v1' | '3v3') || '3v3', (room.hostType as 'human' | 'ai') || undefined);
      const currentIndex = getStepIndex(flow, session.currentTurn.speaker, session.currentTurn.phase);
      const nextStep = flow[Math.min(currentIndex + 1, flow.length - 1)];
      applyStep(session, nextStep);
      room.currentPhase = nextStep.phase;
      await room.save();
    }

    // Set status='active' AND phaseStatus='active' so that endPhaseBySpeaker
    // / endPhaseByHost guards accept Skip actions while a phase is running.
    session.currentTurn.status = 'active';
    session.currentTurn.phaseStatus = 'active';
    session.currentTurn.startTime = new Date(Date.now() + 3000);
    await session.save();

    // Start timer ticking after a 3s countdown delay
    const io = getIO();
    io.to(room._id.toString()).emit('debate:countdown-start', { durationMs: 3000 });

    setTimeout(async () => {
      try {
        const freshSession = await DebateSession.findOne({ roomId: room._id });
        if (!freshSession || freshSession.currentTurn.status !== 'active') return;

        const phase = freshSession.currentTurn.phase;
        const timeLimit = freshSession.currentTurn.timeLimit;

        freshSession.currentTurn.timeRemaining = timeLimit;
        await freshSession.save();

        if (phase === 'cross_exam') {
          const { initCEForRoom, startCEForRoom } = await import('../../socket/ce.socket.js');
          initCEForRoom(room._id.toString());
          startCEForRoom(room._id.toString());
        } else {
          timerService.start(room._id.toString(), timeLimit, phase, () => {
            triggerTransition(room._id.toString()).catch(console.error);
          });
        }

        // Broadcast debate:phase-started
        io.to(room._id.toString()).emit('debate:phase-started', {
          phase,
          speaker: freshSession.currentTurn.speaker,
          timeLimit,
        });

        const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
        const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
        if (state) {
          io.to(room._id.toString()).emit('room:state-restore', state);
        }
      } catch (err) {
        console.error('Delayed start-phase REST error:', err);
      }
    }, 3000);

    sendSuccess(res, session.currentTurn, 'Phase start countdown triggered');
  }),
);

// POST /api/v1/rooms/:id/host/grant-speaking — Grant speaking permission to a viewer
router.post(
  '/:id/host/grant-speaking',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    participant.speakingAllowed = true;
    participant.muted = false;
    await room.save();

    const io = getIO();
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
    if (state) {
      io.to(room._id.toString()).emit('room:state-restore', state);
    }

    sendSuccess(res, { userId, speakingAllowed: true }, 'Granted speaking permission to viewer');
  }),
);

// POST /api/v1/rooms/:id/host/revoke-speaking — Revoke speaking permission from a viewer
router.post(
  '/:id/host/revoke-speaking',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = (req as any).room;

    const participant = room.participants.find((p: any) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    participant.speakingAllowed = false;
    participant.muted = true;
    await room.save();

    const io = getIO();
    const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
    const state = await buildRoomStatePayload(room._id.toString(), req.user!.userId);
    if (state) {
      io.to(room._id.toString()).emit('room:state-restore', state);
    }

    sendSuccess(res, { userId, speakingAllowed: false }, 'Revoked speaking permission from viewer');
  }),
);

// POST /api/v1/rooms/:id/host/end-phase — End phase by host (UC-27)
router.post(
  '/:id/host/end-phase',
  authenticate,
  roomControllerGuardDefault,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = (req as any).room;

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    if (session.currentTurn.status === 'completed') {
      throw new BadRequestError('Debate is already completed');
    }

    // endPhaseByHost → triggerTransition handles timer stop, timer-update(0),
    // transition-start, and mute-lock synchronously. Don't pre-emit mute-lock
    // here because that would race with the transition events.
    const result = await endPhaseByHost(req.params.id, req.user!.userId, req.body.transcript || '');

    // Emit state restore after transition so any late UI subscriptions sync up.
    const io = getIO();
    setTimeout(async () => {
      const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
      const state = await buildRoomStatePayload(req.params.id, req.user!.userId);
      if (state) {
        io.to(req.params.id).emit('room:state-restore', state);
      }
    }, 3500);

    sendSuccess(res, result, 'Phase ended');
  }),
);

// POST /api/v1/rooms/:id/speaker/end-phase — End phase by speaker (debater ends their speech early)
router.post(
  '/:id/speaker/end-phase',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    if (session.currentTurn.status === 'completed') {
      throw new BadRequestError('Debate is already completed');
    }

    // endPhaseBySpeaker → triggerTransition handles timer stop, timer-update(0),
    // transition-start, and mute-lock synchronously. Don't pre-emit mute-lock
    // here because that would race with the transition events.
    const result = await endPhaseBySpeaker(req.params.id, req.user!.userId, req.body.transcript || '');

    // Emit state restore after transition so any late UI subscriptions sync up.
    const io = getIO();
    setTimeout(async () => {
      const { buildRoomStatePayload } = await import('../../socket/room.socket.js');
      const state = await buildRoomStatePayload(req.params.id, req.user!.userId);
      if (state) {
        io.to(req.params.id).emit('room:state-restore', state);
      }
    }, 3500);

    sendSuccess(res, result, 'Phase ended by speaker');
  }),
);

export default router;
