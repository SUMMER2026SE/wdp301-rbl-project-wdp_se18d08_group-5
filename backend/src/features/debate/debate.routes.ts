import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/AppError.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import {
  advanceTurn,
  endDebate,
  finishCe,
  finishPhase,
  passCeTurn,
  requestDraw,
  surrenderDebate,
} from './debate.service.js';
import type { AuthRequest } from '../../types/index.js';
import {
  cePassTurnSchema,
  endDebateSchema,
  hostNextTurnSchema,
  issueCardSchema,
  judgeSubmitScoreSchema,
  legacyCrossExamPassSchema,
  muteParticipantSchema,
  participantActionSchema,
  transcriptBodySchema,
} from './debate.schema.js';

const router = Router();

// POST /api/v1/debate/:roomId/next-turn — Advance turn using the debate flow
router.post(
  '/:roomId/next-turn',
  authenticate,
  validate(transcriptBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await advanceTurn(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Turn advanced');
  }),
);

// POST /api/v1/debate/:roomId/finish-phase — Finish current phase and enter the next one
router.post(
  '/:roomId/finish-phase',
  authenticate,
  validate(transcriptBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await finishPhase(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Phase finished');
  }),
);

// POST /api/v1/debate/:roomId/ce/pass-turn — Pass CE turn for asking team
router.post(
  '/:roomId/ce/pass-turn',
  authenticate,
  validate(cePassTurnSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await passCeTurn(req.params.roomId, req.user!.userId, req.body.content || '');
    sendSuccess(res, result, 'Cross-exam turn passed');
  }),
);

// POST /api/v1/debate/:roomId/ce/finish — Finish CE phase
router.post(
  '/:roomId/ce/finish',
  authenticate,
  validate(transcriptBodySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await finishCe(req.params.roomId, req.user!.userId, req.body.transcript || '');
    sendSuccess(res, result, 'Cross-exam finished');
  }),
);

// POST /api/v1/debate/:roomId/end — Complete debate and apply ranking when eligible
router.post(
  '/:roomId/end',
  authenticate,
  validate(endDebateSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await endDebate(req.params.roomId, req.user!.userId, req.body.summary || '');
    sendSuccess(res, result, 'Debate completed');
  }),
);

// POST /api/v1/debate/:roomId/surrender — Debater forfeits the match
router.post(
  '/:roomId/surrender',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await surrenderDebate(req.params.roomId, req.user!.userId);
    sendSuccess(res, result, 'Debate surrendered');
  }),
);

// POST /api/v1/debate/:roomId/draw/request — Debater requests a draw
router.post(
  '/:roomId/draw/request',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await requestDraw(req.params.roomId, req.user!.userId);
    sendSuccess(res, result, 'Draw requested');
  }),
);

// POST /api/v1/debate/:roomId/host/pause — Pause debate (UC-44)
router.post(
  '/:roomId/host/pause',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can pause');

    room.status = 'paused';
    await room.save();

    sendSuccess(res, { status: 'paused' }, 'Debate paused');
  }),
);

// POST /api/v1/debate/:roomId/host/resume — Resume debate
router.post(
  '/:roomId/host/resume',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can resume');

    room.status = 'active';
    await room.save();

    sendSuccess(res, { status: 'active' }, 'Debate resumed');
  }),
);

// POST /api/v1/debate/:roomId/host/issue-card — Issue yellow card (UC-45)
router.post(
  '/:roomId/host/issue-card',
  authenticate,
  validate(issueCardSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can issue cards');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (session) {
      session.cards.push({
        type: 'yellow',
        issuedTo: userId,
        issuedBy: req.user!.userId as any,
        reason,
        timestamp: new Date(),
      });
      await session.save();
    }

    sendSuccess(res, { type: 'yellow', userId, reason }, 'Card issued');
  }),
);

// POST /api/v1/debate/:roomId/host/kick — Kick from active debate (UC-46)
router.post(
  '/:roomId/host/kick',
  authenticate,
  validate(participantActionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can kick');

    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, null, 'Participant kicked');
  }),
);

