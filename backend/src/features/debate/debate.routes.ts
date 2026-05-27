import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

// POST /api/v1/debate/:roomId/host/pause — Pause debate (UC-44)
router.post(
  '/:roomId/host/pause',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    // Check host permission
    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can pause');

    room.status = 'paused';
    await room.save();

    // TODO: Emit socket event debate:paused

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

    // TODO: Emit socket event debate:resumed

    sendSuccess(res, { status: 'active' }, 'Debate resumed');
  }),
);

// POST /api/v1/debate/:roomId/host/issue-card — Issue yellow card (UC-45)
router.post(
  '/:roomId/host/issue-card',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = await DebateRoom.findById(req.params.roomId);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host can issue cards');

    // Save card to session
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

    // TODO: Emit socket event debate:card-issued

    sendSuccess(res, { type: 'yellow', userId, reason }, 'Card issued');
  }),
);

// POST /api/v1/debate/:roomId/host/kick — Kick from active debate (UC-46)
router.post(
  '/:roomId/host/kick',
  authenticate,
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

    // TODO: Emit socket event + disconnect user

    sendSuccess(res, null, 'Participant kicked');
  }),
);

// POST /api/v1/debate/:roomId/judge/submit-score — Judge submit score (UC-48)
router.post(
  '/:roomId/judge/submit-score',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, score } = req.body;
    // score: { logic, rebuttal, evidence, crossExam, strategy, communication }

    const session = await DebateSession.findOne({ roomId: req.params.roomId });
    if (!session) throw new NotFoundError('Session not found');

    // TODO: Validate judge role, save score to turn history

    sendSuccess(res, { speaker, score }, 'Score submitted');
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
