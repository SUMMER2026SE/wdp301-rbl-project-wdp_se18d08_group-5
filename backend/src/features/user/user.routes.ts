import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import { User } from '../../models/User.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';
import { updateProfileSchema, userSearchQuerySchema } from './user.schema.js';

const router = Router();

// GET /api/v1/users/search?q= — Search users
router.get(
  '/search',
  authenticate,
  validateQuery(userSearchQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = (req.query.q as string).trim();

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { 'profile.displayName': { $regex: query, $options: 'i' } },
      ],
    })
      .select('username profile.displayName profile.avatar ranking.elo ranking.tier')
      .sort({ 'ranking.elo': -1, username: 1 })
      .limit(20);

    const results = users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      displayName: user.profile.displayName,
      avatar: user.profile.avatar || null,
      elo: user.ranking.elo,
      tier: user.ranking.tier,
    }));

    sendSuccess(res, results);
  }),
);

// GET /api/v1/users/:id/history — Public user debate history
router.get(
  '/:id/history',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const user = await User.findById(id).select('_id');
    if (!user) throw new NotFoundError('User not found');

    const filter = {
      'participants.userId': user._id,
      status: 'completed',
    };

    const [rooms, total] = await Promise.all([
      DebateRoom.find(filter)
        .select('title motion status format startedAt endedAt participants')
        .sort({ endedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      DebateRoom.countDocuments(filter),
    ]);

    const roomIds = rooms.map((room) => room._id);
    const sessions = await DebateSession.find({ roomId: { $in: roomIds } })
      .select('roomId finalScores')
      .sort({ createdAt: -1 });

    const sessionByRoomId = new Map(sessions.map((session) => [session.roomId.toString(), session]));

    const history = rooms.map((room) => {
      const participant = room.participants.find((entry) => entry.userId.toString() === id);
      const session = sessionByRoomId.get(room._id.toString());
      const winner = session?.finalScores?.winner;

      let result: 'win' | 'loss' | 'draw' | null = null;
      if (winner === 'draw') {
        result = 'draw';
      } else if (participant?.team && winner === participant.team) {
        result = 'win';
      } else if (winner && participant?.team) {
        result = 'loss';
      }

      return {
        sessionId: session?._id?.toString() || room._id.toString(),
        roomId: room._id.toString(),
        roomTitle: room.title,
        motion: room.motion,
        format: room.format,
        status: room.status,
        startedAt: room.startedAt,
        endedAt: room.endedAt,
        userSide: participant?.team || null,
        userRole: participant?.roomRole || 'viewer',
        result,
      };
    });

    sendPaginated(res, history, { page, limit, total });
  }),
);

// GET /api/v1/users/:id — Public profile
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('User not found');
    sendSuccess(res, user);
  }),
);

// GET /api/v1/users/:id/stats — User stats
router.get(
  '/:id/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id).select('stats ranking username profile');
    if (!user) throw new NotFoundError('User not found');
    sendSuccess(res, user);
  }),
);

// PUT /api/v1/users/:id/profile — Update profile (authenticated, own profile)
router.put(
  '/:id/profile',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    if (req.user!.userId !== id) throw new ForbiddenError('Cannot edit other user profile');

    const { displayName, bio, avatar, school, club } = req.body;
    const $set: Record<string, string> = {};
    if (displayName !== undefined) $set['profile.displayName'] = displayName;
    if (bio !== undefined) $set['profile.bio'] = bio;
    if (avatar !== undefined) $set['profile.avatar'] = avatar;
    if (school !== undefined) $set['profile.school'] = school;
    if (club !== undefined) $set['profile.club'] = club;

    const user = await User.findByIdAndUpdate(id, { $set }, { new: true, runValidators: true });

    if (!user) throw new NotFoundError('User not found');
    sendSuccess(res, user, 'Profile updated');
  }),
);

export default router;
