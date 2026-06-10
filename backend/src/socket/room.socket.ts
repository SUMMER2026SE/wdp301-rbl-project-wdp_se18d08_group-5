import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { Message } from '../models/Message.js';

type RoomEventPayload = {
  roomId: string;
};

type RoomAck = (payload: { success: boolean; message?: string; data?: unknown }) => void;

export function registerRoomHandlers(_io: Server, socket: Socket) {
  const userId = (socket as any).userId;

  async function joinRoom({ roomId }: RoomEventPayload, ack?: RoomAck) {
    if (!roomId) {
      socket.emit('room:error', { message: 'roomId is required' });
      ack?.({ success: false, message: 'roomId is required' });
      return;
    }

    try {
      const room = await DebateRoom.findById(roomId).select('-password');
      if (!room) {
        socket.emit('room:error', { message: 'Room not found' });
        ack?.({ success: false, message: 'Room not found' });
        return;
      }

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant) {
        socket.emit('room:error', { message: 'You are not in this room' });
        ack?.({ success: false, message: 'You are not in this room' });
        return;
      }

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

      const roomState = {
        room,
        session,
        participant,
        participants: room.participants,
        currentPhase: room.currentPhase,
        currentTurn: session?.currentTurn || null,
        timeRemaining: session?.currentTurn?.timeRemaining ?? 0,
        isPaused: room.status === 'paused' || session?.currentTurn?.status === 'paused',
        messages: orderedMessages,
        finalScores: session?.finalScores || null,
        viewerChatEnabled: room.viewerChatEnabled !== false,
      };

      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);

      socket.emit('room:joined', roomState);
      socket.emit('room:state-restore', roomState);
      socket.emit('chat:history', orderedMessages);

      socket.to(roomId).emit('room:participant-update', {
        type: 'joined',
        userId,
        participants: room.participants,
      });

      ack?.({ success: true, data: roomState });
    } catch (error) {
      console.error('Join room socket error:', error);
      socket.emit('room:error', { message: 'Failed to join room channel' });
      ack?.({ success: false, message: 'Failed to join room channel' });
    }
  }

  function leaveRoom({ roomId }: RoomEventPayload, ack?: RoomAck) {
    if (!roomId) {
      socket.emit('room:error', { message: 'roomId is required' });
      ack?.({ success: false, message: 'roomId is required' });
      return;
    }

    socket.leave(roomId);
    console.log(`User ${userId} left room ${roomId}`);

    socket.to(roomId).emit('room:participant-update', {
      type: 'left',
      userId,
    });

    socket.emit('room:left', { roomId });
    ack?.({ success: true });
  }

  // Join a debate room. Keep both event names for API compatibility.
  socket.on('join-room', joinRoom);
  socket.on('room:join', joinRoom);

  // Leave a debate room. Keep both event names for API compatibility.
  socket.on('leave-room', leaveRoom);
  socket.on('room:leave', leaveRoom);
}
