import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { Message } from '../../models/Message.js';
import { Report } from '../../models/Report.js';
import { User } from '../../models/User.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { getIO } from '../../socket/index.js';
import type { AuthRequest } from '../../types/index.js';
import {
  adminReportListQuerySchema,
  adminRoomListQuerySchema,
  adminRoomMuteSchema,
  adminRoomParticipantActionSchema,
  adminUserListQuerySchema,
  adminViewerChatSchema,
  banUserSchema,
  updateReportSchema,
  updateRoomStatusSchema,
  updateUserRoleSchema,
} from './admin.schema.js';

const router = Router();

const adminUserSelect = [
  '_id',
  'username',
  'email',
  'role',
  'authProvider',
  'isEmailVerified',
  'isBanned',
  'banReason',
  'bannedUntil',
  'bannedAt',
  'profile.displayName',
  'profile.avatar',
  'stats',
  'ranking',
  'createdAt',
  'updatedAt',
].join(' ');

type BanInput = {
  durationPreset: '1h' | '24h' | '7d' | '30d' | 'custom';
  customDurationValue?: number;
  customDurationUnit?: 'minutes' | 'hours' | 'days';
  reason?: string;
};

type AdminUserPayload = {
  _id: unknown;
  username: string;
  email: string;
  role: string;
  authProvider: string;
  isEmailVerified: boolean;
  isBanned?: boolean;
  banReason?: string;
  bannedUntil?: Date | string | null;
  bannedAt?: Date | string | null;
  profile?: {
    displayName?: string;
    avatar?: string;
  };
  stats?: unknown;
  ranking?: unknown;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type AdminRoomParticipantPayload = {
  userId: unknown;
  username?: string;
  avatar?: string;
  roomRole?: string;
  team?: string | null;
  speakerSlot?: string | null;
  positionLocked?: boolean;
  muted?: boolean;
};

type AdminRoomPayload = {
  _id: unknown;
  roomType?: string;
  title?: string;
  motion?: string;
  status?: string;
  format?: string;
  isPrivate?: boolean;
  createdBy?: unknown;
  hostType?: string;
  hostId?: unknown | null;
  viewerChatEnabled?: boolean;
  judgeType?: string;
  judgeCount?: number;
  participants?: AdminRoomParticipantPayload[];
  currentPhase?: string;
  eloApplied?: boolean;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

type AdminSessionPayload = {
  _id: unknown;
  currentTurn?: unknown;
  turnHistory?: unknown[];
  cards?: unknown[];
  finalScores?: unknown;
};

type AdminReportPayload = {
  _id: unknown;
  targetType?: string;
  targetId?: unknown | null;
  reporterId?: unknown;
  reporterName?: string;
  reportedUserId?: unknown | null;
  reportedUserName?: string;
  roomId?: unknown | null;
  roomTitle?: string;
  messageId?: unknown | null;
  messageSnippet?: string;
  reason?: string;
  details?: string;
  status?: string;
  resolution?: string;
  adminNote?: string;
  resolvedBy?: unknown | null;
  resolvedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function asPayload<T>(value: unknown) {
  const maybeDocument = value as { toObject?: () => T };
  return typeof maybeDocument.toObject === 'function'
    ? maybeDocument.toObject()
    : value as T;
}

function idToString(value: unknown) {
  return value && typeof (value as { toString: () => string }).toString === 'function'
    ? (value as { toString: () => string }).toString()
    : '';
}

function isActiveBan(user: { isBanned?: boolean; bannedUntil?: Date | string | null }) {
  if (!user.isBanned) return false;
  if (!user.bannedUntil) return true;
  return new Date(user.bannedUntil).getTime() > Date.now();
}

function activeBanFilter(now = new Date()) {
  return {
    isBanned: true,
    $or: [{ bannedUntil: null }, { bannedUntil: { $gt: now } }],
  };
}

function toAdminUserPayload(user: unknown) {
  const payload = asPayload<AdminUserPayload>(user);

  return {
    _id: idToString(payload._id),
    username: payload.username,
    email: payload.email,
    role: payload.role,
    authProvider: payload.authProvider,
    isEmailVerified: payload.isEmailVerified,
    isBanned: isActiveBan(payload),
    banReason: payload.banReason || '',
    bannedUntil: payload.bannedUntil,
    bannedAt: payload.bannedAt,
    profile: {
      displayName: payload.profile?.displayName || '',
      avatar: payload.profile?.avatar || '',
    },
    stats: payload.stats,
    ranking: payload.ranking,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function toAdminRoomPayload(room: unknown, session?: unknown) {
  const payload = asPayload<AdminRoomPayload>(room);
  const sessionPayload = session ? asPayload<AdminSessionPayload>(session) : null;
  const participants = (payload.participants || []).map((participant) => ({
    userId: idToString(participant.userId),
    username: participant.username || 'User',
    avatar: participant.avatar || '',
    roomRole: participant.roomRole,
    team: participant.team,
    speakerSlot: participant.speakerSlot,
    positionLocked: Boolean(participant.positionLocked),
    muted: Boolean(participant.muted),
  }));
  const hostId = payload.hostId ? idToString(payload.hostId) : null;
  const host = participants.find((participant) => participant.userId === hostId) || null;

  return {
    _id: idToString(payload._id),
    roomType: payload.roomType,
    title: payload.title || '',
    motion: payload.motion || '',
    status: payload.status,
    format: payload.format,
    isPrivate: Boolean(payload.isPrivate),
    createdBy: idToString(payload.createdBy),
    hostType: payload.hostType,
    hostId,
    hostName: host?.username || '',
    viewerChatEnabled: Boolean(payload.viewerChatEnabled),
    judgeType: payload.judgeType,
    judgeCount: payload.judgeCount,
    participants,
    participantCount: participants.length,
    debaterCount: participants.filter((participant) => participant.roomRole === 'debater').length,
    judgeAssignedCount: participants.filter((participant) => participant.roomRole === 'judge').length,
    mutedCount: participants.filter((participant) => participant.muted).length,
    currentPhase: payload.currentPhase,
    eloApplied: Boolean(payload.eloApplied),
    startedAt: payload.startedAt,
    endedAt: payload.endedAt,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    session: sessionPayload
      ? {
        _id: idToString(sessionPayload._id),
        currentTurn: sessionPayload.currentTurn,
        turnCount: sessionPayload.turnHistory?.length || 0,
        cardCount: sessionPayload.cards?.length || 0,
        hasFinalScores: Boolean(sessionPayload.finalScores),
        finalScores: sessionPayload.finalScores,
      }
      : null,
  };
}

function toReportPayload(report: unknown) {
  const payload = asPayload<AdminReportPayload>(report);

  return {
    _id: idToString(payload._id),
    targetType: payload.targetType,
    targetId: payload.targetId ? idToString(payload.targetId) : null,
    reporterId: idToString(payload.reporterId),
    reporterName: payload.reporterName || '',
    reportedUserId: payload.reportedUserId ? idToString(payload.reportedUserId) : null,
    reportedUserName: payload.reportedUserName || '',
    roomId: payload.roomId ? idToString(payload.roomId) : null,
    roomTitle: payload.roomTitle || '',
    messageId: payload.messageId ? idToString(payload.messageId) : null,
    messageSnippet: payload.messageSnippet || '',
    reason: payload.reason,
    details: payload.details || '',
    status: payload.status,
    resolution: payload.resolution,
    adminNote: payload.adminNote || '',
    resolvedBy: payload.resolvedBy ? idToString(payload.resolvedBy) : null,
    resolvedAt: payload.resolvedAt,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  };
}

function resolveBanExpiry(input: BanInput) {
  const now = Date.now();
  const presetDurations = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  } as const;

  if (input.durationPreset !== 'custom') {
    return new Date(now + presetDurations[input.durationPreset]);
  }

  const unitMultipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  } as const;

  return new Date(now + (input.customDurationValue as number) * unitMultipliers[input.customDurationUnit as 'minutes' | 'hours' | 'days']);
}

function emitRoomAdminEvent(roomId: string, event: string, payload: Record<string, unknown>) {
  try {
    getIO().to(roomId).emit(event, payload);
  } catch {
    // Socket may be unavailable in isolated route tests.
  }
}

router.use(authenticate, authorize('admin'));

router.get(
  '/overview',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yellowCardAggregation = DebateSession.aggregate<{ total: number }>([
      { $project: { cardCount: { $size: { $ifNull: ['$cards', []] } } } },
      { $group: { _id: null, total: { $sum: '$cardCount' } } },
    ]);

    const [
      totalUsers,
      adminUsers,
      bannedUsers,
      pendingUsers,
      newUsersToday,
      totalRooms,
      waitingRooms,
      readyRooms,
      activeRooms,
      pausedRooms,
      completedRooms,
      cancelledRooms,
      rankRooms,
      customRooms,
      totalReports,
      openReports,
      reviewingReports,
      resolvedReports,
      dismissedReports,
      toxicMessages,
      yellowCardRows,
      recentUsers,
      recentRooms,
      recentReports,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments(activeBanFilter(now)),
      User.countDocuments({ isEmailVerified: false }),
      User.countDocuments({ createdAt: { $gte: today } }),
      DebateRoom.countDocuments(),
      DebateRoom.countDocuments({ status: 'waiting' }),
      DebateRoom.countDocuments({ status: 'ready' }),
      DebateRoom.countDocuments({ status: 'active' }),
      DebateRoom.countDocuments({ status: 'paused' }),
      DebateRoom.countDocuments({ status: 'completed' }),
      DebateRoom.countDocuments({ status: 'cancelled' }),
      DebateRoom.countDocuments({ roomType: 'rank' }),
      DebateRoom.countDocuments({ roomType: 'custom' }),
      Report.countDocuments(),
      Report.countDocuments({ status: 'open' }),
      Report.countDocuments({ status: 'reviewing' }),
      Report.countDocuments({ status: 'resolved' }),
      Report.countDocuments({ status: 'dismissed' }),
      Message.countDocuments({ isToxic: true }),
      yellowCardAggregation,
      User.find().select(adminUserSelect).sort({ createdAt: -1 }).limit(5),
      DebateRoom.find().select('-password').sort({ createdAt: -1 }).limit(5),
      Report.find().sort({ createdAt: -1 }).limit(5),
    ]);

    sendSuccess(res, {
      users: {
        total: totalUsers,
        admins: adminUsers,
        banned: bannedUsers,
        pendingVerification: pendingUsers,
        newToday: newUsersToday,
      },
      rooms: {
        total: totalRooms,
        waiting: waitingRooms,
        ready: readyRooms,
        active: activeRooms,
        paused: pausedRooms,
        completed: completedRooms,
        cancelled: cancelledRooms,
        rank: rankRooms,
        custom: customRooms,
      },
      reports: {
        total: totalReports,
        open: openReports,
        reviewing: reviewingReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
      },
      moderation: {
        toxicMessages,
        yellowCards: yellowCardRows[0]?.total || 0,
      },
      recentUsers: recentUsers.map((user) => toAdminUserPayload(user)),
      recentRooms: recentRooms.map((room) => toAdminRoomPayload(room)),
      recentReports: recentReports.map((report) => toReportPayload(report)),
    });
  }),
);

