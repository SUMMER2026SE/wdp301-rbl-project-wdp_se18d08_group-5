import { z } from 'zod';

export const teamSchema = z.enum(['proposition', 'opposition']);
export const speakerSlotSchema = z.enum(['S1', 'S2', 'S3']);
export const roomRoleSchema = z.enum(['debater', 'host', 'judge', 'viewer', 'owner']);
export const hostTypeSchema = z.enum(['human', 'ai']);
export const judgeTypeSchema = z.enum(['human', 'ai']);
export const roomTypeSchema = z.enum(['rank', 'custom']);
export const debateFormatSchema = z.enum(['1v1', '3v3']);

// ─── Create room ──────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  title: z.string().min(1).max(100).trim().optional().default(''),
  format: debateFormatSchema,
  hostType: hostTypeSchema.optional().default('human'),
  judgeType: judgeTypeSchema.optional().default('ai'),
  judgeCount: z.number().int().min(1).max(3).optional().default(1),
  isPrivate: z.boolean().optional().default(false),
  password: z.string().min(4).max(50).optional(),
}).refine(
  (data) => !data.isPrivate || Boolean(data.password),
  { message: 'Password is required for private rooms', path: ['password'] },
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
  judgeCount: z.number().int().min(1).max(3).optional(),
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
