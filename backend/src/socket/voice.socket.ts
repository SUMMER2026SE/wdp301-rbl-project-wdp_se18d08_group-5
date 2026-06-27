import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';

type VoicePeer = {
  socketId: string;
  userId: string;
};

type VoiceRoomPayload = {
  roomId?: string;
  team?: 'proposition' | 'opposition' | 'judge';
};

type VoiceSignalPayload = {
  roomId?: string;
  team?: 'proposition' | 'opposition' | 'judge';
  targetSocketId?: string;
  offer?: unknown;
  answer?: unknown;
  candidate?: unknown;
};

type VideoTogglePayload = {
  roomId?: string;
  team?: 'proposition' | 'opposition' | 'judge';
  targetUserId?: string;
  active?: boolean;
};

type VideoToggleAck = (response: { success: boolean; message?: string }) => void;

type VoiceJoinAck = (payload: { peers: VoicePeer[]; cameraState?: { activeUsers: string[] } }) => void;

const voiceRooms = new Map<string, Map<string, string>>();
const socketVoiceRooms = new Map<string, Set<string>>();

// Per-userId camera state for the main room. Private rooms keep their own map.
const cameraState = new Map<string, Set<string>>(); // roomId -> Set<userId with cam on>

function buildVoiceKey(roomId: string, team?: 'proposition' | 'opposition' | 'judge'): string {
  return team ? `voice:${roomId}:${team}` : roomId;
}

function buildMainVoiceKey(roomId: string): string {
  return roomId;
}

function getSocketUserId(socket: Socket) {
  return (socket as unknown as { userId: string }).userId;
}

function getSocketUserRole(socket: Socket): string | undefined {
  return (socket as unknown as { userRole?: string }).userRole;
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

  if (userId) {
    const set = cameraState.get(roomId);
    if (set?.has(userId)) {
      set.delete(userId);
      cameraState.set(roomId, set);
      const team = roomId.startsWith('voice:') ? roomId.split(':')[2] : undefined;
      socket.to(roomId).emit('video:state', { userId, active: false, team });
    }
  }
}

function getMainRoomHostId(roomId: string): Promise<string | null> {
  return DebateRoom.findById(roomId)
    .select('hostId createdBy')
    .lean()
    .then((room) => {
      if (!room) return null;
      const r = room as unknown as { hostId?: string; createdBy?: string };
      return r.hostId || r.createdBy || null;
    })
    .catch(() => null);
}

export function registerVoiceHandlers(io: Server, socket: Socket) {
  const userId = getSocketUserId(socket);

  socket.on('voice:join', ({ roomId, team }: VoiceRoomPayload, ack?: VoiceJoinAck) => {
    if (!roomId) {
      ack?.({ peers: [] });
      return;
    }

    const key = buildVoiceKey(roomId, team);
    socket.join(key);

    const roomPeers = voiceRooms.get(key) || new Map<string, string>();
    const peers = Array.from(roomPeers.entries())
      .filter(([socketId]) => socketId !== socket.id)
      .map(([socketId, peerUserId]) => ({ socketId, userId: peerUserId }));

    roomPeers.set(socket.id, userId);
    voiceRooms.set(key, roomPeers);
    trackVoiceJoin(socket.id, key);

    // Include initial camera state snapshot for the current channel
    const set = cameraState.get(key) || new Set<string>();
    const initialState = { activeUsers: Array.from(set) };

    ack?.({ peers, cameraState: initialState });
    socket.to(key).emit('voice:user-joined', {
      socketId: socket.id,
      userId,
    });
  });

  socket.on('voice:leave', ({ roomId, team }: VoiceRoomPayload) => {
    if (!roomId) return;
    leaveVoiceRoom(socket, buildVoiceKey(roomId, team));
  });

  socket.on('voice:offer', ({ roomId, team, targetSocketId, offer }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !offer) return;
    io.to(targetSocketId).emit('voice:offer', {
      roomId,
      team,
      fromSocketId: socket.id,
      fromUserId: userId,
      offer,
    });
  });

  socket.on('voice:answer', ({ roomId, team, targetSocketId, answer }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !answer) return;
    io.to(targetSocketId).emit('voice:answer', {
      roomId,
      team,
      fromSocketId: socket.id,
      fromUserId: userId,
      answer,
    });
  });

  socket.on('voice:ice-candidate', ({ roomId, team, targetSocketId, candidate }: VoiceSignalPayload) => {
    if (!roomId || !targetSocketId || !candidate) return;
    io.to(targetSocketId).emit('voice:ice-candidate', {
      roomId,
      team,
      fromSocketId: socket.id,
      fromUserId: userId,
      candidate,
    });
  });

  // Camera self-toggle: user turns their own camera on/off. Broadcast to all
  // peers in the channel so they can update their grid.
  socket.on(
    'video:state',
    ({ roomId, team, active }: VideoTogglePayload) => {
      if (!roomId || typeof active !== 'boolean') return;
      const key = buildVoiceKey(roomId, team);
      const set = cameraState.get(key) || new Set<string>();
      if (active) set.add(userId);
      else set.delete(userId);
      cameraState.set(key, set);

      io.to(key).emit('video:state', {
        userId,
        active,
        team,
      });
    },
  );

  // Host-only: force a target user's camera on/off. Only allowed in main room
  // (no `team`) and only for users whose role is host/owner.
  socket.on(
    'video:host-toggle',
    async ({ roomId, targetUserId, active }: VideoTogglePayload, ack?: VideoToggleAck) => {
      if (!roomId || !targetUserId || typeof active !== 'boolean') {
        ack?.({ success: false, message: 'roomId, targetUserId and active are required' });
        return;
      }

      const role = getSocketUserRole(socket);
      if (role !== 'host' && role !== 'owner' && role !== 'admin') {
        ack?.({ success: false, message: 'Only host can toggle other users' });
        return;
      }

      const hostId = await getMainRoomHostId(roomId);
      if (!hostId) {
        ack?.({ success: false, message: 'Room not found' });
        return;
      }
      if (hostId !== userId) {
        ack?.({ success: false, message: 'Only the room host can control cameras' });
        return;
      }

      const key = buildMainVoiceKey(roomId);
      const set = cameraState.get(key) || new Set<string>();
      if (active) set.add(targetUserId);
      else set.delete(targetUserId);
      cameraState.set(key, set);

      io.to(key).emit('video:host-toggle', {
        userId: targetUserId,
        active,
        byUserId: userId,
      });

      ack?.({ success: true });
    },
  );

  socket.on('disconnect', () => {
    const rooms = Array.from(socketVoiceRooms.get(socket.id) || []);
    rooms.forEach((roomId) => leaveVoiceRoom(socket, roomId));
    socketVoiceRooms.delete(socket.id);
    // Clean camera state for this user across all rooms/channels
    for (const [key, set] of cameraState.entries()) {
      if (set.has(userId)) {
        set.delete(userId);
        cameraState.set(key, set);
        io.to(key).emit('video:state', { userId, active: false, team: undefined });
      }
    }
  });
}
