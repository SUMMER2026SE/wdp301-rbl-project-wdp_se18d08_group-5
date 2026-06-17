import { Server, Socket } from 'socket.io';
import { DebateRoom } from '../models/DebateRoom.js';
import { DebateSession } from '../models/DebateSession.js';
import { Message } from '../models/Message.js';
import { getIO } from './index.js';

const CE_SECONDS = 2 * 60;
const CE_QUOTA_PER_TEAM = 2;

type Team = 'proposition' | 'opposition';

interface CEStatePayload {
  askingTeam?: Team;
  answeringTeam?: Team;
  quotaPerTeam?: number;
  questionsAsked?: number;
  questionsAnswered?: number;
  currentRole?: 'asker' | 'answerer';
  transcript?: Array<Record<string, unknown>>;
}

interface CETimerState {
  roomId: string;
  proRemaining: number;
  oppRemaining: number;
  activeTeam: Team | null;
  interval: NodeJS.Timeout | null;
  isPaused: boolean;
}

/**
 * Server-authoritative Cross Examination timer.
 * - Each team has its own 3-minute quota.
 * - Timer only counts down for the active team (asking or answering).
 * - When the asking team passes turn, the timer is paused and the other team becomes active.
 *
 * NOTE: The authoritative phase/turn comes from the REST debate engine (Dev 2).
 * This service only tracks per-team CE seconds and broadcasts UI sync.
 */
class CETimerService {
  private states: Map<string, CETimerState> = new Map();

  init(roomId: string, proRemaining = CE_SECONDS, oppRemaining = CE_SECONDS) {
    const previous = this.states.get(roomId);
    if (previous?.interval) {
      clearInterval(previous.interval);
    }

    this.states.set(roomId, {
      roomId,
      proRemaining,
      oppRemaining,
      activeTeam: previous?.activeTeam || null,
      interval: null,
      isPaused: false,
    });

    this.broadcastState(roomId);
  }