router.get(
  '/users',
  validateQuery(adminUserListQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as unknown as {
      page: number;
      limit: number;
      search: string;
      role?: 'admin' | 'user';
      status?: 'active' | 'banned' | 'pending';
    };

    const { page, limit, search, role, status } = query;
    const skip = (page - 1) * limit;
    const filters: Record<string, unknown>[] = [];

    if (role) {
      filters.push({ role });
    }

    if (status === 'banned') {
      filters.push(activeBanFilter());
    }

    if (status === 'pending') {
      filters.push({ isEmailVerified: false, isBanned: { $ne: true } });
    }

    if (status === 'active') {
      filters.push({
        isEmailVerified: true,
        $or: [
          { isBanned: { $ne: true } },
          { bannedUntil: { $lte: new Date() } },
        ],
      });
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.push({
        $or: [
          { username: { $regex: escapedSearch, $options: 'i' } },
          { email: { $regex: escapedSearch, $options: 'i' } },
          { 'profile.displayName': { $regex: escapedSearch, $options: 'i' } },
        ],
      });
    }

    const filter = filters.length > 0 ? { $and: filters } : {};
    const [users, total] = await Promise.all([
      User.find(filter)
        .select(adminUserSelect)
        .sort({ createdAt: -1, username: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    sendPaginated(res, users.map((user) => toAdminUserPayload(user)), { page, limit, total });
  }),
);

router.get(
  '/users/:userId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.userId)) {
      throw new NotFoundError('User not found');
    }

    const user = await User.findById(req.params.userId).select(adminUserSelect);
    if (!user) throw new NotFoundError('User not found');

    const [roomsCreated, roomsJoined, reportsFiled, reportsReceived] = await Promise.all([
      DebateRoom.countDocuments({ createdBy: req.params.userId }),
      DebateRoom.countDocuments({ 'participants.userId': req.params.userId }),
      Report.countDocuments({ reporterId: req.params.userId }),
      Report.countDocuments({ reportedUserId: req.params.userId }),
    ]);

    sendSuccess(res, {
      user: toAdminUserPayload(user),
      activity: {
        roomsCreated,
        roomsJoined,
        reportsFiled,
        reportsReceived,
      },
    });
  }),
);

