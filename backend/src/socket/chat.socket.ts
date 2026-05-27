import { Server, Socket } from 'socket.io';
import { Message } from '../models/Message.js';

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId;

  // Send chat message
  socket.on('chat:send', async ({ roomId, content }: { roomId: string; content: string }) => {
    if (!content || !content.trim()) return;

    try {
      // Save to database
      const message = await Message.create({
        roomId,
        senderId: userId,
        senderName: 'User', // TODO: Get from user data
        senderRole: 'viewer', // TODO: Get from room participant
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
