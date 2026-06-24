import { z } from 'zod';

export const createForumTopicSchema = z.object({
  title: z.string().trim().min(8, 'Topic title must be at least 8 characters').max(200),
  description: z.string().trim().max(1000).optional().default(''),
});

export const setForumStanceSchema = z.object({
  stance: z.enum(['agree', 'disagree']),
});

export const createForumPostSchema = z.object({
  opinion: z.string().trim().min(1, 'Opinion cannot be empty').max(2000),
  evidenceText: z.string().trim().max(2000).optional().default(''),
  evidenceImageUrl: z.string().trim().url('Evidence image must be a valid URL').max(2048).optional().or(z.literal('')).default(''),
});

export const createForumCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(1000),
});
