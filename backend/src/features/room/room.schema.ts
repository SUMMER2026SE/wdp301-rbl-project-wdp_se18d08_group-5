import { z } from 'zod';

export const teamSchema = z.enum(['proposition', 'opposition']);
export const speakerSlotSchema = z.enum(['S1', 'S2', 'S3']);
export const roomRoleSchema = z.enum(['debater', 'host', 'judge', 'viewer', 'owner']);
export const hostTypeSchema = z.enum(['human', 'ai']);
export const judgeTypeSchema = z.enum(['human', 'ai']);
export const roomTypeSchema = z.enum(['rank', 'custom']);
export const debateFormatSchema = z.enum(['1v1', '3v3']);

// ─── Create room ──────────────────────────────────────────────────────────────
//
// Per the rule docs:
// - judgeType: 'human' or 'ai'
// - judgeCount must be either 1 or 3 (Human) or exactly 1 (AI)
// - ai judge → judgeCount is forced to 1 by the route handler
// - private rooms require a password

export const createRoomSchema = z.object({
  title: z.string().min(1).max(100).trim().optional().default(''),
  format: debateFormatSchema,
  hostType: hostTypeSchema.optional().default('human'),
  judgeType: judgeTypeSchema.optional().default('ai'),
  judgeCount: z.number().int().refine((v) => v === 1 || v === 3, {
    message: 'judgeCount must be 1 or 3',
  }).optional().default(1),
  isPrivate: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional(),
}).refine(
  (data) => !data.isPrivate || Boolean(data.password),
  { message: 'Password is required for private rooms', path: ['password'] },
).refine(
  (data) => data.judgeType === 'ai' ? data.judgeCount === 1 : true,
  { message: 'AI Judge always uses exactly 1 judge', path: ['judgeCount'] },
);

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// ─── Assign participant ────────────────────────────────────────────────────────

export const assignParticipantSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: roomRoleSchema,
  team: teamSchema.or(z.null()),
  speakerSlot: speakerSlotSchema.or(z.null()),
});

export type AssignParticipantInput = z.infer<typeof assignParticipantSchema>;

// ─── Select position ───────────────────────────────────────────────────────────

export const selectPositionSchema = z.object({
  team: teamSchema,
  speakerSlot: speakerSlotSchema,
});

export type SelectPositionInput = z.infer<typeof selectPositionSchema>;

// ─── Update motion ────────────────────────────────────────────────────────────

export const updateMotionSchema = z.object({
  motion: z.string().min(1).max(500).trim(),
});

export type UpdateMotionInput = z.infer<typeof updateMotionSchema>;

// ─── Update room settings ─────────────────────────────────────────────────────

export const updateRoomSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  judgeCount: z.number().int().refine((v) => v === 1 || v === 3, {
    message: 'judgeCount must be 1 or 3',
  }).optional(),
  viewerChatEnabled: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().min(4).max(50).optional().nullable(),
});

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

// ─── Join room ────────────────────────────────────────────────────────────────

export const joinRoomSchema = z.object({
  password: z.string().optional(),
});

export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
