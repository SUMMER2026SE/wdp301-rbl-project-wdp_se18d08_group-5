import { Server, Socket } from 'socket.io';

type VoicePeer = {
  socketId: string;
  userId: string;
};

type VoiceRoomPayload = {
  roomId?: string;
};

type VoiceSignalPayload = {
  roomId?: string;
  targetSocketId?: string;
  offer?: unknown;
  answer?: unknown;
  candidate?: unknown;
};

type VoiceJoinAck = (payload: { peers: VoicePeer[] }) => void;

const voiceRooms = new Map<string, Map<string, string>>();
const socketVoiceRooms = new Map<string, Set<string>>();

function getSocketUserId(socket: Socket) {
  return (socket as unknown as { userId: string }).userId;
}

function trackVoiceJoin(socketId: string, roomId: string) {
  const rooms = socketVoiceRooms.get(socketId) || new Set<string>();
  rooms.add(roomId);
  socketVoiceRooms.set(socketId, rooms);
}

function trackVoiceLeave(socketId: string, roomId: string) {
  const rooms = socketVoiceRooms.get(socketId);
  rooms?.delete(roomId);
  if (rooms?.size === 0) socketVoiceRooms.delete(socketId);
}

function leaveVoiceRoom(socket: Socket, roomId: string) {
  const roomPeers = voiceRooms.get(roomId);
  if (!roomPeers?.has(socket.id)) return;

  const userId = roomPeers.get(socket.id);
  roomPeers.delete(socket.id);
  if (roomPeers.size === 0) voiceRooms.delete(roomId);
  trackVoiceLeave(socket.id, roomId);

  socket.to(roomId).emit('voice:user-left', {
    socketId: socket.id,
    userId,
  });
}

export function registerVoiceHandlers(io: Server, socket: Socket) {
  const userId = getSocketUserId(socket);

  socket.on('voice:join', ({ roomId }: VoiceRoomPayload, ack?: VoiceJoinAck) => {
    if (!roomId) {
      ack?.({ peers: [] });
      return;
    }

    socket.join(roomId);

    const roomPeers = voiceRooms.get(roomId) || new Map<string, string>();
    const peers = Array.from(roomPeers.entries())
      .filter(([socketId]) => socketId !== socket.id)
      .map(([socketId, peerUserId]) => ({ socketId, userId: peerUserId }));

    roomPeers.set(socket.id, userId);
    voiceRooms.set(roomId, roomPeers);
    trackVoiceJoin(socket.id, roomId);

    ack?.({ peers });
    socket.to(roomId).emit('voice:user-joined', {
      socketId: socket.id,
      userId,
    });
  });

  socket.on('voice:leave', ({ roomId }: VoiceRoomPayload) => {
    if (!roomId) return;
    leaveVoiceRoom(socket, roomId);
  });

  socket.on('voice:offer', ({ roomId, targetSocketId, offer }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !offer) return;
    io.to(targetSocketId).emit('voice:offer', {
      roomId,
      fromSocketId: socket.id,
      fromUserId: userId,
      offer,
    });
  });

  socket.on('voice:answer', ({ roomId, targetSocketId, answer }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !answer) return;
    io.to(targetSocketId).emit('voice:answer', {
      roomId,
      fromSocketId: socket.id,
      fromUserId: userId,
      answer,
    });
  });

  socket.on('voice:ice-candidate', ({ roomId, targetSocketId, candidate }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !candidate) return;
    io.to(targetSocketId).emit('voice:ice-candidate', {
      roomId,
      fromSocketId: socket.id,
      fromUserId: userId,
      candidate,
    });
  });

  socket.on('disconnect', () => {
    const rooms = Array.from(socketVoiceRooms.get(socket.id) || []);
    rooms.forEach((roomId) => leaveVoiceRoom(socket, roomId));
    socketVoiceRooms.delete(socket.id);
  });
}
