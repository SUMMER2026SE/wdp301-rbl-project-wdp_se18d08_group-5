import { Types } from 'mongoose';
import { MatchQueue, type IMatchQueue } from '../../models/MatchQueue.js';
import { DebateRoom, type IDebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { User } from '../../models/User.js';
import { getIO } from '../../socket/index.js';

const REQUIRED_PLAYERS_BY_FORMAT: Record<string, number> = {
  '1v1': 2,
  '3v3': 6,
};

const SPEAKER_SLOTS = ['S1', 'S2', 'S3'];

function buildRankParticipants(users: Array<{ _id: Types.ObjectId; username: string; profile?: { avatar?: string } }>) {
  return users.map((user, index) => {
    const team = index % 2 === 0 ? 'proposition' : 'opposition';
    const speakerIndex = Math.floor(index / 2);

    return {
      userId: user._id,
      username: user.username,
      avatar: user.profile?.avatar || '',
      roomRole: 'debater',
      team,
      speakerSlot: SPEAKER_SLOTS[speakerIndex] || null,
      positionLocked: true,
      muted: false,
    };
  });
}

function emitMatchFound(userIds: Types.ObjectId[], roomId: Types.ObjectId) {
  try {
    const io = getIO();
    userIds.forEach((userId) => {
      io.to(`user:${userId.toString()}`).emit('match:found', { roomId });
    });
  } catch {
    // REST tests can run without Socket.IO initialized.
  }
}

type MatchResult =
  | { matched: false; room?: never }
  | { matched: true; room: IDebateRoom };

export async function tryCreateRankMatch(entry: IMatchQueue): Promise<MatchResult> {
  const requiredPlayers = REQUIRED_PLAYERS_BY_FORMAT[entry.format] || 2;

  const queueEntries = await MatchQueue.find({
    _id: { $ne: entry._id },
    format: entry.format,
    status: 'waiting',
  })
    .sort({ createdAt: 1 })
    .limit(requiredPlayers - 1);

  if (queueEntries.length < requiredPlayers - 1) {
    return { matched: false };
  }

  const matchedEntries = [entry, ...queueEntries];
  const userIds = matchedEntries.map((queueEntry) => queueEntry.userId);
  const users = await User.find({ _id: { $in: userIds } }).select('username profile.avatar');

  if (users.length !== requiredPlayers) {
    return { matched: false };
  }

  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const orderedUsers = userIds
    .map((userId) => usersById.get(userId.toString()))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));

  const room = await DebateRoom.create({
    roomType: 'rank',
    title: `Rank ${entry.format} Match`,
    format: entry.format,
    hostType: 'ai',
    judgeType: 'ai',
    judgeCount: 1,
    isPrivate: false,
    password: null,
    createdBy: entry.userId,
    status: 'active',
    currentPhase: 'motion',
    startedAt: new Date(),
    participants: buildRankParticipants(orderedUsers),
  });

  await DebateSession.create({
    roomId: room._id,
    currentTurn: {
      speaker: 'HOST',
      phase: 'motion',
      startTime: new Date(),
      timeLimit: 60,
      timeRemaining: 60,
      status: 'active',
    },
  });

  await MatchQueue.updateMany(
    { _id: { $in: matchedEntries.map((queueEntry) => queueEntry._id) } },
    { status: 'matched', matchedRoomId: room._id },
  );

  emitMatchFound(userIds, room._id);

  return { matched: true, room };
}
