import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { MatchQueue } from '../../models/MatchQueue.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { User } from '../../models/User.js';
import { BadRequestError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';
import { getQueueEloTolerance, getQueueWaitTimeSeconds, tryCreateRankMatch } from './matchmaking.service.js';

const router = Router();

// POST /api/v1/matchmaking/queue — Join rank queue (UC-12)
router.post(
  '/queue',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { format } = req.body; // '1v1' | '3v3'
    const userId = req.user!.userId;

    // Check if already in queue or already matched to an unfinished room.
    const existing = await MatchQueue.findOne({
      userId,
      status: { $in: ['waiting', 'matched'] },
    });
    if (existing?.status === 'waiting') throw new BadRequestError('Already in queue');
    if (existing?.status === 'matched') {
      const room = existing.matchedRoomId ? await DebateRoom.findById(existing.matchedRoomId).select('status') : null;
      if (room && !['completed', 'cancelled'].includes(room.status)) {
        throw new BadRequestError('Already matched');
      }
      existing.status = 'cancelled';
      await existing.save();
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    const entry = await MatchQueue.create({
      userId,
      format,
      eloAtQueue: user.ranking.elo,
      status: 'waiting',
    });

    const match = await tryCreateRankMatch(entry);
    const now = new Date();

    sendSuccess(
      res,
      {
        queueId: entry._id,
        format,
        elo: user.ranking.elo,
        eloRange: getQueueEloTolerance(entry, now),
        waitTime: getQueueWaitTimeSeconds(entry, now),
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
      const room = entry.matchedRoomId ? await DebateRoom.findById(entry.matchedRoomId).select('status') : null;
      if (!room || ['completed', 'cancelled'].includes(room.status)) {
        entry.status = 'cancelled';
        await entry.save();
        return sendSuccess(res, { status: 'idle' });
      }

      return sendSuccess(res, {
        status: 'matched',
        format: entry.format,
        roomId: entry.matchedRoomId,
      });
    }
    const match = await tryCreateRankMatch(entry);
    const now = new Date();
    const waitTime = getQueueWaitTimeSeconds(entry, now);
    const eloRange = getQueueEloTolerance(entry, now);

    if (match.matched) {
      return sendSuccess(res, {
        status: 'matched',
        format: entry.format,
        waitTime,
        eloRange,
        roomId: match.room._id,
      });
    }

    sendSuccess(res, { status: 'waiting', format: entry.format, waitTime, eloRange });
  }),
);

export default router;
