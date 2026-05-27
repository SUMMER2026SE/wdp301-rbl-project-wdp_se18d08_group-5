import { Server } from 'socket.io';

interface TimerState {
  roomId: string;
  timeRemaining: number;
  phase: string;
  isPaused: boolean;
  interval: NodeJS.Timeout | null;
}

/**
 * Server-authoritative timer service.
 * Broadcasts timer updates every second to all clients in a room.
 */
class TimerService {
  private timers: Map<string, TimerState> = new Map();
  private io: Server | null = null;

  setIO(io: Server) {
    this.io = io;
  }

  /**
   * Start a timer for a room/phase.
   */
  start(roomId: string, durationSeconds: number, phase: string, onComplete?: () => void) {
    this.stop(roomId); // Clear any existing timer

    const state: TimerState = {
      roomId,
      timeRemaining: durationSeconds,
      phase,
      isPaused: false,
      interval: null,
    };

    state.interval = setInterval(() => {
      if (state.isPaused) return;

      state.timeRemaining--;

      // Broadcast every second
      this.io?.to(roomId).emit('debate:timer-update', {
        timeRemaining: state.timeRemaining,
        phase: state.phase,
      });

      // 1-minute warning
      if (state.timeRemaining === 60) {
        this.io?.to(roomId).emit('debate:timer-warning', { timeRemaining: 60 });
      }

      // Timer complete
      if (state.timeRemaining <= 0) {
        this.stop(roomId);
        this.io?.to(roomId).emit('debate:timer-complete', { phase: state.phase });
        onComplete?.();
      }
    }, 1000);

    this.timers.set(roomId, state);
  }

  /**
   * Pause timer.
   */
  pause(roomId: string) {
    const state = this.timers.get(roomId);
    if (state) {
      state.isPaused = true;
      this.io?.to(roomId).emit('debate:paused');
    }
  }

  /**
   * Resume timer.
   */
  resume(roomId: string) {
    const state = this.timers.get(roomId);
    if (state) {
      state.isPaused = false;
      this.io?.to(roomId).emit('debate:resumed');
    }
  }

  /**
   * Stop and remove timer.
   */
  stop(roomId: string) {
    const state = this.timers.get(roomId);
    if (state?.interval) {
      clearInterval(state.interval);
    }
    this.timers.delete(roomId);
  }

  /**
   * Get remaining time for a room.
   */
  getTimeRemaining(roomId: string): number {
    return this.timers.get(roomId)?.timeRemaining ?? 0;
  }

  /**
   * Check if timer is running.
   */
  isRunning(roomId: string): boolean {
    const state = this.timers.get(roomId);
    return !!state && !state.isPaused && state.timeRemaining > 0;
  }
}

export const timerService = new TimerService();
