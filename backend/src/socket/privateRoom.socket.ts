import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { DebateRoom, IDebateRoom } from '../models/DebateRoom.js';
import { Message } from '../models/Message.js';
import { getIO } from './index.js';
import { privateRoomKey, privateRooms, type PrivateRoomTeam } from './privateRoomState.js';

function canJoinPrivateRoom(
  participant: IDebateRoom['participants'][0] | undefined,
  userId: string,
  requestedTeam: 'proposition' | 'opposition' | 'judge',
  room: IDebateRoom,
): boolean {
  const effectiveRole = participant
    ? participant.roomRole === 'owner'
      ? participant.primaryRole
      : participant.roomRole
    : null;

  // Host can join any private room
  if (effectiveRole === 'host') return true;

  // Judge S1 in no-host mode can join any private room (acts as Control Panel holder)
  const isJudgeS1 =
    room.hostType !== 'human' &&
    effectiveRole === 'judge' &&
    (participant as any)?.speakerSlot === 'S1';
  if (isJudgeS1) return true;

  // The room creator defaults to host privileges until they pick a different
  // role (e.g. choose to be a debater). This avoids blocking the owner from
  // jumping into any private room during setup.
  const isCreator = room.createdBy?.toString() === userId;
  if (isCreator) return true;

  if (requestedTeam === 'judge') {
    // Judge private room ONLY exists when judgeType is 'human' (per rule docs)
    if (room.judgeType !== 'human') return false;
    if (!participant) return false;
    return effectiveRole === 'judge';
  }

  if (requestedTeam === 'proposition' || requestedTeam === 'opposition') {
    if (!participant) return false;
    return (
      effectiveRole === 'debater' &&
      participant.team === requestedTeam
    );
  }

  return false;
}

async function broadcastPrivateSystemMessage(
  roomId: string,
  team: PrivateRoomTeam,
  content: string,
) {
  const key = privateRoomKey(roomId, team);
  const state = privateRooms.get(key);
  if (!state) return;

  const message = await Message.create({
    roomId,
    senderId: new mongoose.Types.ObjectId('000000000000000000000000'),
    senderName: 'System',
    senderRole: 'host',
    content,
    type: 'system',
    isToxic: false,
    team: team === 'host' ? undefined : (team as 'proposition' | 'opposition' | 'judge'),
  });

  const io = getIO();
        io?.to(key).emit('private-chat:message', {
          _id: message._id,
          roomId,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'host',
          content: message.content,
          type: 'system',
          isToxic: false,
          timestamp: message.timestamp,
          team,
        });
}

