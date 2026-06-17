import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { Message } from '../models/Message.js';
import { timerService } from './timer.service.js';
import { ceTimerService } from './ce.socket.js';

type RoomEventPayload = {
  roomId: string;
};

type RoomAck = (payload: { success: boolean; message?: string; data?: unknown }) => void;

/**
 * Track which roomId each socket is currently in (for cleanup on disconnect).
 */
const socketRooms = new Map<string, Set<string>>();

function trackJoin(socketId: string, roomId: string) {
  const set = socketRooms.get(socketId) || new Set<string>();
  set.add(roomId);
  socketRooms.set(socketId, set);
}

function trackLeave(socketId: string, roomId: string) {
  socketRooms.get(socketId)?.delete(roomId);
}

function getSocketRooms(socketId: string): string[] {
  return Array.from(socketRooms.get(socketId) || []);
}

async function buildRoomStatePayload(roomId: string, userId: string) {
  const room = await DebateRoom.findById(roomId).select('-password');
  if (!room) return null;

  const participant = room.participants.find(
    (entry) => entry.userId.toString() === userId,
  );
  if (!participant) return null;

  const [session, messages] = await Promise.all([
    DebateSession.findOne({ roomId: room._id }),
    Message.find({ roomId: room._id }).sort({ timestamp: -1 }).limit(50),
  ]);

  const orderedMessages = messages.reverse().map((message) => ({
    _id: message._id,
    roomId: message.roomId,
    senderId: message.senderId,
    senderName: message.senderName,
    senderRole: message.senderRole,
    content: message.content,
    type: message.type,
    isToxic: message.isToxic,
    timestamp: message.timestamp,
  }));

  const ceState = ceTimerService.getState(roomId);

  return {
    room,
    session,
    participant,
    participants: room.participants,
    currentPhase: session?.currentTurn.phase || room.currentPhase,
    currentTurn: session?.currentTurn || null,
    timeRemaining:
      timerService.getTimeRemaining(roomId) || session?.currentTurn?.timeRemaining || 0,
    isPaused: room.status === 'paused',
    messages: orderedMessages,
    finalScores: session?.finalScores || null,
    viewerChatEnabled: room.viewerChatEnabled !== false,
    ceState: ceState
      ? {
          activeTeam: ceState.activeTeam,
          timeRemainingPro: ceState.proRemaining,
          timeRemainingOpp: ceState.oppRemaining,
          isPaused: ceState.isPaused,
        }
      : null,
  };
}

export function registerRoomHandlers(io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;
  const socketId = socket.id;

  // Heartbeat — useful for health checks
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  async function joinRoom({ roomId }: RoomEventPayload, ack?: RoomAck) {
    if (!roomId) {
      socket.emit('room:error', { message: 'roomId is required' });
      ack?.({ success: false, message: 'roomId is required' });
      return;
    }

    try {
      const state = await buildRoomStatePayload(roomId, userId);
      if (!state) {
        socket.emit('room:error', { message: 'Room not found or you are not a participant' });
        ack?.({ success: false, message: 'Room not found or you are not a participant' });
        return;
      }

      socket.join(roomId);
      trackJoin(socketId, roomId);
      console.log(`User ${userId} joined room ${roomId}`);

      socket.emit('room:joined', state);
      socket.emit('room:state-restore', { ...state, found: true });
      socket.emit('chat:history', state.messages);

      // Broadcast to OTHER clients in the room (NOT the joiner — they already got state)
      // so they can keep their participant list in sync.
      socket.to(roomId).emit('room:participant-update', {
        type: 'joined',
        userId,
        participants: state.participants,
      });

      // Also broadcast the full room state so any client that joined earlier
      // can re-sync phase / timer / session if they missed an event.
      socket.to(roomId).emit('room:state-restore', { ...state, found: true });

      ack?.({ success: true, data: state });
    } catch (error) {
      console.error('Join room socket error:', error);
      socket.emit('room:error', { message: 'Failed to join room channel' });
      ack?.({ success: false, message: 'Failed to join room channel' });
    }
  }

  async function leaveRoom({ roomId }: RoomEventPayload, ack?: RoomAck) {
    if (!roomId) {
      socket.emit('room:error', { message: 'roomId is required' });
      ack?.({ success: false, message: 'roomId is required' });
      return;
    }

    socket.leave(roomId);
    trackLeave(socketId, roomId);
    console.log(`User ${userId} left room ${roomId}`);

    // Re-fetch authoritative participant list so remaining clients stay in sync.
    const room = await DebateRoom.findById(roomId).select('participants');
    const participants = room?.participants || [];

    socket.to(roomId).emit('room:participant-update', {
      type: 'left',
      userId,
      participants,
    });
    // Also broadcast the full room state so other clients can resync
    // any field they may have missed.
    const fullState = await buildRoomStatePayload(roomId, userId);
    if (fullState) {
      socket.to(roomId).emit('room:state-restore', { ...fullState, found: true });
    }

    socket.emit('room:left', { roomId });
    ack?.({ success: true });
  }

  /**
   * Rejoin — used after auto-reconnect. Re-fetches authoritative state and
   * emits room:state-restore so the client can resync phase / timer / CE.
   */
  async function rejoinRoom({ roomId }: RoomEventPayload, ack?: RoomAck) {
    if (!roomId) {
      socket.emit('room:error', { message: 'roomId is required' });
      ack?.({ success: false, message: 'roomId is required' });
      return;
    }
    try {
      const state = await buildRoomStatePayload(roomId, userId);
      if (!state) {
        socket.emit('room:state-restore', { roomId, found: false });
        ack?.({ success: false, message: 'Cannot rejoin' });
        return;
      }
      socket.join(roomId);
      trackJoin(socketId, roomId);
      socket.emit('room:state-restore', { ...state, found: true });
      ack?.({ success: true, data: state });
    } catch (error) {
      console.error('Rejoin error:', error);
      ack?.({ success: false, message: 'Failed to rejoin' });
    }
  }

  // Backwards-compatible event names
  socket.on('join-room', joinRoom);
  socket.on('room:join', joinRoom);
  socket.on('leave-room', leaveRoom);
  socket.on('room:leave', leaveRoom);
  socket.on('room:rejoin', rejoinRoom);

  // Cleanup on disconnect
  socket.on('disconnect', async (reason) => {
    const rooms = getSocketRooms(socketId);
    for (const roomId of rooms) {
      // Re-fetch authoritative participant list so remaining clients stay in sync.
      const room = await DebateRoom.findById(roomId).select('participants');
      const participants = room?.participants || [];
      io.to(roomId).emit('room:participant-update', {
        type: 'left',
        userId,
        reason,
        participants,
      });
    }
    socketRooms.delete(socketId);
    console.log(`User ${userId} disconnected from rooms: ${rooms.join(', ') || 'none'} (${reason})`);
  });
}
