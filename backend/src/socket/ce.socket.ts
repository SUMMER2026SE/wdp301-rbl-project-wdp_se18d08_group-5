import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { Message } from '../models/Message.js';
import { getIO } from './index.js';

const CE_SECONDS = 2 * 60;
const CE_QUOTA_PER_TEAM = 2;

type Team = 'proposition' | 'opposition';

interface CETimerState {
  roomId: string;
  sharedRemaining: number;
  totalSeconds: number;
  isPaused: boolean;
  interval: NodeJS.Timeout | null;
  questionsPro: number;
  questionsOpp: number;
}

/** Tracks which teams have requested early CE finish for consensus-based ending. */
const ceFinishConsensus: Map<string, Set<Team>> = new Map();

/**
 * Cross Examination Timer (Human Host Mode):
 * - Both teams talk simultaneously during the 2-minute CE window
 * - Each team has a quota of 2 questions
 * - Timer is shared — when it hits 0, CE ends
 * - Server-authoritative; broadcasts every second
 */
class CETimerService {
  private states: Map<string, CETimerState> = new Map();

  setIO(_io: Server) {
    // io is accessed via getIO() in broadcastState
  }

  init(roomId: string) {
    const existing = this.states.get(roomId);
    if (existing?.interval) {
      clearInterval(existing.interval);
    }

    this.states.set(roomId, {
      roomId,
      sharedRemaining: CE_SECONDS,
      totalSeconds: CE_SECONDS,
      isPaused: false,
      interval: null,
      questionsPro: 0,
      questionsOpp: 0,
    });

    this.broadcastState(roomId);
  }

  start(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    if (state.interval) return; // already ticking

    state.interval = setInterval(() => {
      if (state.isPaused) return;

      state.sharedRemaining = Math.max(0, state.sharedRemaining - 1);
      this.broadcastState(roomId);

      if (state.sharedRemaining <= 0) {
        this.stopTicking(roomId);
        import('../features/debate/debate.service.js').then(({ triggerTransition }) => {
          triggerTransition(roomId).catch(console.error);
        });
      }
    }, 1000);

    this.broadcastState(roomId);
  }

  pause(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    state.isPaused = true;
    this.broadcastState(roomId);
  }

  resume(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    state.isPaused = false;
    this.broadcastState(roomId);
  }

  stop(roomId: string) {
    const state = this.states.get(roomId);
    if (state?.interval) {
      clearInterval(state.interval);
    }
    this.states.delete(roomId);
  }