export function registerPrivateRoomHandlers(_io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  socket.on(
    'private-room:join',
    async ({ roomId, team }: { roomId: string; team: PrivateRoomTeam }, ack?: (res: { success: boolean; message?: string }) => void) => {
      if (!roomId || !team) {
        ack?.({ success: false, message: 'roomId and team are required' });
        return;
      }

      try {
        const room = await DebateRoom.findById(roomId).select('participants hostType judgeType createdBy');
        if (!room) {
          socket.emit('private-room:error', { message: 'Room not found' });
          ack?.({ success: false, message: 'Room not found' });
          return;
        }

        const participant = room.participants.find(
          (p) => p.userId.toString() === userId,
        );

        if (team === 'host') {
          socket.emit('private-room:error', { message: 'Use the main room' });
          ack?.({ success: false, message: 'Use the main room' });
          return;
        }

        const joinTeam = team as 'proposition' | 'opposition' | 'judge';
        if (!canJoinPrivateRoom(participant, userId, joinTeam, room)) {
          socket.emit('private-room:error', { message: 'You cannot join this private room' });
          ack?.({ success: false, message: 'You cannot join this private room' });
          return;
        }

        const key = privateRoomKey(roomId, team);
        let state = privateRooms.get(key);
        if (!state) {
          state = {
            roomId,
            team: joinTeam,
            participants: new Set(),
          };
          privateRooms.set(key, state);
        }
        state.participants.add(userId);

        socket.join(key);

        // Fetch message history for this private room
        const messageHistoryDocs = await Message.find({
          roomId,
          team: joinTeam,
        })
          .sort({ timestamp: 1 })
          .limit(50)
          .lean();

        // Transform to plain objects for socket emission
        const messageHistory = messageHistoryDocs.map((msg) => ({
          _id: msg._id.toString(),
          roomId: msg.roomId.toString(),
          senderId: msg.senderId.toString(),
          senderName: msg.senderName,
          senderRole: msg.senderRole,
          content: msg.content,
          type: msg.type,
          isToxic: msg.isToxic,
          timestamp: msg.timestamp,
          team: msg.team,
        }));

        socket.emit('private-room:joined', {
          roomId,
          team,
          participantCount: state.participants.size,
          participants: Array.from(state.participants),
          messageHistory,
        });

        await broadcastPrivateSystemMessage(
          roomId,
          team,
          `${participant?.username || userId} joined the ${team} private room`,
        );

        socket.to(key).emit('private-room:participant-update', {
          type: 'joined',
          userId,
          username: participant?.username || 'Unknown',
          team,
          participantCount: state.participants.size,
          participants: Array.from(state.participants),
        });

        ack?.({ success: true });
      } catch (error) {
        console.error('Private room join error:', error);
        socket.emit('private-room:error', { message: 'Failed to join private room' });
        ack?.({ success: false, message: 'Failed to join private room' });
      }
    },
  );

  socket.on(
    'private-room:leave',
    async ({ roomId, team }: { roomId: string; team: PrivateRoomTeam }, ack?: (res: { success: boolean }) => void) => {
      if (!roomId || !team) {
        ack?.({ success: false });
        return;
      }

      const key = privateRoomKey(roomId, team);
      const state = privateRooms.get(key);

      // Broadcast participant update BEFORE leaving the room
      socket.to(key).emit('private-room:participant-update', {
        type: 'left',
        userId,
        team,
        participantCount: state?.participants.size ? state.participants.size - 1 : 0,
        participants: state ? Array.from(state.participants).filter((id) => id !== userId) : [],
      });

      // Update state and clean up
      if (state) {
        state.participants.delete(userId);
        if (state.participants.size === 0) {
          privateRooms.delete(key);
        }
      }

      // Leave the socket room
      socket.leave(key);

      // Broadcast system message about user leaving
      const room = await DebateRoom.findById(roomId).select('participants hostType judgeType createdBy');
      const participant = room?.participants.find(
        (p) => p.userId.toString() === userId,
      );
      await broadcastPrivateSystemMessage(
        roomId,
        team,
        `${participant?.username || userId} left the ${team} private room`,
      );

      // Emit left event to the leaving user
      socket.emit('private-room:left', {
        roomId,
        team,
      });

      ack?.({ success: true });
    },
  );

  socket.on(
    'private-chat:send',
    async ({ roomId, team, content }: { roomId: string; team: PrivateRoomTeam; content: string }) => {
      if (!content?.trim()) return;

      const key = privateRoomKey(roomId, team);
      const state = privateRooms.get(key);
      if (!state || !state.participants.has(userId)) {
        socket.emit('private-chat:error', { message: 'You are not in this private room' });
        return;
      }

      try {
        const room = await DebateRoom.findById(roomId).select('participants hostType judgeType createdBy');
        const participant = room?.participants.find(
          (p) => p.userId.toString() === userId,
        );

        const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : 'viewer';
        const message = await Message.create({
          roomId,
          senderId: new mongoose.Types.ObjectId(userId),
          senderName: participant?.username || 'Unknown',
          senderRole: effectiveRole || 'viewer',
          content: content.trim(),
          type: 'chat',
          isToxic: false,
          team: team === 'host' ? undefined : (team as 'proposition' | 'opposition' | 'judge'),
        });

        const io = getIO();
        io?.to(key).emit('private-chat:message', {
          _id: message._id,
          roomId,
          senderId: message.senderId,
          senderName: message.senderName,
          senderRole: message.senderRole,
          content: message.content,
          type: message.type,
          isToxic: message.isToxic,
          timestamp: message.timestamp,
          team,
        });
      } catch (error) {
        console.error('Private chat send error:', error);
        socket.emit('private-chat:error', { message: 'Failed to send message' });
      }
    },
  );

  socket.on('private-room:list', ({ roomId }: { roomId: string }, ack?: (res: { rooms: Array<{ team: string; participantCount: number }> }) => void) => {
    const rooms: Array<{ team: string; participantCount: number }> = [];
    privateRooms.forEach((state, key) => {
      if (state.roomId === roomId) {
        const team = key.split('::')[1];
        rooms.push({ team, participantCount: state.participants.size });
      }
    });
    ack?.({ rooms });
  });

  socket.on('disconnect', () => {
    privateRooms.forEach((state, key) => {
      if (state.participants.has(userId)) {
        state.participants.delete(userId);
        const io = getIO();
        io?.to(key).emit('private-room:participant-update', {
          type: 'left',
          userId,
          team: state.team,
          participantCount: state.participants.size,
          participants: Array.from(state.participants),
        });
        if (state.participants.size === 0) {
          privateRooms.delete(key);
        }
      }
    });
  });
}
