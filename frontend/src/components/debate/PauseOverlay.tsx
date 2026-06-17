import { useEffect, useState } from 'react';
import { useDebateStore } from '@stores/debateStore';

interface PauseOverlayProps {
  /**
   * Whether the debate is currently paused. The component renders nothing
   * when this is false.
   */
  isPaused: boolean;
  /**
   * Snapshot of time remaining (seconds) at the moment pause was triggered.
   * Falls back to the live store value if not provided.
   */
  pausedAtRemaining?: number;
}

/**
 * Full-screen overlay shown to every participant when the host pauses the
 * debate. Includes a live countdown that holds at the frozen value so
 * everyone sees the same remaining time.
 */
export function PauseOverlay({ isPaused, pausedAtRemaining }: PauseOverlayProps) {
  const liveTimeRemaining = useDebateStore((s) => s.timeRemaining);
  const totalTime = useDebateStore((s) => s.totalTime);

  // Freeze the time at the moment we entered the pause. We hold it locally
  // so a missed socket update cannot reset the overlay's clock.
  const [frozenSeconds, setFrozenSeconds] = useState<number>(() => {
    return pausedAtRemaining ?? liveTimeRemaining ?? 0;
  });

  useEffect(() => {
    if (isPaused) {
      // Snapshot whatever value we have right now (the server has stopped ticking).
      setFrozenSeconds(pausedAtRemaining ?? liveTimeRemaining ?? 0);
    }
  }, [isPaused, pausedAtRemaining, liveTimeRemaining]);

  if (!isPaused) return null;

  const safe = Math.max(0, Math.floor(frozenSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        pointerEvents: 'none',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        className="text-center px-5 py-4 rounded-4 border border-warning border-opacity-50"
        style={{
          background: 'rgba(20, 20, 20, 0.85)',
          minWidth: 320,
        }}
      >
        <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
          <span
            className="d-inline-block"
            style={{
              fontSize: '2rem',
              animation: 'pulse-pause 1.2s ease-in-out infinite',
            }}
            aria-hidden
          >
            ⏸
          </span>
          <span
            className="text-warning fw-bold"
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '1.8rem',
              letterSpacing: '0.15em',
            }}
          >
            PAUSED
          </span>
        </div>

        <div
          className="text-white fw-bold"
          style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: '4rem',
            lineHeight: 1,
            textShadow: '0 0 18px rgba(255, 193, 7, 0.45)',
          }}
        >
          {display}
        </div>

        {totalTime ? (
          <div className="text-muted small mt-2" style={{ letterSpacing: '0.1em' }}>
            TIME REMAINING WHEN PAUSED
          </div>
        ) : (
          <div className="text-muted small mt-2" style={{ letterSpacing: '0.1em' }}>
            DEBATE IS PAUSED BY THE HOST
          </div>
        )}

        <div
          className="text-muted small mt-3"
          style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}
        >
          The debate will resume when the host clicks <strong className="text-warning">Resume</strong>.
        </div>
      </div>

      <style>{`
        @keyframes pulse-pause {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.18); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
