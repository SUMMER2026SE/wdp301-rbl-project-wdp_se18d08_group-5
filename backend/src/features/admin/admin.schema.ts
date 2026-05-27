import { z } from 'zod';

const banDurationPresetSchema = z.enum(['1h', '24h', '7d', '30d', 'custom']);
const customDurationUnitSchema = z.enum(['minutes', 'hours', 'days']);

export const adminUserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().optional().default(''),
  role: z.enum(['admin', 'user']).optional(),
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
