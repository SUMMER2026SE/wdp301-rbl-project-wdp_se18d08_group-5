import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess, sendPaginated } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { applyDebateResult } from '../ranking/ranking.service.js';
import { startDebate } from '../debate/debate.service.js';
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
          muted: false,
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

// PUT /api/v1/rooms/:id — Edit room (UC-16)
router.put(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('+password');
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can edit the room');
    }
    if (['active', 'paused', 'completed'].includes(room.status)) {
      throw new BadRequestError('Cannot edit a room that has already started');
    }

    const {
      title,
      format,
      hostType,
      judgeType,
      judgeCount,
      isPrivate,
      password,
      motion,
    } = req.body;

    if (title !== undefined) room.title = title;
    if (format !== undefined) room.format = format;
    if (hostType !== undefined) room.hostType = hostType;
    if (judgeType !== undefined) room.judgeType = judgeType;
    if (judgeCount !== undefined) room.judgeCount = judgeCount;
    if (motion !== undefined) room.motion = motion;
    if (isPrivate !== undefined) {
      room.isPrivate = isPrivate;
      room.password = isPrivate ? password || room.password : null;
    }
    if (isPrivate && password !== undefined) {
      room.password = password;
    }

    await room.save();
    sendSuccess(res, room, 'Room updated');
  }),
);

// DELETE /api/v1/rooms/:id — Delete room (UC-17)
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can delete the room');
    }
    if (room.status === 'active' || room.status === 'paused') {
      throw new BadRequestError('Cannot delete a room while a debate is in progress');
    }

    await room.deleteOne();
    sendSuccess(res, null, 'Room deleted');
  }),
);

// POST /api/v1/rooms/:id/assign-role — Assign host/judge role (UC-22)
router.post(
  '/:id/assign-role',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, role } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');
    if (room.createdBy.toString() !== req.user!.userId) {
      throw new ForbiddenError('Only the room owner can assign roles');
    }
    if (!['host', 'judge'].includes(role)) {
      throw new BadRequestError('Role must be host or judge');
    }

    const participant = room.participants.find((p) => p.userId.toString() === userId);
    if (!participant) {
      throw new NotFoundError('Participant not found');
    }

    if (role === 'host') {
      room.hostId = participant.userId as any;
      participant.roomRole = 'host';
    }

    if (role === 'judge') {
      participant.roomRole = 'judge';
      room.judges = room.judges || [];
      const alreadyJudge = room.judges.some((judge) => judge.userId.toString() === userId);
      if (!alreadyJudge) {
        room.judges.push({ userId: participant.userId as any, username: participant.username });
      }
    }

    await room.save();
    sendSuccess(res, room, 'Role assigned');
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
      muted: false,
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
    if (!roomRole && team && speakerSlot && participant.roomRole === 'viewer') {
      participant.roomRole = 'debater';
    }

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

// POST /api/v1/rooms/:id/lock — Alias for checklist/Postman compatibility
router.post(
  '/:id/lock',
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
    const result = await startDebate(req.params.id, req.user!.userId);
    sendSuccess(res, result, 'Debate started');
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

// POST /api/v1/rooms/:id/host/pause — Pause debate (UC-25)
router.post(
  '/:id/host/pause',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can pause');
    if (room.status !== 'active') {
      throw new BadRequestError('Room is not active');
    }

    room.status = 'paused';
    await room.save();

    sendSuccess(res, { status: room.status }, 'Debate paused');
  }),
);

// POST /api/v1/rooms/:id/host/resume — Resume debate (UC-26)
router.post(
  '/:id/host/resume',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can resume');
    if (room.status !== 'paused') {
      throw new BadRequestError('Room is not paused');
    }

    room.status = 'active';
    await room.save();

    sendSuccess(res, { status: room.status }, 'Debate resumed');
  }),
);

// POST /api/v1/rooms/:id/host/next-turn — Advance the debate turn (UC-27)
router.post(
  '/:id/host/next-turn',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, phase, timeLimit, transcript } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can advance turns');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    const currentTurn = session.currentTurn;
    const now = new Date();

    if (currentTurn.startTime) {
      const duration = now.getTime() - currentTurn.startTime.getTime();
      session.turnHistory.push({
        speaker: currentTurn.speaker,
        startTime: currentTurn.startTime,
        endTime: now,
        duration,
        transcript: transcript || '',
        crossExamination: currentTurn.phase === 'cross_exam' ? { questionsAsked: 0, questionsAnswered: 0, timeRemainingPro: 0, timeRemainingOpp: 0, transcript: [] } : null,
        aiAnalysis: null,
      });
    }

    session.currentTurn = {
      speaker: nextSpeaker || currentTurn.speaker,
      phase: phase || currentTurn.phase,
      startTime: new Date(),
      timeLimit: timeLimit ?? currentTurn.timeLimit,
      timeRemaining: timeLimit ?? currentTurn.timeRemaining,
      status: 'active',
    };

    await session.save();
    sendSuccess(res, session.currentTurn, 'Turn advanced');
  }),
);

// POST /api/v1/rooms/:id/host/issue-card — Issue yellow card (UC-28)
router.post(
  '/:id/host/issue-card',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, reason } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can issue cards');

    const session = await DebateSession.findOne({ roomId: room._id });
    if (!session) throw new NotFoundError('Session not found');

    session.cards.push({
      type: 'yellow',
      issuedTo: userId,
      issuedBy: req.user!.userId as any,
      reason,
      timestamp: new Date(),
    });
    await session.save();

    sendSuccess(res, { userId, reason }, 'Yellow card issued');
  }),
);

