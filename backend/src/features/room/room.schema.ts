import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid userId');
const optionalTextSchema = z.string().trim().max(1000).optional();
const motionSchema = z.string().trim().max(240);
const roomRoleSchema = z.enum(['debater', 'host', 'judge', 'viewer']);
const teamSchema = z.enum(['proposition', 'opposition']).nullable();
const speakerSlotSchema = z.enum(['S1', 'S2', 'S3']).nullable();
const debatePhaseSchema = z.enum([
  'motion',
  'prep_7',
  'speech',
  'cross_exam',
  'judge_feedback',
  'prep_1',
  'closing',
  'final_judging',
  'completed',
]);
const speakerSchema = z.string().trim().min(1).max(40);

const baseRoomSchema = z.object({
  title: z.string().trim().min(1).max(120),
  motion: motionSchema.optional().default(''),
  format: z.enum(['1v1', '3v3']),
  hostType: z.enum(['human', 'ai']).default('human'),
  judgeType: z.enum(['human', 'ai']).default('ai'),
  judgeCount: z.number().int().min(1).max(3).default(1),
  isPrivate: z.boolean().default(false),
  password: z.string().trim().min(1).max(100).optional(),
});

export const createRoomSchema = baseRoomSchema.refine(
  (data) => !data.isPrivate || Boolean(data.password),
  {
    message: 'password is required for private rooms',
    path: ['password'],
  },
);

export const updateRoomSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  motion: motionSchema.optional(),
  format: z.enum(['1v1', '3v3']).optional(),
  hostType: z.enum(['human', 'ai']).optional(),
  judgeType: z.enum(['human', 'ai']).optional(),
  judgeCount: z.number().int().min(1).max(3).optional(),
  isPrivate: z.boolean().optional(),
  password: z.string().trim().min(1).max(100).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field is required',
});

export const assignRoleSchema = z.object({
  userId: objectIdSchema,
  role: roomRoleSchema,
  team: teamSchema.optional(),
  speakerSlot: speakerSlotSchema.optional(),
});

export const joinRoomSchema = z.object({
  password: z.string().trim().max(100).optional(),
});

export const selectPositionSchema = z.object({
  team: z.enum(['proposition', 'opposition']).optional(),
  speakerSlot: z.enum(['S1', 'S2', 'S3']).optional(),
}).refine((data) => data.team !== undefined || data.speakerSlot !== undefined, {
  message: 'team or speakerSlot is required',
});

export const updateMotionSchema = z.object({
  motion: motionSchema.min(1),
});

export const participantActionSchema = z.object({
  userId: objectIdSchema,
});

export const hostNextTurnSchema = z.object({
  nextSpeaker: speakerSchema.optional(),
  phase: debatePhaseSchema.optional(),
  timeLimit: z.number().int().min(0).max(3600).optional(),
  transcript: optionalTextSchema,
});

export const issueCardSchema = z.object({
  userId: objectIdSchema,
  reason: z.string().trim().min(1).max(500),
});

export const muteParticipantSchema = z.object({
  userId: objectIdSchema,
  action: z.enum(['mute', 'unmute']).optional(),
  type: z.enum(['mute', 'unmute']).optional(),
}).refine((data) => data.action !== undefined || data.type !== undefined, {
  message: 'action or type is required',
});

export const viewerChatSchema = z.object({
  enabled: z.boolean(),
});

export const judgeScoreSchema = z.object({
  speaker: speakerSchema,
  winner: z.enum(['proposition', 'opposition', 'draw']).optional(),
  logic: z.number().min(0).max(30),
  rebuttal: z.number().min(0).max(20),
  evidence: z.number().min(0).max(15),
  crossExam: z.number().min(0).max(15),
  strategy: z.number().min(0).max(10),
  communication: z.number().min(0).max(10),
  notes: z.string().trim().max(1000).optional(),
});

export const crossExamPassSchema = z.object({
  nextSpeaker: speakerSchema.optional(),
  transcript: optionalTextSchema,
});
