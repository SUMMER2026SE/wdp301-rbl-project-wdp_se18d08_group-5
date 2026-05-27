import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../utils/AppError.js';
import type { AuthRequest } from '../../types/index.js';

const router = Router();

// POST /api/v1/rooms/create — Create custom room (UC-14)
router.post(
  '/create',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { title, format, hostType, judgeType, judgeCount, isPrivate, password } = req.body;
    const userId = req.user!.userId;

    const room = await DebateRoom.create({
      roomType: 'custom',
      title,
      format,
      hostType,
      judgeType,
      judgeCount: judgeCount || 1,
      isPrivate: isPrivate || false,
      password: isPrivate ? password : null,
      createdBy: userId,
      participants: [
        {
          userId,
          username: req.body.username || 'Owner',
          roomRole: 'owner',
          team: null,
          speakerSlot: null,
          positionLocked: false,
        },
      ],
    });

    sendSuccess(res, room, 'Room created', 201);
  }),
);

// GET /api/v1/rooms — List rooms / Live Matches (UC-25/65)
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { status, format, roomType, page = '1', limit = '20' } = req.query;

    const filter: any = {};
    if (status) filter.status = status;
    if (format) filter.format = format;
    if (roomType) filter.roomType = roomType;

    // Default: show active/waiting rooms
    if (!status) filter.status = { $in: ['waiting', 'ready', 'active'] };

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [rooms, total] = await Promise.all([
      DebateRoom.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      DebateRoom.countDocuments(filter),
    ]);

    sendPaginated(res, rooms, { page: pageNum, limit: limitNum, total });
  }),
);

// GET /api/v1/rooms/:id — Room detail
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('-password');
    if (!room) throw new NotFoundError('Room not found');
    sendSuccess(res, room);
  }),
);

// POST /api/v1/rooms/:id/join — Join room (UC-17)
router.post(
  '/:id/join',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('+password');
    if (!room) throw new NotFoundError('Room not found');
    if (room.status !== 'waiting' && room.status !== 'ready') {
      throw new BadRequestError('Room is not accepting participants');
    }

    // Check password
    if (room.isPrivate && room.password) {
      if (req.body.password !== room.password) {
        throw new ForbiddenError('Incorrect room password');
      }
    }

    // Check if already in room
    const alreadyIn = room.participants.some(
      (p) => p.userId.toString() === req.user!.userId,
    );
    if (alreadyIn) throw new BadRequestError('Already in room');

    room.participants.push({
      userId: req.user!.userId as any,
      username: req.body.username || 'User',
      avatar: '',
      roomRole: 'viewer',
      team: null,
      speakerSlot: null,
      positionLocked: false,
    });

    await room.save();
    sendSuccess(res, room, 'Joined room');
  }),
);

// POST /api/v1/rooms/:id/position — Select position (UC-18)
router.post(
  '/:id/position',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { team, speakerSlot, roomRole } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const participant = room.participants.find(
      (p) => p.userId.toString() === req.user!.userId,
    );
    if (!participant) throw new BadRequestError('Not in room');
    if (participant.positionLocked) throw new BadRequestError('Position is locked');

    if (team) participant.team = team;
    if (speakerSlot) participant.speakerSlot = speakerSlot;
    if (roomRole) participant.roomRole = roomRole;

    await room.save();
    sendSuccess(res, room, 'Position updated');
  }),
);

// POST /api/v1/rooms/:id/position/lock — Lock positions (UC-19, Owner only)
router.post(
  '/:id/position/lock',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only owner can lock positions');
    }

    room.participants.forEach((p) => {
      p.positionLocked = true;
    });
    await room.save();
    sendSuccess(res, room, 'Positions locked');
  }),
);

// POST /api/v1/rooms/:id/start — Start debate (UC-22)
router.post(
  '/:id/start',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    // Only owner or host can start
    const isOwner = room.createdBy.toString() === req.user!.userId;
    const isHost = room.hostId?.toString() === req.user!.userId;
    if (!isOwner && !isHost) throw new ForbiddenError('Only owner or host can start');

    if (room.status !== 'waiting' && room.status !== 'ready') {
      throw new BadRequestError('Room cannot be started in current state');
    }

    room.status = 'active';
    room.currentPhase = 'motion';
    room.startedAt = new Date();
    await room.save();

    sendSuccess(res, room, 'Debate started');
  }),
);

// POST /api/v1/rooms/:id/leave — Leave room (UC-23)
router.post(
  '/:id/leave',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== req.user!.userId,
    ) as any;
    await room.save();

    sendSuccess(res, null, 'Left room');
  }),
);

// POST /api/v1/rooms/:id/kick — Kick participant (UC-24)
router.post(
  '/:id/kick',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only owner can kick');
    }

    const { userId } = req.body;
    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, room, 'Participant kicked');
  }),
);

export default router;