// POST /api/v1/rooms/:id/host/kick — Kick participant from active debate (UC-29)
router.post(
  '/:id/host/kick',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can kick');

    room.participants = room.participants.filter(
      (p) => p.userId.toString() !== userId,
    ) as any;
    await room.save();

    sendSuccess(res, room, 'Participant kicked from debate');
  }),
);

// POST /api/v1/rooms/:id/host/mute — Mute/unmute a participant (UC-30)
router.post(
  '/:id/host/mute',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, action, type } = req.body;
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can mute participants');

    const participant = room.participants.find((p) => p.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    const muteAction = type || action;
    if (!['mute', 'unmute'].includes(muteAction)) {
      throw new BadRequestError('Mute type must be mute or unmute');
    }

    participant.muted = muteAction === 'mute';
    await room.save();

    sendSuccess(res, { userId, muted: participant.muted }, `Participant ${participant.muted ? 'muted' : 'unmuted'}`);
  }),
);

// POST /api/v1/rooms/:id/judge/submit-score — Judge submit score (UC-35)
router.post(
  '/:id/judge/submit-score',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { speaker, score, notes, logic, rebuttal, evidence, crossExam, strategy, communication } = req.body;
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    if (!session.finalScores) {
      session.finalScores = {
        teamProposition: { total: 0, breakdown: {} },
        teamOpposition: { total: 0, breakdown: {} },
        winner: 'draw',
        aiVerdict: 'pending',
        judgeVerdicts: [],
      };
    }

    const finalScores = session.finalScores as {
      judgeVerdicts: any[];
    };
    finalScores.judgeVerdicts = finalScores.judgeVerdicts || [];
    const scorePayload = score || {
      logic,
      rebuttal,
      evidence,
      crossExam,
      strategy,
      communication,
    };

    finalScores.judgeVerdicts.push({
      judgeId: req.user!.userId as any,
      speaker,
      score: scorePayload,
      notes: notes || '',
      submittedAt: new Date(),
    });

    await session.save();
    sendSuccess(res, { speaker, score: scorePayload, notes }, 'Score submitted');
  }),
);

// GET /api/v1/rooms/:id/scores — Get current scores for the room (UC-36)
router.get(
  '/:id/scores',
  asyncHandler(async (req: Request, res: Response) => {
    const room = await DebateRoom.findById(req.params.id).select('participants judgeType');
    if (!room) throw new NotFoundError('Room not found');

    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    sendSuccess(res, {
      finalScores: session.finalScores,
      judgeVerdicts: session.finalScores?.judgeVerdicts || [],
      turnHistory: session.turnHistory,
      participants: room.participants,
    });
  }),
);

// POST /api/v1/rooms/:id/cross-exam/pass-turn — Pass the cross-exam turn (UC-32)
router.post(
  '/:id/cross-exam/pass-turn',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { nextSpeaker, transcript } = req.body;
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    const now = new Date();
    const duration = now.getTime() - session.currentTurn.startTime.getTime();
    session.turnHistory.push({
      speaker: session.currentTurn.speaker,
      startTime: session.currentTurn.startTime,
      endTime: now,
      duration,
      transcript: transcript || '',
      crossExamination: { questionsAsked: 0, questionsAnswered: 0, timeRemainingPro: 0, timeRemainingOpp: 0, transcript: [] },
      aiAnalysis: null,
    });

    session.currentTurn = {
      speaker: nextSpeaker || session.currentTurn.speaker,
      phase: 'cross_exam',
      startTime: new Date(),
      timeLimit: session.currentTurn.timeLimit,
      timeRemaining: session.currentTurn.timeRemaining,
      status: 'active',
    };

    await session.save();
    sendSuccess(res, session.currentTurn, 'Cross-exam turn passed');
  }),
);

// POST /api/v1/rooms/:id/cross-exam/finish — Finish cross-examination (UC-33)
router.post(
  '/:id/cross-exam/finish',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    if (session.currentTurn.phase !== 'cross_exam') {
      throw new BadRequestError('Current phase is not cross-exam');
    }

    session.currentTurn.status = 'completed';
    session.currentTurn.phase = 'judge_feedback';
    await session.save();

    sendSuccess(res, session.currentTurn, 'Cross-exam finished');
  }),
);

// GET /api/v1/rooms/:id/session — Get session data (UC-31)
router.get(
  '/:id/session',
  asyncHandler(async (req: Request, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');
    sendSuccess(res, session);
  }),
);

// GET /api/v1/rooms/:id/replay — Get replay data
router.get(
  '/:id/replay',
  asyncHandler(async (req: Request, res: Response) => {
    const session = await DebateSession.findOne({ roomId: req.params.id });
    if (!session) throw new NotFoundError('Session not found');

    const room = await DebateRoom.findById(req.params.id).select('title motion format participants');
    sendSuccess(res, { room, session });
  }),
);

// POST /api/v1/rooms/:id/result — Apply final result to ranking for rank rooms
router.post(
  '/:id/result',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const room = await DebateRoom.findById(req.params.id);
    if (!room) throw new NotFoundError('Room not found');

    const isHost = room.hostId?.toString() === req.user!.userId;
    const isOwner = room.createdBy.toString() === req.user!.userId;
    if (!isHost && !isOwner) throw new ForbiddenError('Only host or owner can finalize result');

    const rankingResult = await applyDebateResult(req.params.id);
    sendSuccess(res, rankingResult, rankingResult.applied ? 'Result applied' : 'Result not applied');
  }),
);

export default router;
