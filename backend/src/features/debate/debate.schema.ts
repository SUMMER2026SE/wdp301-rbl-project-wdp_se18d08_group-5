import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid userId');
const transcriptSchema = z.string().trim().max(1000).optional();
const speakerSchema = z.string().trim().min(1).max(40);
const phaseSchema = z.enum([
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

export const transcriptBodySchema = z.object({
  transcript: transcriptSchema,
});

export const cePassTurnSchema = z.object({
  content: z.string().trim().max(500).optional(),
});

export const endDebateSchema = z.object({
  summary: z.string().trim().max(1000).optional(),
});

export const issueCardSchema = z.object({
  userId: objectIdSchema,
  reason: z.string().trim().min(1).max(500),
});

export const participantActionSchema = z.object({
  userId: objectIdSchema,
});

export const hostNextTurnSchema = z.object({
  nextSpeaker: speakerSchema.optional(),
  phase: phaseSchema.optional(),
  timeLimit: z.number().int().min(0).max(3600).optional(),
  transcript: transcriptSchema,
});

export const muteParticipantSchema = z.object({
  userId: objectIdSchema,
  action: z.enum(['mute', 'unmute']),
});

export const judgeSubmitScoreSchema = z.object({
  speaker: speakerSchema,
  score: z.record(z.string(), z.number()),
  notes: z.string().trim().max(1000).optional(),
});

export const legacyCrossExamPassSchema = z.object({
  nextSpeaker: speakerSchema.optional(),
  transcript: transcriptSchema,
});
