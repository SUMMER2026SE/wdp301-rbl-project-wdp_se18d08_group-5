import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { timerService } from './timer.service.js';
import { triggerTransition } from '../features/debate/debate.service.js';

// Tracks user IDs of debaters who clicked "End Prep early" per roomId
export const prepConsensus = new Map<string, Set<string>>();

export function registerDebateHandlers(io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  // Host: Start the phase (tick timer / unlock)
  socket.on('host:start-phase', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const isHost = room.hostId?.toString() === userId;
      const isOwner = room.createdBy.toString() === userId;
      if (!isHost && !isOwner) {
        socket.emit('debate:error', { message: 'Only host or owner can start the phase' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;

      if (session.currentTurn.status !== 'waiting_to_start') {
        socket.emit('debate:error', { message: 'Current phase is already started' });
        return;
      }

      session.currentTurn.status = 'active';
      session.currentTurn.startTime = new Date();
      await session.save();

      const phase = session.currentTurn.phase;
      const timeLimit = session.currentTurn.timeRemaining;

      if (phase === 'cross_exam') {
        const ceConfig = session.currentTurn.ceState;
        const { initCEForRoom } = await import('./ce.socket.js');
        initCEForRoom(roomId, ceConfig?.askingTeam as any || 'proposition');
      } else {
        timerService.start(roomId, timeLimit, phase, () => {
          triggerTransition(roomId).catch(console.error);
        });
      }

      // Broadcast phase started
      io.to(roomId).emit('debate:phase-started', {
        phase,
        speaker: session.currentTurn.speaker,
        timeLimit,
      });

      // State restore sync
      const { buildRoomStatePayload } = await import('./room.socket.js');
      const state = await buildRoomStatePayload(roomId, userId);
      if (state) {
        io.to(roomId).emit('room:state-restore', state);
      }
    } catch (error) {
      console.error('Socket host:start-phase error:', error);
    }
  });

  // Host: Next turn / End current phase
  socket.on('host:next-turn', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const isHost = room.hostId?.toString() === userId;
      const isOwner = room.createdBy.toString() === userId;
      if (!isHost && !isOwner) {
        socket.emit('debate:error', { message: 'Only host or owner can advance phases' });
        return;
      }

      await triggerTransition(roomId);
    } catch (error) {
      console.error('Socket host:next-turn error:', error);
    }
  });

  // Judge: Send floating reaction emoji
  socket.on('judge:reaction', async ({ roomId, type }: { roomId: string; type: 'agree' | 'disagree' }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const participant = room.participants.find((p) => p.userId.toString() === userId);
      if (participant?.roomRole !== 'judge') {
        socket.emit('debate:error', { message: 'Only judges can send reactions' });
        return;
      }

      // Broadcast reaction to everyone
      io.to(roomId).emit('judge:reaction', {
        username: participant.username,
        type,
      });
    } catch (error) {
      console.error('Socket judge:reaction error:', error);
    }
  });

  // Debater: Click End Prep Early
  socket.on('debate:end-prep-early', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session || session.currentTurn.phase !== 'prep_7') {
        socket.emit('debate:error', { message: 'Not in preparation phase' });
        return;
      }

      const participant = room.participants.find((p) => p.userId.toString() === userId);
      if (participant?.roomRole !== 'debater') {
        socket.emit('debate:error', { message: 'Only debaters can end prep' });
        return;
      }

      // Add to consensus
      let consensusSet = prepConsensus.get(roomId);
      if (!consensusSet) {
        consensusSet = new Set<string>();
        prepConsensus.set(roomId, consensusSet);
      }
      consensusSet.add(userId);

      const debaters = room.participants.filter((p) => p.roomRole === 'debater');
      const totalDebatersCount = debaters.length;

      // Broadcast prep consensus update
      io.to(roomId).emit('debate:prep-consensus-update', {
        readyUserIds: Array.from(consensusSet),
        totalDebaters: totalDebatersCount,
      });

      // If all debaters have agreed, trigger transition
      if (consensusSet.size >= totalDebatersCount && totalDebatersCount > 0) {
        consensusSet.clear();
        triggerTransition(roomId).catch(console.error);
      }
    } catch (error) {
      console.error('Socket debate:end-prep-early error:', error);
    }
  });

  // Reconnect: Request current state
  socket.on('room:rejoin', async ({ roomId }: { roomId: string }) => {
    try {
      socket.join(roomId);
      const { buildRoomStatePayload } = await import('./room.socket.js');
      const state = await buildRoomStatePayload(roomId, userId);
      if (state) {
        socket.emit('room:state-restore', state);
        
        // Also sync current prep consensus if in prep phase
        const consensusSet = prepConsensus.get(roomId);
        if (consensusSet) {
          const debatersCount = state.room.participants.filter((p: any) => p.roomRole === 'debater').length;
          socket.emit('debate:prep-consensus-update', {
            readyUserIds: Array.from(consensusSet),
            totalDebaters: debatersCount,
          });
        }
      }
    } catch (error) {
      console.error('Socket room:rejoin error:', error);
    }
  });
}
