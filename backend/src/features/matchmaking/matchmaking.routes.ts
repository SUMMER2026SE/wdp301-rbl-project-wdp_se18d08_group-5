import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { MatchQueue } from '../../models/MatchQueue.js';
import { User } from '../../models/User.js';
import { BadRequestError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';
import { tryCreateRankMatch } from './matchmaking.service.js';

const router = Router();

// POST /api/v1/matchmaking/queue — Join rank queue (UC-12)
router.post(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { format } = req.body; // '1v1' | '3v3'
    const userId = req.user!.userId;

    // Check if already in queue or already matched
    const existing = await MatchQueue.findOne({
      userId,
      status: { $in: ['waiting', 'matched'] },
    });
    if (existing) throw new BadRequestError('Already in queue');

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const entry = await MatchQueue.create({
      userId,
      format,
      eloAtQueue: user.ranking.elo,
      status: 'waiting',
    });

    const match = await tryCreateRankMatch(entry);

    sendSuccess(
      res,
      {
        queueId: entry._id,
        format,
        elo: user.ranking.elo,
        status: match.matched ? 'matched' : 'waiting',
        roomId: match.matched ? match.room._id : null,
      },
      match.matched ? 'Match found' : 'Joined queue',
      201,
    );
  }),
);

// DELETE /api/v1/matchmaking/queue — Leave queue
router.delete(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await MatchQueue.findOneAndUpdate(
      { userId: req.user!.userId, status: { $in: ['waiting', 'matched'] } },
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
    const entry = await MatchQueue.findOne({
      userId: req.user!.userId,
      status: { $in: ['waiting', 'matched'] },
    }).sort({ createdAt: -1 });
    if (!entry) {
      return sendSuccess(res, { status: 'idle' });
    }
    if (entry.status === 'matched') {
      return sendSuccess(res, {
        status: 'matched',
        format: entry.format,
        roomId: entry.matchedRoomId,
      });
    }
    const waitTime = Math.floor((Date.now() - entry.createdAt.getTime()) / 1000);
    sendSuccess(res, { status: 'waiting', format: entry.format, waitTime });
  }),
);

export default router;
