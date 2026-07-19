import { Router, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { generateIceServers } from './webrtc.service.js';

const router = Router();

router.get(
  '/ice-servers',
  authenticate,
  asyncHandler(async (_req, res: Response) => {
    const iceServers = await generateIceServers();
    sendSuccess(res, { iceServers });
  }),
);

export default router;