// POST /api/v1/debate/:roomId/host/next-turn — Advance the debate turn (UC-45)
router.post(
  '/:roomId/host/next-turn',
  authenticate,
  validate(hostNextTurnSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, phase, timeLimit } = req.body;
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can advance turns');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    const currentTurn = session.currentTurn;
    const now = new Date();
    const duration = now.getTime() - currentTurn.startTime.getTime();
    session.turnHistory.push({
      speaker: currentTurn.speaker,
      startTime: currentTurn.startTime,
      endTime: now,
      duration,
      transcript: req.body.transcript || '',
      crossExamination: null,
      aiAnalysis: null,
    });

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

// POST /api/v1/debate/:roomId/host/mute — Mute/unmute a participant (UC-47)
router.post(
  '/:roomId/host/mute',
  authenticate,
  validate(muteParticipantSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action } = req.body;
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can mute participants');

    const participant = room.participants.find((p) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    (participant as any).muted = action === 'mute';
    await room.save();

    sendSuccess(res, { userId, muted: action === 'mute' }, `Participant ${action === 'mute' ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/debate/:roomId/judge/submit-score — Judge submit score (UC-48)
router.post(
  '/:roomId/judge/submit-score',
  authenticate,
  validate(judgeSubmitScoreSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, score, notes } = req.body;
    const room = await DebateRoom.findById(req.params.roomId).select('participants');
    if (!room) throw new NotFoundError('Room not found');

    const judge = room.participants.find(
      (participant) =>
        participant.userId.toString() === req.user!.userId &&
        participant.roomRole === 'judge',
    );
    if (!judge) {
      throw new ForbiddenError('Only assigned judges can submit scores');
    }

    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');

    if (!session.finalScores) {
      session.finalScores = {
        teamProposition: { total: 0, breakdown: {} },
        teamOpposition: { total: 0, breakdown: {} },
        winner: null,
        aiVerdict: null,
        judgeVerdicts: [],
      };
    }

    const finalScores = session.finalScores as {
      judgeVerdicts: any[];
    };
    finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];
    finalScores.judgeVerdicts.push({
      judgeId: req.user!.userId as any,
      speaker,
      score,
      notes: notes || '',
      submittedAt: new Date(),
    });

    await session.save();
    sendSuccess(res, { speaker, score, notes }, 'Score submitted');
  }),
);

// GET /api/v1/debate/:roomId/scores — Get current scores for the room (UC-36)
router.get(
  '/:roomId/scores',
  asyncHandler(async (req, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId).select('participants judgeType');
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    const payload = {
      finalScores: session.finalScores,
      judgeVerdicts: session.finalScores?.judgeVerdicts || [],
      turnHistory: session.turnHistory,
      participants: room.participants,
    };

    sendSuccess(res, payload);
  }),
);

// POST /api/v1/debate/:roomId/cross-exam/pass-turn — Pass the cross-exam turn (UC-32)
router.post(
  '/:roomId/cross-exam/pass-turn',
  authenticate,
  validate(legacyCrossExamPassSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker } = req.body;
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
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
      transcript: req.body.transcript || '',
      crossExamination: null,
      aiAnalysis: null,
    });

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

// POST /api/v1/debate/:roomId/cross-exam/finish — Finish cross-examination (UC-33)
router.post(
  '/:roomId/cross-exam/finish',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
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

// POST /api/v1/debate/:roomId/result — Apply final result to ranking for rank rooms
router.post(
  '/:roomId/result',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can finalize result');

    const rankingResult = await applyDebateResult(req.params.roomId);
    sendSuccess(res, rankingResult, rankingResult.applied ? 'Result applied' : 'Result not applied');
  }),
);

// GET /api/v1/debate/:roomId/session — Get session data
router.get(
  '/:roomId/session',
  asyncHandler(async (req, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');
    sendSuccess(res, session);
  }),
);

// GET /api/v1/debate/:roomId/replay — Get replay data (UC-66)
router.get(
  '/:roomId/replay',
  asyncHandler(async (req, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');

    const room = await DebateRoom.findById(req.params.roomId).select('title motion format participants');

    sendSuccess(res, { room, session });
  }),
);

export default router;
