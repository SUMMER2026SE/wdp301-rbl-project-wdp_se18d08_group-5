import { z } from 'zod';

const banDurationPresetSchema = z.enum(['1h', '24h', '7d', '30d', 'custom']);
const customDurationUnitSchema = z.enum(['minutes', 'hours', 'days']);

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional().default(''),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'banned', 'pending']).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'user']),
});

export const banUserSchema = z.object({
  durationPreset: banDurationPresetSchema,
  customDurationValue: z.coerce.number().int().min(1).max(365).optional(),
  customDurationUnit: customDurationUnitSchema.optional(),
  reason: z.string().trim().max(200).optional().default(''),
}).superRefine((data, ctx) => {
  if (data.durationPreset !== 'custom') {
    return;
  }

  if (!data.customDurationValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customDurationValue'],
      message: 'Custom duration value is required',
    });
  }

  if (!data.customDurationUnit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customDurationUnit'],
      message: 'Custom duration unit is required',
    });
  }
});

export const adminRoomListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional().default(''),
  status: z.enum(['waiting', 'ready', 'active', 'paused', 'completed', 'cancelled']).optional(),
  roomType: z.enum(['rank', 'custom']).optional(),
  format: z.enum(['1v1', '3v3']).optional(),
});

export const updateRoomStatusSchema = z.object({
  status: z.enum(['waiting', 'ready', 'active', 'paused', 'completed', 'cancelled']),
  reason: z.string().trim().max(300).optional().default(''),
});

export const adminRoomParticipantActionSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id'),
  reason: z.string().trim().max(300).optional().default(''),
});

export const adminRoomMuteSchema = adminRoomParticipantActionSchema.extend({
  muted: z.boolean(),
});

export const adminViewerChatSchema = z.object({
  enabled: z.boolean(),
});

export const adminReportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional().default(''),
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
  targetType: z.enum(['user', 'message', 'room', 'debate', 'other']).optional(),
});

export const updateReportSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']),
  resolution: z.enum(['none', 'warned', 'muted', 'banned', 'dismissed']).optional().default('none'),
  adminNote: z.string().trim().max(1000).optional().default(''),
  ban: z.object({
    durationPreset: banDurationPresetSchema,
    customDurationValue: z.coerce.number().int().min(1).max(365).optional(),
    customDurationUnit: customDurationUnitSchema.optional(),
    reason: z.string().trim().max(200).optional().default(''),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.resolution === 'banned' && !data.ban) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ban'],
      message: 'Ban settings are required when resolution is banned',
    });
  }

  if (!data.ban || data.ban.durationPreset !== 'custom') {
    return;
  }

  if (!data.ban.customDurationValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ban', 'customDurationValue'],
      message: 'Custom duration value is required',
    });
  }

  if (!data.ban.customDurationUnit) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ban', 'customDurationUnit'],
      message: 'Custom duration unit is required',
    });
  }
});
