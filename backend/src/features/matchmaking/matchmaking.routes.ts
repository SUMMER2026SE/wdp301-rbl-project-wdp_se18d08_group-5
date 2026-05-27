import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { MatchQueue } from '../../models/MatchQueue.js';
import { User } from '../../models/User.js';
import { BadRequestError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

// POST /api/v1/matchmaking/queue — Join rank queue (UC-12)
router.post(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { format } = req.body; // '1v1' | '3v3'
    const userId = req.user!.userId;

    // Check if already in queue
    const existing = await MatchQueue.findOne({ userId, status: 'waiting' });
    if (existing) throw new BadRequestError('Already in queue');

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const entry = await MatchQueue.create({
      userId,
      format,
      eloAtQueue: user.ranking.elo,
      status: 'waiting',
    });

    // TODO: Trigger matchmaking service to find opponent
    // matchmakingService.tryMatch(entry);

    sendSuccess(res, { queueId: entry._id, format, elo: user.ranking.elo }, 'Joined queue', 201);
  }),
);

// DELETE /api/v1/matchmaking/queue — Leave queue
router.delete(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await MatchQueue.findOneAndUpdate(
      { userId: req.user!.userId, status: 'waiting' },
      { status: 'cancelled' },
    );
    if (!result) throw new NotFoundError('Not in queue');
    sendSuccess(res, null, 'Left queue');
  }),
);

// GET /api/v1/matchmaking/status — Queue status
router.get(
  '/status',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const entry = await MatchQueue.findOne({ userId: req.user!.userId, status: 'waiting' });
    if (!entry) {
      return sendSuccess(res, { status: 'idle' });
    }
    const waitTime = Math.floor((Date.now() - entry.createdAt.getTime()) / 1000);
    sendSuccess(res, { status: 'waiting', format: entry.format, waitTime });
  }),
);

export default router;
