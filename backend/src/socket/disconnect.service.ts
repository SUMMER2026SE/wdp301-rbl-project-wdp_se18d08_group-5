import { Server } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { Message } from '../models/Message.js';
import { completeDebateWithWinner } from '../features/debate/debate.service.js';

const DISCONNECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface DisconnectedMember {
  userId: string;
  username: string;
  team: 'proposition' | 'opposition';
  disconnectedAt: Date;
}

interface RoomDisconnectState {
  disconnectedMembers: Map<string, DisconnectedMember>; // userId -> member info
  timeoutId: NodeJS.Timeout | null;
  forfeitingTeam: 'proposition' | 'opposition' | null;
}

// Track disconnect state per room
const roomDisconnectState = new Map<string, RoomDisconnectState>();

let io: Server | null = null;

export function setDisconnectServiceIO(server: Server) {
  io = server;
}

function getRoomState(roomId: string): RoomDisconnectState {
  let state = roomDisconnectState.get(roomId);
  if (!state) {
    state = {
      disconnectedMembers: new Map(),
      timeoutId: null,
      forfeitingTeam: null,
    };
    roomDisconnectState.set(roomId, state);
  }
  return state;
}

export async function handleParticipantDisconnect(
  roomId: string,
  userId: string,
  username: string,
  team: 'proposition' | 'opposition',
): Promise<void> {
  if (!io) return;

  const room = await DebateRoom.findById(roomId);
  if (!room) return;

  // Only track during active debates
  if (room.status !== 'active' && room.status !== 'paused') {
    return;
  }

  const state = getRoomState(roomId);

  // Store disconnect info
  state.disconnectedMembers.set(userId, {
    userId,
    username,
    team,
    disconnectedAt: new Date(),
  });

  // Broadcast disconnect event
  io.to(roomId).emit('debate:participant-disconnected', {
    userId,
    username,
    team,
    disconnectedAt: new Date().toISOString(),
  });

  // Check if team should forfeit
  const shouldForfeit = await checkTeamForfeit(roomId, team, room.format);

  if (shouldForfeit && !state.timeoutId) {
    // Clear existing timeout if any
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }

    // Set 5 minute timeout for forfeit
    state.timeoutId = setTimeout(async () => {
      await handleForfeit(roomId, team);
    }, DISCONNECT_TIMEOUT_MS);

    state.forfeitingTeam = team;

    // Broadcast countdown start
    io.to(roomId).emit('debate:disconnect-timer-start', {
      team,
      durationMs: DISCONNECT_TIMEOUT_MS,
      disconnectedMembers: Array.from(state.disconnectedMembers.values()),
    });

    // Add system message
    await addSystemMessage(
      roomId,
      `${username} has been disconnected. 5 minute timer started.`,
    );
  }
}

export async function handleParticipantReconnect(
  roomId: string,
  userId: string,
): Promise<void> {
  if (!io) return;

  const state = roomDisconnectState.get(roomId);
  if (!state) return;

  const disconnectedMember = state.disconnectedMembers.get(userId);
  if (!disconnectedMember) return;

  const { username, team } = disconnectedMember;

  // Remove from disconnected list
  state.disconnectedMembers.delete(userId);

  // Broadcast reconnect event
  io.to(roomId).emit('debate:participant-reconnected', {
    userId,
    username,
    team,
  });

  // Cancel timeout if no more disconnected members on this team
  const hasOtherDisconnected = Array.from(state.disconnectedMembers.values()).some(
    (m) => m.team === team,
  );

  if (!hasOtherDisconnected && state.forfeitingTeam === team) {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    state.forfeitingTeam = null;

    // Broadcast timer cancelled
    io.to(roomId).emit('debate:disconnect-timer-cancelled', { team });

    // Add system message
    await addSystemMessage(
      roomId,
      `${username} has reconnected. Disconnect timer cancelled.`,
    );
  }
}

async function checkTeamForfeit(
  roomId: string,
  team: 'proposition' | 'opposition',
  format: string,
): Promise<boolean> {
  const room = await DebateRoom.findById(roomId);
  if (!room) return false;

  const state = roomDisconnectState.get(roomId);
  if (!state) return false;

  // Count total slots for this team
  const requiredSlots = format === '1v1' ? 1 : 3;

  // Count debaters in this team
  const teamDebaters = room.participants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'debater' && p.team === team;
  });

  // Count currently disconnected debaters on this team
  const disconnectedOnTeam = Array.from(state.disconnectedMembers.values()).filter(
    (m) => m.team === team,
  );

  // Forfeit if ALL team members are disconnected
  const allDisconnected =
    teamDebaters.length === requiredSlots &&
    disconnectedOnTeam.length === requiredSlots;

  return allDisconnected;
}

async function handleForfeit(roomId: string, forfeitingTeam: 'proposition' | 'opposition'): Promise<void> {
  if (!io) return;

  const room = await DebateRoom.findById(roomId);
  if (!room) return;

  // Check if room still exists and debate is still active
  if (room.status !== 'active' && room.status !== 'paused') {
    return;
  }

  const session = await DebateSession.findOne({ roomId: room._id });
  if (!session) return;

  // Determine winner (opposite team)
  const winner = forfeitingTeam === 'proposition' ? 'opposition' : 'proposition';
  const winnerLabel = winner.charAt(0).toUpperCase() + winner.slice(1);

  // Add system message about forfeit
  await addSystemMessage(
    roomId,
    `${winnerLabel} has forfeited due to disconnection.`,
  );

  // Broadcast forfeit event
  io.to(roomId).emit('debate:team-forfeited', {
    forfeitingTeam,
    winner,
  });

  // Complete the debate with winner
  try {
    await completeDebateWithWinner(
      room,
      session,
      winner as 'proposition' | 'opposition' | 'draw',
      `Forfeit: ${forfeitingTeam} team disconnected. ${winnerLabel} wins by forfeit.`,
    );

    // completeDebateWithWinner now applies ELO internally

    // Broadcast debate ended
    io.to(roomId).emit('debate:ended', {
      roomId,
      result: {
        winner,
        winnerTeam: winner,
        finalScores: session.finalScores,
      },
    });

    // Clean up disconnect state
    const state = roomDisconnectState.get(roomId);
    if (state) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId);
      }
      roomDisconnectState.delete(roomId);
    }
  } catch (error) {
    console.error('Error handling forfeit:', error);
  }
}

async function addSystemMessage(roomId: string, content: string): Promise<void> {
  try {
    const room = await DebateRoom.findById(roomId);
    if (!room) return;

    const message = new Message({
      roomId: room._id,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'host',
      content,
      type: 'system',
      isToxic: false,
    });
    await message.save();

    io?.to(roomId).emit('chat:message', {
      _id: message._id,
      roomId: message.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'host',
      content,
      type: 'system',
      isToxic: false,
      timestamp: message.timestamp,
    });
  } catch (error) {
    console.error('Error adding system message:', error);
  }
}

export function cleanupRoomDisconnectState(roomId: string): void {
  const state = roomDisconnectState.get(roomId);
  if (state) {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
    }
    roomDisconnectState.delete(roomId);
  }
}
