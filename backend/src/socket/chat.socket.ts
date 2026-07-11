import { Server, Socket } from 'socket.io';
import { Message } from '../models/Message.js';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';

function isPrivilegedRole(role: string): boolean {
  return ['owner', 'host', 'debater', 'judge'].includes(role);
}

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  // Send main debate chat message (debater, judge, host only; viewers read-only)
  socket.on('chat:send', async ({ roomId, content }: { roomId: string; content: string }) => {
    if (!content || !content.trim()) return;

    try {
      const room = await DebateRoom.findById(roomId).select('participants');
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

      if (participant.chatMuted) {
        socket.emit('chat:error', { message: 'You are muted from chat in this room' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (session && session.currentTurn && session.currentTurn.status === 'waiting_to_start') {
        socket.emit('chat:error', { message: 'Chat is locked until the phase is started by the host' });
        return;
      }

      // Only privileged roles can chat in the main debate chat
      if (!isPrivilegedRole(participant.roomRole)) {
        socket.emit('chat:error', { message: 'Viewers cannot chat in the main debate chat' });
        return;
      }

      const message = await Message.create({
        roomId,
        senderId: userId,
        senderName: participant.username,
        senderRole: participant.roomRole,
        content: content.trim(),
        type: 'chat',
        isToxic: false,
      });

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

  // Send viewer chat message (viewer + host only)
  socket.on('viewer-chat:send', async ({ roomId, content }: { roomId: string; content: string }) => {
    if (!content || !content.trim()) return;

    try {
      const room = await DebateRoom.findById(roomId).select('participants viewerChatEnabled');
      if (!room) {
        socket.emit('viewer-chat:error', { message: 'Room not found' });
        return;
      }

      if (room.viewerChatEnabled === false) {
        socket.emit('viewer-chat:error', { message: 'Viewer chat is disabled by the host' });
        return;
      }

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant) {
        socket.emit('viewer-chat:error', { message: 'You are not in this room' });
        return;
      }

      if (participant.chatMuted) {
        socket.emit('viewer-chat:error', { message: 'You are muted from chat in this room' });
        return;
      }

      // Only viewers and host/owner can send viewer chat
      if (!['viewer', 'host', 'owner'].includes(participant.roomRole)) {
        socket.emit('viewer-chat:error', { message: 'Only viewers and host can use the viewer chat' });
        return;
      }

      const message = await Message.create({
        roomId,
        senderId: userId,
        senderName: participant.username,
        senderRole: participant.roomRole,
        content: content.trim(),
        type: 'viewer_chat',
        isToxic: false,
      });

      // Broadcast to viewers and host/owner (all clients in room can receive; frontend filters by role)
      const payload = {
        _id: message._id,
        roomId: message.roomId,
        senderId: message.senderId,
        senderName: message.senderName,
        senderRole: message.senderRole,
        content: message.content,
        type: message.type,
        isToxic: message.isToxic,
        timestamp: message.timestamp,
      };

      io.to(roomId).emit('viewer-chat:message', payload);
    } catch (error) {
      console.error('Viewer chat send error:', error);
      socket.emit('error', { message: 'Failed to send viewer chat message' });
    }
  });

  // Host toggle viewer chat
  socket.on('chat:toggle-viewer', async ({ roomId, enabled }: { roomId: string; enabled: boolean }, ack?: (res: { success: boolean }) => void) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) {
        socket.emit('chat:error', { message: 'Room not found' });
        ack?.({ success: false });
        return;
      }

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant || !['owner', 'host'].includes(participant.roomRole)) {
        socket.emit('chat:error', { message: 'Only the host can toggle viewer chat' });
        ack?.({ success: false });
        return;
      }

      room.viewerChatEnabled = enabled;
      await room.save();

      io.to(roomId).emit('room:viewer-chat-toggled', { enabled });
      ack?.({ success: true });
    } catch (error) {
      console.error('Toggle viewer chat error:', error);
      socket.emit('error', { message: 'Failed to toggle viewer chat' });
      ack?.({ success: false });
    }
  });

  // Load viewer chat history
  socket.on('viewer-chat:history', async ({ roomId }: { roomId: string }, ack?: (res: { messages: unknown[] }) => void) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) {
        ack?.({ messages: [] });
        return;
      }

      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant) {
        ack?.({ messages: [] });
        return;
      }

      // Every room participant can read the viewer channel. Send permission is
      // enforced separately by viewer-chat:send.
      const effectiveRole =
        participant.roomRole === 'owner'
          ? (participant.primaryRole ?? participant.roomRole)
          : participant.roomRole;
      const canRead = ['viewer', 'host', 'owner', 'judge', 'debater'].includes(String(effectiveRole));
      if (!canRead) {
        ack?.({ messages: [] });
        return;
      }

      const messages = await Message.find({ roomId, type: 'viewer_chat' })
        .sort({ timestamp: 1 })
        .limit(100);

      ack?.({ messages: messages.map((m) => m.toObject()) });
    } catch (error) {
      console.error('Viewer chat history error:', error);
      ack?.({ messages: [] });
    }
  });
}
