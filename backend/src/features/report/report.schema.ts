import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id').optional();

export const createReportSchema = z.object({
  targetType: z.enum(['user', 'message', 'room', 'debate', 'other']),
  targetId: objectIdSchema,
  reportedUserId: objectIdSchema,
  roomId: objectIdSchema,
  reason: z.enum(['harassment', 'toxic_chat', 'spam', 'cheating', 'inappropriate_content', 'other']).default('other'),
  details: z.string().trim().max(1000).optional().default(''),
}).superRefine((data, ctx) => {
  if (data.targetType !== 'other' && !data.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetId'],
      message: 'targetId is required for this report target',
    });
  }
});