  setActive(roomId: string, team: Team | null) {
    const state = this.states.get(roomId);
    if (!state) {
      this.init(roomId);
    }
    const next = this.states.get(roomId);
    if (!next) return;
    next.activeTeam = team;
    if (team) {
      this.startTicking(roomId);
    } else {
      this.stopTicking(roomId);
    }
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

  getState(roomId: string): CETimerState | null {
    return this.states.get(roomId) || null;
  }

  private startTicking(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    if (state.interval) {
      clearInterval(state.interval);
    }
    state.interval = setInterval(() => {
      if (state.isPaused || !state.activeTeam) return;
      if (state.activeTeam === 'proposition') {
        state.proRemaining = Math.max(0, state.proRemaining - 1);
      } else {
        state.oppRemaining = Math.max(0, state.oppRemaining - 1);
      }
      this.broadcastState(roomId);

      if (state.proRemaining <= 0 || state.oppRemaining <= 0) {
        this.stopTicking(roomId);
        import('../features/debate/debate.service.js').then(({ triggerTransition }) => {
          triggerTransition(roomId).catch(console.error);
        });
      }
    }, 1000);
  }

  private stopTicking(roomId: string) {
    const state = this.states.get(roomId);
    if (state?.interval) {
      clearInterval(state.interval);
      state.interval = null;
    }
  }

  private broadcastState(roomId: string) {
    const state = this.states.get(roomId);
    if (!state) return;
    const io = getIO();
    io?.to(roomId).emit('cross-exam:update', {
      activeTeam: state.activeTeam,
      questionsPro: 0,
      questionsOpp: 0,
      timeRemainingPro: state.proRemaining,
      timeRemainingOpp: state.oppRemaining,
      isPaused: state.isPaused,
    });
  }
}

export const ceTimerService = new CETimerService();

/**
 * Initialize CE timer for a room using the current session ceState.
 * Called when phase becomes cross_exam (from debate.socket.ts).
 */
export function initCEForRoom(roomId: string, askingTeam: Team) {
  ceTimerService.init(roomId, CE_SECONDS, CE_SECONDS);
  ceTimerService.setActive(roomId, askingTeam);
}

/**
 * Compute penalty score adjustments for incomplete CE quota.
 * §10.3: missing questions → that team loses the points for that section;
 * opponent receives max for the corresponding section.
 */
function computePenalty(roomId: string, questionsPro: number, questionsOpp: number) {
  return {
    pro: {
      quota: CE_QUOTA_PER_TEAM,
      asked: questionsPro,
      missing: Math.max(0, CE_QUOTA_PER_TEAM - questionsPro),
    },
    opp: {
      quota: CE_QUOTA_PER_TEAM,
      asked: questionsOpp,
      missing: Math.max(0, CE_QUOTA_PER_TEAM - questionsOpp),
    },
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

async function getCurrentCeState(roomId: string) {
  const session = await DebateSession.findOne({ roomId });
  const currentTurn = session?.currentTurn as unknown as { ceState?: CEStatePayload; phase?: string } | undefined;
  return {
    session,
    ceState: (currentTurn?.ceState as CEStatePayload | undefined) || null,
    phase: currentTurn?.phase,
  };
}

export function registerCEHandlers(_io: Server, socket: Socket) {
  const userId = (socket as unknown as { userId: string }).userId;

  /**
   * Pass turn in CE — switch activeTeam.
   * Note: Authoritative flow goes through Dev 2 REST (passCeTurn).
   * This socket handler is a fast-path to update the CE timer UI only.
   */
  socket.on('cross-exam:pass-turn', async ({ roomId }: { roomId: string }) => {
    try {
      const room = await DebateRoom.findById(roomId).select('participants');
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

      const { phase } = await getCurrentCeState(roomId);
      if (phase !== 'cross_exam') {
        socket.emit('cross-exam:error', { message: 'Current phase is not cross-exam' });
        return;
      }

      const state = ceTimerService.getState(roomId);
      if (!state) {
        socket.emit('cross-exam:error', { message: 'CE timer not initialized' });
        return;
      }

      // Switch active team
      const nextActive: Team = state.activeTeam === 'proposition' ? 'opposition' : 'proposition';
      ceTimerService.setActive(roomId, nextActive);
      await broadcastSystemMessage(roomId, `${participant.team} passed CE turn`);
    } catch (error) {
      console.error('CE pass-turn error:', error);
      socket.emit('cross-exam:error', { message: 'Failed to pass CE turn' });
    }
  });

  /**
   * Finish CE early — stops timer and notifies clients.
   * The authoritative transition to judge_feedback goes through REST
   * (debateService.finishPhase). Clients will then refresh via room:state-restore.
   */
  socket.on('cross-exam:finish', async ({ roomId, team }: { roomId: string; team: Team }) => {
    try {
      const { session, ceState } = await getCurrentCeState(roomId);
      if (!session) {
        socket.emit('cross-exam:error', { message: 'Session not found' });
        return;
      }

      const questionsPro = ceState?.askingTeam === 'proposition' ? ceState?.questionsAsked || 0 : 0;
      const questionsOpp = ceState?.askingTeam === 'opposition' ? ceState?.questionsAsked || 0 : 0;
      const penalty = computePenalty(roomId, questionsPro, questionsOpp);

      ceTimerService.stop(roomId);

      const io = getIO();
      io?.to(roomId).emit('cross-exam:ended', {
        scoresAdjustment: penalty,
        finishedBy: team,
      });
    } catch (error) {
      console.error('CE finish error:', error);
      socket.emit('cross-exam:error', { message: 'Failed to finish CE' });
    }
  });

  /**
   * Question — increments the quota tracker on the active asking team.
   * Persists to Message collection so the transcript is preserved.
   */
  socket.on(
    'cross-exam:question',
    async ({ roomId, team, question }: { roomId: string; team: Team; question: string }) => {
      try {
        if (!question || !question.trim()) {
          socket.emit('cross-exam:error', { message: 'Question is required' });
          return;
        }
        const room = await DebateRoom.findById(roomId).select('participants');
        const participant = room?.participants.find(
          (entry) => entry.userId.toString() === userId,
        );
        if (!participant || participant.team !== team) {
          socket.emit('cross-exam:error', { message: 'You are not on this team' });
          return;
        }

        const { ceState, session } = await getCurrentCeState(roomId);
        if (ceState?.askingTeam !== team) {
          socket.emit('cross-exam:error', { message: 'It is not your turn to ask' });
          return;
        }
        const questionsAsked = ceState?.questionsAsked || 0;
        if (questionsAsked >= (ceState?.quotaPerTeam || CE_QUOTA_PER_TEAM)) {
          socket.emit('cross-exam:error', { message: 'Question quota exhausted' });
          return;
        }

        if (session) {
          const transcript = (Array.isArray(ceState?.transcript) ? (ceState.transcript as Array<Record<string, unknown>>) : []);
          transcript.push({ team, type: 'question', content: question.trim(), timestamp: new Date() });
          (session.currentTurn as unknown as { ceState: Record<string, unknown> }).ceState = {
            ...(ceState || {}),
            transcript,
          };
          await session.save();
        }

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
      } catch (error) {
        console.error('CE question error:', error);
        socket.emit('cross-exam:error', { message: 'Failed to send question' });
      }
    },
  );

  /**
   * Answer — append to transcript only (no quota impact).
   */
  socket.on(
    'cross-exam:answer',
    async ({ roomId, team, answer }: { roomId: string; team: Team; answer: string }) => {
      try {
        if (!answer || !answer.trim()) {
          socket.emit('cross-exam:error', { message: 'Answer is required' });
          return;
        }
        const room = await DebateRoom.findById(roomId).select('participants');
        const participant = room?.participants.find(
          (entry) => entry.userId.toString() === userId,
        );
        if (!participant) {
          socket.emit('cross-exam:error', { message: 'You are not in this room' });
          return;
        }

        const { ceState, session } = await getCurrentCeState(roomId);
        if (ceState?.answeringTeam !== team) {
          socket.emit('cross-exam:error', { message: 'It is not your turn to answer' });
          return;
        }

        if (session) {
          const transcript = (Array.isArray(ceState?.transcript) ? (ceState.transcript as Array<Record<string, unknown>>) : []);
          transcript.push({ team, type: 'answer', content: answer.trim(), timestamp: new Date() });
          (session.currentTurn as unknown as { ceState: Record<string, unknown> }).ceState = {
            ...(ceState || {}),
            transcript,
            questionsAnswered: (ceState?.questionsAnswered || 0) + 1,
          };
          await session.save();
        }

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