  private stopTicking(roomId: string) {
    const state = this.states.get(roomId);
    if (state?.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  stopTickingOnly(roomId: string) {
    this.stopTicking(roomId);
  }

  getState(roomId: string): CETimerState | null {
    return this.states.get(roomId) || null;
  }

  /**
   * Called when a team asks a question.
   * Checks quota; if exceeded, returns false.
   */
  recordQuestion(roomId: string, team: Team): boolean {
    const state = this.states.get(roomId);
    if (!state) return false;

    if (team === 'proposition') {
      if (state.questionsPro >= CE_QUOTA_PER_TEAM) return false;
      state.questionsPro++;
    } else {
      if (state.questionsOpp >= CE_QUOTA_PER_TEAM) return false;
      state.questionsOpp++;
    }

    this.broadcastState(roomId);
    return true;
  }

  /**
   * Check if both teams have exhausted their quota.
   */
  isQuotaExhausted(roomId: string): boolean {
    const state = this.states.get(roomId);
    if (!state) return false;
    return (
      state.questionsPro >= CE_QUOTA_PER_TEAM &&
      state.questionsOpp >= CE_QUOTA_PER_TEAM
    );
  }

  private broadcastState(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    const io = getIO();
    io?.to(roomId).emit('cross-exam:update', {
      sharedRemaining: state.sharedRemaining,
      totalSeconds: state.totalSeconds,
      questionsPro: state.questionsPro,
      questionsOpp: state.questionsOpp,
      quotaPerTeam: CE_QUOTA_PER_TEAM,
      isPaused: state.isPaused,
    });
  }
}

export const ceTimerService = new CETimerService();

/**
 * Initialize CE for a room. Called when host starts the cross_exam phase.
 */
export function initCEForRoom(roomId: string) {
  ceTimerService.init(roomId);
}

/**
 * Start the CE shared timer. Called after host Start in CE phase.
 */
export function startCEForRoom(roomId: string) {
  ceTimerService.start(roomId);
}

function computePenalty(roomId: string, questionsPro: number, questionsOpp: number) {
  return {
    pro: { quota: CE_QUOTA_PER_TEAM, asked: questionsPro, missing: Math.max(0, CE_QUOTA_PER_TEAM - questionsPro) },
    opp: { quota: CE_QUOTA_PER_TEAM, asked: questionsOpp, missing: Math.max(0, CE_QUOTA_PER_TEAM - questionsOpp) },
    roomId,
  };
}

async function broadcastSystemMessage(roomId: string, content: string) {
  try {
    const message = await Message.create({
      roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'host',
      content,
      type: 'system',
      isToxic: false,
    });
    const io = getIO();
    io?.to(roomId).emit('chat:message', {
      _id: message._id,
      roomId: message.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'host',
      content: message.content,
      type: 'system',
      isToxic: false,
      timestamp: message.timestamp,
    });
  } catch (error) {
    console.error('CE system message error:', error);
  }
}

export function registerCEHandlers(_io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  /**
   * Pass turn — use up one quota for the team.
   * Both teams can pass independently; CE ends when time runs out
   * or both teams exhausted their 2-question quota.
   */
  socket.on('cross-exam:pass-turn', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) {
        socket.emit('cross-exam:error', { message: 'Room not found' });
        return;
      }
      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant || !participant.team) {
        socket.emit('cross-exam:error', { message: 'You are not a debater' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;
      const turn = session.currentTurn as any;
      if (turn.phase !== 'cross_exam') {
        socket.emit('cross-exam:error', { message: 'Current phase is not cross-exam' });
        return;
      }

      const team = participant.team as Team;
      const recorded = ceTimerService.recordQuestion(roomId, team);

      if (!recorded) {
        socket.emit('cross-exam:error', { message: 'Question quota exhausted for your team' });
        return;
      }

      // Persist to session
      const ceState = (turn.ceState as any) || {};
      const teamQuestionsKey = team === 'proposition' ? 'questionsPro' : 'questionsOpp';
      turn.ceState = { ...ceState, [teamQuestionsKey]: (ceState[teamQuestionsKey] || 0) + 1 };
      await session.save();

      await broadcastSystemMessage(roomId, `${participant.username} (${team}) passed CE turn (${ceState[teamQuestionsKey] || 1}/${CE_QUOTA_PER_TEAM})`);

      // If both teams exhausted quota, trigger transition
      if (ceTimerService.isQuotaExhausted(roomId)) {
        ceTimerService.stopTickingOnly(roomId);
        const { triggerTransition } = await import('../features/debate/debate.service.js');
        triggerTransition(roomId).catch(console.error);
      }
    } catch (error) {
      console.error('CE pass-turn error:', error);
      socket.emit('cross-exam:error', { message: 'Failed to pass CE turn' });
    }
  });

  /**
   * Debater requests early CE end — tracks which teams have consented.
   * When both teams have requested, auto-triggers transition.
   * Rule: "cả 2 đội cùng skip" ends CE early.
   */
  socket.on('debater:request-ce-early', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;
      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );
      if (!participant || !participant.team) {
        socket.emit('ce-early:error', { message: 'Only debaters can request early CE end' });
        return;
      }

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;
      const turn = session.currentTurn as any;
      if (turn?.phase !== 'cross_exam') {
        socket.emit('ce-early:error', { message: 'Current phase is not cross-exam' });
        return;
      }

      const team = participant.team as Team;
      if (!ceFinishConsensus.has(roomId)) {
        ceFinishConsensus.set(roomId, new Set());
      }
      const consensus = ceFinishConsensus.get(roomId)!;

      if (consensus.has(team)) {
        // Already requested — no-op
        return;
      }

      consensus.add(team);
      const io = getIO();
      io?.to(roomId).emit('ce-early:update', {
        roomId,
        requestingTeams: Array.from(consensus),
        requiredTeams: ['proposition', 'opposition'],
        allAgreed: consensus.size >= 2,
      });

      // When both teams agree, end CE
      if (consensus.size >= 2) {
        ceFinishConsensus.delete(roomId);
        ceTimerService.stopTickingOnly(roomId);
        await broadcastSystemMessage(roomId, 'Both teams agreed to end Cross-Examination');
        const { triggerTransition } = await import('../features/debate/debate.service.js');
        triggerTransition(roomId).catch(console.error);
      }
    } catch (error) {
      console.error('CE early request error:', error);
    }
  });

  /**
   * Finish CE early — host or Judge S1 forces end; also called after both teams agree.
   */
  socket.on('cross-exam:finish', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId);
      if (!room) return;
      const participant = room.participants.find(
        (entry) => entry.userId.toString() === userId,
      );

      const session = await DebateSession.findOne({ roomId: room._id });
      if (!session) return;
      const turn = session.currentTurn as any;

      if (turn?.phase !== 'cross_exam') {
        socket.emit('cross-exam:error', { message: 'Current phase is not cross-exam' });
        return;
      }

      // Gate: only host, Judge S1 (no-host modes), or both teams agreed
      const effectiveRole = participant
        ? participant.roomRole === 'owner' ? (participant as any).primaryRole : participant.roomRole
        : null;
      const isController =
        participant?.roomRole === 'owner' ||
        effectiveRole === 'host' ||
        (room.hostType !== 'human' && effectiveRole === 'judge' && (participant as any).speakerSlot === 'S1');
      const bothTeamsAgreed = (ceFinishConsensus.get(roomId)?.size ?? 0) >= 2;

      if (!isController && !bothTeamsAgreed) {
        socket.emit('cross-exam:error', {
          message: 'Only host/Judge S1 can force-end CE, or both teams must agree via the "End CE" button',
        });
        return;
      }

      // Clear consensus state
      ceFinishConsensus.delete(roomId);

      const ceState = turn.ceState as any;
      const questionsPro = ceState?.questionsPro || 0;
      const questionsOpp = ceState?.questionsOpp || 0;
      const penalty = computePenalty(roomId, questionsPro, questionsOpp);

      ceTimerService.stopTickingOnly(roomId);

      const io = getIO();
      io?.to(roomId).emit('cross-exam:ended', {
        scoresAdjustment: penalty,
        finishedBy: isController ? 'controller' : 'both_teams_agreed',
      });

      const { triggerTransition } = await import('../features/debate/debate.service.js');
      triggerTransition(roomId).catch(console.error);
    } catch (error) {
      console.error('CE finish error:', error);
      socket.emit('cross-exam:error', { message: 'Failed to finish CE' });
    }
  });

  /**
   * Ask a question — records quota, persists transcript.
   */
  socket.on(
    'cross-exam:question',
    async ({ roomId, team, question }: { roomId: string; team: Team; question: string }) => {
      try {
        if (!question || !question.trim()) {
          socket.emit('cross-exam:error', { message: 'Question is required' });
          return;
        }
        const room = await DebateRoom.findById(roomId);
        if (!room) return;
        const participant = room.participants.find(
          (entry) => entry.userId.toString() === userId,
        );
        if (!participant || participant.team !== team) {
          socket.emit('cross-exam:error', { message: 'You are not on this team' });
          return;
        }

        const session = await DebateSession.findOne({ roomId: room._id });
        const turn = session?.currentTurn as any;
        if (!session || turn?.phase !== 'cross_exam') {
          socket.emit('cross-exam:error', { message: 'Current phase is not cross-exam' });
          return;
        }

        const recorded = ceTimerService.recordQuestion(roomId, team);
        if (!recorded) {
          socket.emit('cross-exam:error', { message: 'Question quota exhausted for your team' });
          return;
        }

        // Persist
        const ceState = (turn.ceState as any) || {};
        const teamQuestionsKey = team === 'proposition' ? 'questionsPro' : 'questionsOpp';
        turn.ceState = {
          ...ceState,
          [teamQuestionsKey]: (ceState[teamQuestionsKey] || 0) + 1,
        };
        await session.save();

        const io = getIO();
        io?.to(roomId).emit('chat:message', {
          _id: `ce-${Date.now()}`,
          roomId,
          senderId: userId,
          senderName: participant.username,
          senderRole: 'debater',
          content: `❓ ${team}: ${question.trim()}`,
          type: 'cross-exam',
          isToxic: false,
          timestamp: new Date(),
        });

        // Check if both exhausted
        if (ceTimerService.isQuotaExhausted(roomId)) {
          ceTimerService.stopTickingOnly(roomId);
          const { triggerTransition } = await import('../features/debate/debate.service.js');
          triggerTransition(roomId).catch(console.error);
        }
      } catch (error) {
        console.error('CE question error:', error);
        socket.emit('cross-exam:error', { message: 'Failed to send question' });
      }
    },
  );

  /**
   * Answer — just append to transcript (no quota impact).
   */
  socket.on(
    'cross-exam:answer',
    async ({ roomId, team, answer }: { roomId: string; team: Team; answer: string }) => {
      try {
        if (!answer || !answer.trim()) {
          socket.emit('cross-exam:error', { message: 'Answer is required' });
          return;
        }
        const room = await DebateRoom.findById(roomId);
        if (!room) return;
        const participant = room.participants.find(
          (entry) => entry.userId.toString() === userId,
        );
        if (!participant) {
          socket.emit('cross-exam:error', { message: 'You are not in this room' });
          return;
        }

        const session = await DebateSession.findOne({ roomId: room._id });
        const turn = session?.currentTurn as any;
        if (!session || turn?.phase !== 'cross_exam') {
          socket.emit('cross-exam:error', { message: 'Current phase is not cross-exam' });
          return;
        }

        const ceState = (turn.ceState as any) || {};
        turn.ceState = {
          ...ceState,
          transcript: [...(ceState.transcript || []), {
            team,
            type: 'answer',
            content: answer.trim(),
            timestamp: new Date(),
          }],
        };
        await session.save();

        const io = getIO();
        io?.to(roomId).emit('chat:message', {
          _id: `ce-${Date.now()}`,
          roomId,
          senderId: userId,
          senderName: participant.username,
          senderRole: 'debater',
          content: `💬 ${team}: ${answer.trim()}`,
          type: 'cross-exam',
          isToxic: false,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('CE answer error:', error);
        socket.emit('cross-exam:error', { message: 'Failed to send answer' });
      }
    },
  );
}
