import { Server, Socket } from 'socket.io';
import { DebateRoom, IDebateRoom } from '../models/DebateRoom.js';
import { Message } from '../models/Message.js';
import { getIO } from './index.js';

type PrivateRoomTeam = 'proposition' | 'opposition' | 'judge' | 'host';

interface PrivateRoomState {
  roomId: string;
  team: 'proposition' | 'opposition' | 'judge';
  participants: Set<string>;
}

const privateRooms = new Map<string, PrivateRoomState>();

function privateRoomKey(roomId: string, team: PrivateRoomTeam): string {
  return `${roomId}::${team}`;
}

function canJoinPrivateRoom(
  participant: IDebateRoom['participants'][0] | undefined,
  _userId: string,
  requestedTeam: 'proposition' | 'opposition' | 'judge',
): boolean {
  if (!participant) return false;

  if (participant.roomRole === 'host' || participant.roomRole === 'owner') return true;

  if (requestedTeam === 'judge') {
    return participant.roomRole === 'judge';
  }

  if (requestedTeam === 'proposition' || requestedTeam === 'opposition') {
    return (
      participant.roomRole === 'debater' &&
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
    senderId: 'system',
    senderName: 'System',
    senderRole: 'host',
    content,
    type: 'system',
    isToxic: false,
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
        const room = await DebateRoom.findById(roomId).select('participants');
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
        if (!canJoinPrivateRoom(participant, userId, joinTeam)) {
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

        socket.emit('private-room:joined', {
          roomId,
          team,
          participantCount: state.participants.size,
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
      if (state) {
        state.participants.delete(userId);
        if (state.participants.size === 0) {
          privateRooms.delete(key);
        }
      }

      socket.leave(key);

      const room = await DebateRoom.findById(roomId).select('participants');
      const participant = room?.participants.find(
        (p) => p.userId.toString() === userId,
      );
      await broadcastPrivateSystemMessage(
        roomId,
        team,
        `${participant?.username || userId} left the ${team} private room`,
      );

      socket.to(key).emit('private-room:participant-update', {
        type: 'left',
        userId,
        team,
        participantCount: state?.participants.size ?? 0,
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
        const room = await DebateRoom.findById(roomId).select('participants');
        const participant = room?.participants.find(
          (p) => p.userId.toString() === userId,
        );

        const message = await Message.create({
          roomId,
          senderId: userId,
          senderName: participant?.username || 'Unknown',
          senderRole: participant?.roomRole || 'viewer',
          content: content.trim(),
          type: 'chat',
          isToxic: false,
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
        });
        if (state.participants.size === 0) {
          privateRooms.delete(key);
        }
      }
    });
  });
}