router.patch(
  '/users/:userId/role',
  validate(updateUserRoleSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body as { role: 'admin' | 'user' };

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot change your own role');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User role updated');
  }),
);

router.post(
  '/users/:userId/ban',
  validate(banUserSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;
    const payload = req.body as BanInput;

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot ban your own account');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isBanned: true,
        banReason: payload.reason || '',
        bannedAt: new Date(),
        bannedBy: req.user!.userId,
        bannedUntil: resolveBanExpiry(payload),
      },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User banned');
  }),
);

router.post(
  '/users/:userId/unban',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    if (req.user!.userId === userId) {
      throw new ForbiddenError('Cannot unban your own account here');
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isBanned: false,
        banReason: '',
        bannedAt: null,
        bannedBy: null,
        bannedUntil: null,
      },
      {
        new: true,
        runValidators: true,
      },
    ).select(adminUserSelect);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, toAdminUserPayload(user), 'User unbanned');
  }),
);

router.get(
  '/rooms',
  validateQuery(adminRoomListQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as unknown as {
      page: number;
      limit: number;
      search: string;
      status?: string;
      roomType?: string;
      format?: string;
    };
    const { page, limit, search, status, roomType, format } = query;
    const skip = (page - 1) * limit;
    const filters: Record<string, unknown>[] = [];

    if (status) filters.push({ status });
    if (roomType) filters.push({ roomType });
    if (format) filters.push({ format });

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.push({
        $or: [
          { title: { $regex: escapedSearch, $options: 'i' } },
          { motion: { $regex: escapedSearch, $options: 'i' } },
          { 'participants.username': { $regex: escapedSearch, $options: 'i' } },
        ],
      });
    }

    const filter = filters.length > 0 ? { $and: filters } : {};
    const [rooms, total] = await Promise.all([
      DebateRoom.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      DebateRoom.countDocuments(filter),
    ]);

    sendPaginated(res, rooms.map((room) => toAdminRoomPayload(room)), { page, limit, total });
  }),
);

