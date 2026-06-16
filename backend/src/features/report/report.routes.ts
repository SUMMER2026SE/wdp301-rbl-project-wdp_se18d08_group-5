import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { BadRequestError, NotFoundError } from '../../utils/AppError.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { Message } from '../../models/Message.js';
import { Report } from '../../models/Report.js';
import { User } from '../../models/User.js';
import type { AuthRequest } from '../../types/index.js';
import { createReportSchema } from './report.schema.js';

const router = Router();

function toObjectId(value?: string | null) {
  return value && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

function truncateSnippet(value: string) {
  return value.length > 280 ? `${value.slice(0, 277)}...` : value;
}

router.post(
  '/',
  authenticate,
  validate(createReportSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = req.body as {
      targetType: 'user' | 'message' | 'room' | 'debate' | 'other';
      targetId?: string;
      reportedUserId?: string;
      roomId?: string;
      reason: 'harassment' | 'toxic_chat' | 'spam' | 'cheating' | 'inappropriate_content' | 'other';
      details: string;
    };

    const reporter = await User.findById(req.user!.userId).select('username profile.displayName');
    if (!reporter) throw new NotFoundError('Reporter not found');

    const targetId = toObjectId(payload.targetId);
    let reportedUserId = toObjectId(payload.reportedUserId);
    let reportedUserName = '';
    let roomId = toObjectId(payload.roomId);
    let roomTitle = '';
    let messageId: Types.ObjectId | null = null;
    let messageSnippet = '';

    if (payload.targetType !== 'other' && !targetId) {
      throw new BadRequestError('targetId is required');
    }

    if (payload.targetType === 'message' && targetId) {
      const message = await Message.findById(targetId);
      if (!message) throw new NotFoundError('Message not found');
      messageId = message._id as Types.ObjectId;
      roomId = message.roomId;
      reportedUserId = message.senderId;
      reportedUserName = message.senderName;
      messageSnippet = truncateSnippet(message.content);
    }

    if ((payload.targetType === 'room' || payload.targetType === 'debate') && targetId) {
      const room = await DebateRoom.findById(targetId).select('title motion');
      if (!room) throw new NotFoundError('Room not found');
      roomId = room._id as Types.ObjectId;
      roomTitle = room.title || room.motion || 'Untitled room';
    }

    if (payload.targetType === 'user' && targetId) {
      reportedUserId = targetId;
    }

    if (reportedUserId && !reportedUserName) {
      const reportedUser = await User.findById(reportedUserId).select('username profile.displayName');
      if (reportedUser) {
        reportedUserName = reportedUser.profile?.displayName || reportedUser.username;
      }
    }

    if (roomId && !roomTitle) {
      const room = await DebateRoom.findById(roomId).select('title motion');
      if (room) {
        roomTitle = room.title || room.motion || 'Untitled room';
      }
    }

    const report = await Report.create({
      targetType: payload.targetType,
      targetId,
      reporterId: req.user!.userId,
      reporterName: reporter.profile?.displayName || reporter.username,
      reportedUserId,
      reportedUserName,
      roomId,
      roomTitle,
      messageId,
      messageSnippet,
      reason: payload.reason,
      details: payload.details,
    });

    sendSuccess(res, report, 'Report submitted', 201);
  }),
);

export default router;
