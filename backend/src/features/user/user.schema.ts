import { z } from 'zod';

const avatarSchema = z.union([z.string().url(), z.literal(''), z.undefined()]);

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().trim().max(500).optional(),
  avatar: avatarSchema,
  school: z.string().trim().max(100).optional(),
  club: z.string().trim().max(100).optional(),
});