router.get(
  '/rooms/:roomId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!Types.ObjectId.isValid(req.params.roomId)) {
      throw new NotFoundError('Room not found');
    }

    const room = await DebateRoom.findById(req.params.roomId).select('-password');
    if (!room) throw new NotFoundError('Room not found');

    const [session, toxicMessages] = await Promise.all([
      DebateSession.findOne({ roomId: room._id }),
      Message.find({ roomId: room._id, isToxic: true }).sort({ timestamp: -1 }).limit(10),
    ]);

    sendSuccess(res, {
      room: toAdminRoomPayload(room, session),
      toxicMessages: toxicMessages.map((message) => ({
        _id: idToString(message._id),
        senderId: idToString(message.senderId),
        senderName: message.senderName,
        senderRole: message.senderRole,
        content: message.content,
        type: message.type,
        timestamp: message.timestamp,
      })),
    });
  }),
);

router.patch(
  '/rooms/:roomId/status',
  validate(updateRoomStatusSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { status, reason } = req.body as {
      status: 'waiting' | 'ready' | 'active' | 'paused' | 'completed' | 'cancelled';
      reason: string;
    };

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundError('Room not found');
    }

    const room = await DebateRoom.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    room.status = status;
    if (status === 'active' && !room.startedAt) {
      room.startedAt = new Date();
    }
    if (status === 'completed') {
      room.currentPhase = 'completed';
      room.endedAt = room.endedAt || new Date();
    }
    if (status === 'cancelled') {
      room.endedAt = room.endedAt || new Date();
    }
    if (status === 'waiting' || status === 'ready' || status === 'paused') {
      room.endedAt = null;
    }
    await room.save();

    const session = await DebateSession.findOne({ roomId: room._id });
    if (session && (status === 'completed' || status === 'cancelled')) {
      session.currentTurn.status = 'completed';
      await session.save();
    }

    emitRoomAdminEvent(roomId, 'admin:room-status-updated', {
      roomId,
      status,
      reason,
      updatedBy: req.user!.userId,
    });
    sendSuccess(res, toAdminRoomPayload(room, session), 'Room status updated');
  }),
);

