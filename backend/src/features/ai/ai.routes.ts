import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { aiService } from './ai.service.js';

const router = Router();

// POST /api/v1/ai/analyze-speech — AI speech analysis (UC-59)
router.post(
  '/analyze-speech',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { speech, motion, team, speakerSlot } = req.body;
    const analysis = await aiService.analyzeSpeech(speech, motion, team, speakerSlot);
    sendSuccess(res, analysis);
  }),
);

// POST /api/v1/ai/score-argument — AI score (UC-58)
router.post(
  '/score-argument',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { speech, motion } = req.body;
    const score = await aiService.scoreArgument(speech, motion);
    sendSuccess(res, score);
  }),
);

// POST /api/v1/ai/summarize-debate — AI debate summary (UC-60)
router.post(
  '/summarize-debate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { turnHistory, motion } = req.body;
    const summary = await aiService.summarizeDebate(turnHistory, motion);
    sendSuccess(res, { summary });
  }),
);

// POST /api/v1/ai/check-toxic — AI toxic check (UC-62)
router.post(
  '/check-toxic',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    const result = await aiService.checkToxic(content);
    sendSuccess(res, result);
  }),
);

export default router;
