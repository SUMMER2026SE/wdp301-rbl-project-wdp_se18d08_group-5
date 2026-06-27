import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { timerService } from './timer.service.js';
import { triggerTransition } from '../features/debate/debate.service.js';

// Tracks user IDs of debaters who clicked "End Prep early" per roomId
export const prepConsensus = new Map<string, Set<string>>();


// Tracks judges who have pressed "Next Phase" during Judge Feedback phase
export const judgeNextPhaseVotes = new Map<string, Set<string>>();

// Tracks S1 debaters who pressed Start in no-host mode
export const s1StartConsensus = new Map<string, Set<string>>();

export function registerDebateHandlers(io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  // Host: Start the phase (tick timer / unlock)
  // For no-host + human judge: Judge S1 can also start phases
  socket.on('host:start-phase', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
      const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
      const isHost = effectiveRole === 'host';
      const isJudgeS1 =
        room.hostType !== 'human' &&
        effectiveRole === 'judge' &&
        (participant as any).speakerSlot === 'S1';

      if (!isHost && !isJudgeS1) {
        socket.emit('debate:error', { message: 'Only the host or Judge S1 can start a phase' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;

      if (session.currentTurn.status !== 'waiting_to_start') {
        socket.emit('debate:error', { message: 'Current phase is already started' });
        return;
      }

      // All phases start with 3s countdown (including motion)
      session.currentTurn.status = 'active';
      session.currentTurn.startTime = new Date(Date.now() + 3000);
      await session.save();

      // Broadcast countdown start to trigger client overlays
      io.to(roomId).emit('debate:countdown-start', { durationMs: 3000 });

      setTimeout(async () => {
        try {
          const freshSession = await DebateSession.findOne({ roomId: room._id });
          if (!freshSession || freshSession.currentTurn.status !== 'active') return;

          const phase = freshSession.currentTurn.phase;
          const timeLimit = freshSession.currentTurn.timeLimit;

          // Motion is a transient announcement phase: after the 3s countdown
          // it auto-advances to the prep phase. Implements rule:
          //   "Host Start -> 3s countdown -> 7m preparation"
          // The motion step is just the "announcement window" before prep starts.
          if (phase === 'motion') {
            const { applyStep } = await import('../features/debate/debate.service.js');
            const { getFlow } = await import('../features/debate/debate.service.js');
            const format = (room.format as '1v1' | '3v3') || '3v3';
            const flow = getFlow(format, room.hostType as 'human' | 'ai');
            const currentIndex = flow.findIndex(
              (s) => s.speaker === freshSession.currentTurn.speaker && s.phase === freshSession.currentTurn.phase,
            );
            const prepStep = flow[Math.min(currentIndex + 1, flow.length - 1)];
            applyStep(freshSession, prepStep);
            freshSession.currentTurn.timeRemaining = prepStep.timeLimit || 0;
            freshSession.currentTurn.startTime = new Date();
            await freshSession.save();
            room.currentPhase = prepStep.phase;
            await room.save();

            timerService.start(roomId, prepStep.timeLimit || 0, prepStep.phase, () => {
              triggerTransition(roomId).catch(console.error);
            });

            io.to(roomId).emit('debate:phase-change', {
              phase: prepStep.phase,
              phaseStatus: 'active',
              speaker: prepStep.speaker,
            });
            io.to(roomId).emit('debate:turn-status-change', {
              turnStatus: 'active',
              phaseStatus: 'active',
            });

            const { buildRoomStatePayload } = await import('./room.socket.js');
            const state = await buildRoomStatePayload(roomId, userId);
            if (state) io.to(roomId).emit('room:state-restore', state);
            return;
          }

          freshSession.currentTurn.timeRemaining = timeLimit;
          await freshSession.save();

          // Judge Feedback — no timer, just unlock mic and wait for scores
          if (phase === 'judge_feedback') {
            io.to(roomId).emit('debate:phase-started', {
              phase,
              speaker: freshSession.currentTurn.speaker,
              timeLimit: 0,
              hasTimer: false,
            });
            const { buildRoomStatePayload } = await import('./room.socket.js');
            const state = await buildRoomStatePayload(roomId, userId);
            if (state) io.to(roomId).emit('room:state-restore', state);
            return;
          }

          // Cross Exam — start shared timer for both teams
          if (phase === 'cross_exam') {
            const { initCEForRoom, startCEForRoom } = await import('./ce.socket.js');
            initCEForRoom(roomId);
            startCEForRoom(roomId);

            io.to(roomId).emit('debate:phase-started', {
              phase,
              speaker: freshSession.currentTurn.speaker,
              timeLimit,
              hasTimer: true,
            });
            const { buildRoomStatePayload } = await import('./room.socket.js');
            const state = await buildRoomStatePayload(roomId, userId);
            if (state) io.to(roomId).emit('room:state-restore', state);
            return;
          }

          // Regular speech or prep phase
          if (timeLimit > 0) {
            timerService.start(roomId, timeLimit, phase, () => {
              triggerTransition(roomId).catch(console.error);
            });
          }

          // Broadcast phase started
          io.to(roomId).emit('debate:phase-started', {
            phase,
            speaker: freshSession.currentTurn.speaker,
            timeLimit,
            hasTimer: timeLimit > 0,
          });

          // State restore sync
          const { buildRoomStatePayload } = await import('./room.socket.js');
          const state = await buildRoomStatePayload(roomId, userId);
          if (state) {
            io.to(roomId).emit('room:state-restore', state);
          }
        } catch (err) {
          console.error('Delayed start-phase socket error:', err);
        }
      }, 3000);
    } catch (error) {
      console.error('Socket host:start-phase error:', error);
    }
  });

  // Host: Next turn / End current phase
  socket.on('host:next-turn', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      const participant = room.participants.find((p: any) => p.userId?.toString() === userId);
      const effectiveRole = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
      const isHost = effectiveRole === 'host';
      const isJudgeS1 =
        room.hostType !== 'human' &&
        effectiveRole === 'judge' &&
        (participant as any).speakerSlot === 'S1';

      if (!isHost && !isJudgeS1) {
        socket.emit('debate:error', { message: 'Only the host or Judge S1 can advance phases' });
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
      const role = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
      if (!participant || role !== 'judge') {
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
      const role = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
      if (!participant || role !== 'debater') {
        socket.emit('debate:error', { message: 'Only debaters can end prep' });
        return;
      }

      const speakerSlot = (participant as any).speakerSlot;
      if (speakerSlot !== 'S1') {
        socket.emit('debate:error', { message: 'Only S1 debaters can end prep early' });
        return;
      }

      const participantTeam = participant.team as 'proposition' | 'opposition';
      if (!participantTeam) {
        socket.emit('debate:error', { message: 'Debater must be on a team' });
        return;
      }

      // Track consensus
      let consensusSet = prepConsensus.get(roomId);
      if (!consensusSet) {
        consensusSet = new Set<string>();
        prepConsensus.set(roomId, consensusSet);
      }
      consensusSet.add(userId);

      // We only count S1 debaters as eligible voters (one from each team, total 2)
      const s1Debaters = room.participants.filter((p) => {
        const r = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
        return r === 'debater' && (p as any).speakerSlot === 'S1';
      });
      const totalS1 = s1Debaters.length || 2;

      // Broadcast prep consensus update using unified simple format
      io.to(roomId).emit('debate:prep-consensus-update', {
        readyUserIds: Array.from(consensusSet),
        totalDebaters: totalS1,
        readyCount: consensusSet.size,
      });

      // If S1 debaters from both teams have skipped, transition
      if (consensusSet.size >= totalS1 && totalS1 > 0) {
        consensusSet.clear();
        triggerTransition(roomId).catch(console.error);
      }
    } catch (error) {
      console.error('Socket debate:end-prep-early error:', error);
    }
  });

  /**
   * No-Host: S1 debaters press Start to begin the debate.
   * Both S1 debaters (one from each team) must press Start.
   * When consensus is reached, transition to motion phase.
   */
  socket.on('debater:s1-start', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      // Only for no-host rooms
      if (room.hostType !== 'ai') return;

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;

      // Must be in waiting_s1 phase
      if (session.currentTurn.phase !== 'waiting_s1') return;

      const participant = room.participants.find(
        (p) => p.userId.toString() === userId,
      );
      if (!participant) return;
      const role = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
      if (role !== 'debater') return;
      const speakerSlot = (participant as any).speakerSlot;
      if (speakerSlot !== 'S1') return;

      // Track consensus
      let consensusSet = s1StartConsensus.get(roomId);
      if (!consensusSet) {
        consensusSet = new Set<string>();
        s1StartConsensus.set(roomId, consensusSet);
      }
      consensusSet.add(userId);

      // Count total S1 debaters needed
      const s1Debaters = room.participants.filter(
        (p) => {
          const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
          return role === 'debater' && (p as any).speakerSlot === 'S1';
        },
      );

      // Broadcast update
      io.to(roomId).emit('debate:s1-start-update', {
        readyUserIds: Array.from(consensusSet),
        totalS1: s1Debaters.length,
      });

      // If all S1 debaters are ready, start the debate
      if (consensusSet.size >= s1Debaters.length && s1Debaters.length > 0) {
        consensusSet.clear();
        // Transition: move from WAITING_S1_START to motion step
        await triggerTransition(roomId);
      }
    } catch (error) {
      console.error('Socket debater:s1-start error:', error);
    }
  });

  // Judge: Vote for Next Phase during Judge Feedback phase (no-host mode)
  socket.on('judge:next-phase', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;

      // Only for no-host rooms
      if (room.hostType === 'human') {
        socket.emit('debate:error', { message: 'This action is only available in no-host mode' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;

      // Only during Judge Feedback or Final Judging phase
      if (!['judge_feedback', 'final_judging'].includes(session.currentTurn.phase)) {
        socket.emit('debate:error', { message: 'Can only vote for next phase during judge feedback' });
        return;
      }

      const participant = room.participants.find((p) => p.userId.toString() === userId);
      const role = participant ? (participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole) : null;
      if (role !== 'judge') {
        socket.emit('debate:error', { message: 'Only judges can vote for next phase' });
        return;
      }

      // Track the vote
      let votes = judgeNextPhaseVotes.get(roomId);
      if (!votes) {
        votes = new Set<string>();
        judgeNextPhaseVotes.set(roomId, votes);
      }
      votes.add(userId);

      // Count assigned judges
      const assignedJudges = room.participants.filter((p) => {
        const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
        return role === 'judge';
      });
      const totalJudges = assignedJudges.length;
      const votedCount = votes.size;

      // Broadcast vote update
      io.to(roomId).emit('judge:next-phase-vote-update', {
        votedUserIds: Array.from(votes),
        votedCount,
        totalJudges,
        allVoted: votedCount >= totalJudges && totalJudges > 0,
      });

      // If all judges have voted, trigger auto-transition
      if (totalJudges > 0 && votedCount >= totalJudges) {
        votes.clear();
        triggerTransition(roomId, '', { isJudgeFeedback: true }).catch(console.error);
      } else if (totalJudges === 0) {
        // No judges present - transition immediately after 10s countdown
        votes.clear();
        triggerTransition(roomId, '', { isJudgeFeedback: true }).catch(console.error);
      }
    } catch (error) {
      console.error('Socket judge:next-phase error:', error);
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
          const s1DebatersCount = state.room.participants.filter((p: any) => {
            const r = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
            return r === 'debater' && p.speakerSlot === 'S1';
          }).length || 2;
          socket.emit('debate:prep-consensus-update', {
            readyUserIds: Array.from(consensusSet),
            totalDebaters: s1DebatersCount,
            readyCount: consensusSet.size,
          });
        }

        // Also sync judge next-phase votes if in judge feedback
        const votes = judgeNextPhaseVotes.get(roomId);
        if (votes && ['judge_feedback', 'final_judging'].includes(state.currentPhase)) {
          const assignedJudges = state.room.participants.filter((p: any) => {
            const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
            return role === 'judge';
          });
          socket.emit('judge:next-phase-vote-update', {
            votedUserIds: Array.from(votes),
            votedCount: votes.size,
            totalJudges: assignedJudges.length,
            allVoted: votes.size >= assignedJudges.length && assignedJudges.length > 0,
          });
        }
      }
    } catch (error) {
      console.error('Socket room:rejoin error:', error);
    }
  });
}