router.post(
  '/rooms/:roomId/kick',
  validate(adminRoomParticipantActionSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { userId, reason } = req.body as { userId: string; reason: string };

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundError('Room not found');
    }

    const room = await DebateRoom.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    const participant = room.participants.find((entry) => entry.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    room.participants = room.participants.filter(
      (entry) => entry.userId.toString() !== userId,
    ) as typeof room.participants;
    room.judges = (room.judges || []).filter(
      (judge) => judge.userId.toString() !== userId,
    ) as typeof room.judges;
    if (room.hostId?.toString() === userId) {
      room.hostId = null;
    }
    await room.save();

    emitRoomAdminEvent(roomId, 'admin:participant-kicked', {
      roomId,
      userId,
      reason,
      updatedBy: req.user!.userId,
    });
    emitRoomAdminEvent(roomId, 'room:participant-update', {
      participants: room.participants,
    });

    sendSuccess(res, toAdminRoomPayload(room), 'Participant removed by admin');
  }),
);

router.post(
  '/rooms/:roomId/mute',
  validate(adminRoomMuteSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { userId, muted, reason } = req.body as { userId: string; muted: boolean; reason: string };

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundError('Room not found');
    }

    const room = await DebateRoom.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    const participant = room.participants.find((entry) => entry.userId.toString() === userId);
    if (!participant) throw new NotFoundError('Participant not found');

    participant.muted = muted;
    await room.save();

    emitRoomAdminEvent(roomId, 'admin:participant-muted', {
      roomId,
      userId,
      muted,
      reason,
      updatedBy: req.user!.userId,
    });
    emitRoomAdminEvent(roomId, 'room:participant-update', {
      participants: room.participants,
    });

    sendSuccess(res, toAdminRoomPayload(room), muted ? 'Participant muted by admin' : 'Participant unmuted by admin');
  }),
);

router.patch(
  '/rooms/:roomId/viewer-chat',
  validate(adminViewerChatSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { enabled } = req.body as { enabled: boolean };

    if (!Types.ObjectId.isValid(roomId)) {
      throw new NotFoundError('Room not found');
    }

    const room = await DebateRoom.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    room.viewerChatEnabled = enabled;
    await room.save();

    emitRoomAdminEvent(roomId, 'chat:viewer-chat-updated', {
      roomId,
      viewerChatEnabled: enabled,
      updatedBy: req.user!.userId,
    });

    sendSuccess(res, toAdminRoomPayload(room), `Viewer chat ${enabled ? 'enabled' : 'disabled'}`);
  }),
);

