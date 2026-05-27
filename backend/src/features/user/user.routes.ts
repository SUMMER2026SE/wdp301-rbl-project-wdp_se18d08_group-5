import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { User } from '../../models/User.js';
import { ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';
import { updateProfileSchema } from './user.schema.js';

const router = Router();

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
