import { Server, Socket } from 'socket.io';
import { Message } from '../models/Message.js';
import { DebateRoom } from '../models/DebateRoom.js';

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId;

  // Send chat message
  socket.on('chat:send', async ({ roomId, content }: { roomId: string; content: string }) => {
    if (!content || !content.trim()) return;

    try {
      const room = await DebateRoom.findById(roomId).select('participants viewerChatEnabled');
      if (!room) {
        socket.emit('chat:error', { message: 'Room not found' });
        return;
      }

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant) {
        socket.emit('chat:error', { message: 'You are not in this room' });
        return;
      }

      if (participant.muted) {
        socket.emit('chat:error', { message: 'You are muted in this room' });
        return;
      }

      if (participant.roomRole === 'viewer' && room.viewerChatEnabled === false) {
        socket.emit('chat:error', { message: 'Viewer chat is disabled by the host' });
        return;
      }

      // Save to database
      const message = await Message.create({
        roomId,
        senderId: userId,
        senderName: participant.username,
        senderRole: participant.roomRole,
        content: content.trim(),
        type: 'chat',
        isToxic: false, // TODO: AI toxic check
      });

      // Broadcast to room
      io.to(roomId).emit('chat:message', {
        _id: message._id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        content: message.content,
        type: message.type,
        isToxic: message.isToxic,
        timestamp: message.timestamp,
      });
    } catch (error) {
      console.error('Chat send error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
}