router.get(
  '/reports',
  validateQuery(adminReportListQuerySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const query = req.query as unknown as {
      page: number;
      limit: number;
      search: string;
      status?: string;
      targetType?: string;
    };
    const { page, limit, search, status, targetType } = query;
    const skip = (page - 1) * limit;
    const filters: Record<string, unknown>[] = [];

    if (status) filters.push({ status });
    if (targetType) filters.push({ targetType });

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filters.push({
        $or: [
          { reporterName: { $regex: escapedSearch, $options: 'i' } },
          { reportedUserName: { $regex: escapedSearch, $options: 'i' } },
          { roomTitle: { $regex: escapedSearch, $options: 'i' } },
          { messageSnippet: { $regex: escapedSearch, $options: 'i' } },
          { details: { $regex: escapedSearch, $options: 'i' } },
        ],
      });
    }

    const filter = filters.length > 0 ? { $and: filters } : {};
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Report.countDocuments(filter),
    ]);

    sendPaginated(res, reports.map((report) => toReportPayload(report)), { page, limit, total });
  }),
);

router.patch(
  '/reports/:reportId',
  validate(updateReportSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reportId } = req.params;
    const payload = req.body as {
      status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
      resolution: 'none' | 'warned' | 'muted' | 'banned' | 'dismissed';
      adminNote: string;
      ban?: BanInput;
    };

    if (!Types.ObjectId.isValid(reportId)) {
      throw new NotFoundError('Report not found');
    }

    const report = await Report.findById(reportId);
    if (!report) throw new NotFoundError('Report not found');

    let moderatedUser = null;
    if (payload.resolution === 'banned') {
      if (!report.reportedUserId) {
        throw new BadRequestError('Report has no reported user to ban');
      }
      if (report.reportedUserId.toString() === req.user!.userId) {
        throw new ForbiddenError('Cannot ban your own account');
      }

      moderatedUser = await User.findByIdAndUpdate(
        report.reportedUserId,
        {
          isBanned: true,
          banReason: payload.ban?.reason || payload.adminNote || report.details || 'Report violation',
          bannedAt: new Date(),
          bannedBy: req.user!.userId,
          bannedUntil: resolveBanExpiry(payload.ban as BanInput),
        },
        { new: true, runValidators: true },
      ).select(adminUserSelect);

      if (!moderatedUser) throw new NotFoundError('Reported user not found');
      report.status = 'resolved';
    } else if (payload.resolution === 'muted') {
      if (!report.roomId || !report.reportedUserId) {
        throw new BadRequestError('Report needs a room and reported user for mute action');
      }

      const room = await DebateRoom.findById(report.roomId);
      if (!room) throw new NotFoundError('Room not found');

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === report.reportedUserId?.toString(),
      );
      if (!participant) throw new NotFoundError('Participant not found');
      participant.muted = true;
      await room.save();

      emitRoomAdminEvent(room._id.toString(), 'admin:participant-muted', {
        roomId: room._id.toString(),
        userId: report.reportedUserId.toString(),
        muted: true,
        reason: payload.adminNote || report.details,
        updatedBy: req.user!.userId,
      });
      report.status = 'resolved';
    } else if (payload.resolution === 'dismissed') {
      report.status = 'dismissed';
    } else {
      report.status = payload.status;
    }

    report.resolution = payload.resolution;
    report.adminNote = payload.adminNote;

    if (report.status === 'resolved' || report.status === 'dismissed') {
      report.resolvedBy = new Types.ObjectId(req.user!.userId);
      report.resolvedAt = new Date();
    } else {
      report.resolvedBy = null;
      report.resolvedAt = null;
    }

    await report.save();

    sendSuccess(res, {
      report: toReportPayload(report),
      moderatedUser: moderatedUser ? toAdminUserPayload(moderatedUser) : null,
    }, 'Report updated');
  }),
);

export default router;
