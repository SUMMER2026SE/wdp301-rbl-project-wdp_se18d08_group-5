import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { User } from '../../models/User.js';
import { NotFoundError } from '../../utils/AppError.js';

const router = Router();

// GET /api/v1/rankings/leaderboard — Global ELO leaderboard (UC-64)
router.get(
  '/leaderboard',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const page = parseInt(req.query.page as string, 10) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('username profile.displayName profile.avatar ranking stats.wins stats.losses')
      .sort({ 'ranking.elo': -1 })
      .skip(skip)
      .limit(limit);

    const leaderboard = users.map((user, index) => ({
      _id: user._id,
      username: user.username,
      displayName: user.profile.displayName,
      avatar: user.profile.avatar,
      elo: user.ranking.elo,
      tier: user.ranking.tier,
      wins: user.stats.wins,
      losses: user.stats.losses,
      rank: skip + index + 1,
    }));

    sendSuccess(res, leaderboard);
  }),
);

// GET /api/v1/rankings/user/:id — User rank info
router.get(
  '/user/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id).select('ranking stats');
    if (!user) throw new NotFoundError('User not found');

    // Calculate rank position
    const rank = await User.countDocuments({
      'ranking.elo': { $gt: user.ranking.elo },
    });

    sendSuccess(res, {
      elo: user.ranking.elo,
      tier: user.ranking.tier,
      seasonPoints: user.ranking.seasonPoints,
      rank: rank + 1,
      totalDebates: user.stats.totalDebates,
      wins: user.stats.wins,
      losses: user.stats.losses,
    });
  }),
);

export default router;
