import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import { User } from '../../models/User.js';
import { ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';
import { banUserSchema, adminUserListQuerySchema, updateUserRoleSchema } from './admin.schema.js';

const router = Router();

const adminUserSelect = [
  '_id',
  'username',
  'email',
  'role',
  'authProvider',
  'isEmailVerified',
  'isBanned',
  'banReason',
  'bannedUntil',
  'bannedAt',
  'profile.displayName',
  'profile.avatar',
  'createdAt',
].join(' ');

function toAdminUserPayload(user: any) {
  return {
    _id: user._id.toString(),
    username: user.username,
    email: user.email,
    role: user.role,
    authProvider: user.authProvider,
    isEmailVerified: user.isEmailVerified,
    isBanned: Boolean(user.isBanned) && (!user.bannedUntil || new Date(user.bannedUntil).getTime() > Date.now()),
    banReason: user.banReason || '',
    bannedUntil: user.bannedUntil,
    bannedAt: user.bannedAt,
    profile: {
      displayName: user.profile.displayName,
      avatar: user.profile.avatar,
    },
    createdAt: user.createdAt,
  };
}

function resolveBanExpiry(input: { durationPreset: '1h' | '24h' | '7d' | '30d' | 'custom'; customDurationValue?: number; customDurationUnit?: 'minutes' | 'hours' | 'days'; }) {
  const now = Date.now();
  const presetDurations = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  } as const;

  if (input.durationPreset !== 'custom') {
    return new Date(now + presetDurations[input.durationPreset]);
  }

  const unitMultipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  } as const;

  return new Date(now + (input.customDurationValue as number) * unitMultipliers[input.customDurationUnit as 'minutes' | 'hours' | 'days']);
}

router.use(authenticate, authorize('admin'));

router.get(
  '/users',
  validateQuery(adminUserListQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as unknown as {
      page: number;
      limit: number;
      search: string;
      role?: 'admin' | 'user';
    };

    const { page, limit, search, role } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (role) {
      filter.role = role;
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { username: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { 'profile.displayName': { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(adminUserSelect)
        .sort({ createdAt: -1, username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    const rows = users.map((user) => toAdminUserPayload(user));

    sendPaginated(res, rows, { page, limit, total });
  }),
);

router.patch(
  '/users/:userId/role',
  validate(updateUserRoleSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body as { role: 'admin' | 'user' };

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User role updated');
  }),
);

router.post(
  '/users/:userId/ban',
  validate(banUserSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const payload = req.body as {
      durationPreset: '1h' | '24h' | '7d' | '30d' | 'custom';
      customDurationValue?: number;
      customDurationUnit?: 'minutes' | 'hours' | 'days';
      reason?: string;
    };

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot ban your own account');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isBanned: true,
        banReason: payload.reason || '',
        bannedAt: new Date(),
        bannedBy: req.user!.userId,
        bannedUntil: resolveBanExpiry(payload),
      },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User banned');
  }),
);

router.post(
  '/users/:userId/unban',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot unban your own account here');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isBanned: false,
        banReason: '',
        bannedAt: null,
        bannedBy: null,
        bannedUntil: null,
      },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User unbanned');
  }),
);

export default router;
