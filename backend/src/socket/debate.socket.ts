import { Server, Socket } from 'socket.io';

/**
 * Debate-specific socket events:
 * - Timer sync
 * - Phase transitions
 * - Cross Examination flow
 * - Score updates
 */
export function registerDebateHandlers(io: Server, socket: Socket) {
  const userId = (socket as any).userId;

  // Cross Examination: Pass Turn
  socket.on('cross-exam:pass-turn', ({ roomId }: { roomId: string }) => {
    // TODO: Validate it's the active team's turn
    // TODO: Update CE state
    io.to(roomId).emit('cross-exam:update', {
      action: 'pass-turn',
      userId,
    });
  });

  // Cross Examination: Finish
  socket.on('cross-exam:finish', ({ roomId }: { roomId: string }) => {
    // TODO: End CE phase, move to judge_feedback
    io.to(roomId).emit('cross-exam:update', {
      action: 'finish',
      userId,
    });
  });

  // Host: Start speech timer
  socket.on('host:start-speech', ({ roomId, speaker }: { roomId: string; speaker: string }) => {
    // TODO: Validate host role
    // TODO: Start server-side timer (4 minutes)
    io.to(roomId).emit('debate:turn-change', { speaker });
    io.to(roomId).emit('debate:timer-update', { timeRemaining: 240 }); // 4 min
  });

  // Host: Next turn
  socket.on('host:next-turn', ({ roomId }: { roomId: string }) => {
    // TODO: Validate host, advance to next speaker/phase
    io.to(roomId).emit('debate:phase-change', { phase: 'speech' });
  });

  // Reconnect: Request current state
  socket.on('room:rejoin', ({ roomId }: { roomId: string }) => {
    socket.join(roomId);
    // TODO: Send current debate state (phase, timer, CE state, scores)
    socket.emit('room:state-restore', {
      roomId,
      // TODO: Fetch and send current state
    });
  });
}
