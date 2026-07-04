import { useEffect, useState } from 'react';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';

import { hasHostControl } from '../../utils/roomPermissions';

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
  /**
   * Callback to resume the debate. Called when host clicks the Resume button inside the overlay.
   */
  onResume?: () => void;
  /**
   * Whether the resume action is currently in flight.
   */
  isResuming?: boolean;
}

/**
 * Full-screen overlay shown to every participant when the host pauses the
 * debate. Includes a live countdown that holds at the frozen value so
 * everyone sees the same remaining time.
 */
export function PauseOverlay({
  isPaused,
  pausedAtRemaining,
  onResume,
  isResuming,
}: PauseOverlayProps) {
  const liveTimeRemaining = useDebateStore((s) => s.timeRemaining);
  const totalTime = useDebateStore((s) => s.totalTime);
  const user = useAuthStore((s) => s.user);
  const room = useDebateStore((s) => s.room);
  const pauseType = useDebateStore((s) => s.pauseType);

  const currentParticipant = room?.participants.find((p) => p.userId === user?._id);
  const effectiveRole = currentParticipant
    ? currentParticipant.roomRole === 'owner'
      ? currentParticipant.primaryRole
      : currentParticipant.roomRole
    : null;

  const isHost = hasHostControl(room, user?._id);

  const canResume = isHost || (
    effectiveRole === 'debater' &&
    pauseType !== 'host' &&
    currentParticipant?.team === pauseType
  );

  // Freeze the time at the moment we entered the pause. We hold it locally
  // so a missed socket update cannot reset the overlay's clock.
  const [frozenSeconds, setFrozenSeconds] = useState<number>(() => {
    return pausedAtRemaining ?? liveTimeRemaining ?? 0;
  });

  const [pauseDuration, setPauseDuration] = useState(0);

  useEffect(() => {
    if (isPaused) {
      // Snapshot whatever value we have right now (the server has stopped ticking).
      setFrozenSeconds(pausedAtRemaining ?? liveTimeRemaining ?? 0);
      setPauseDuration(0);

      const interval = setInterval(() => {
        setPauseDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPaused, pausedAtRemaining, liveTimeRemaining]);

  if (!isPaused) return null;

  const safe = Math.max(0, Math.floor(frozenSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const pMinutes = Math.floor(pauseDuration / 60);
  const pSeconds = pauseDuration % 60;
  const pDisplay = `${String(pMinutes).padStart(2, '0')}:${String(pSeconds).padStart(2, '0')}`;

  const isTeamPause = pauseType === 'proposition' || pauseType === 'opposition';
  const teamPauseRemaining = Math.max(0, 180 - pauseDuration);
  const tpMinutes = Math.floor(teamPauseRemaining / 60);
  const tpSeconds = teamPauseRemaining % 60;
  const tpDisplay = `${String(tpMinutes).padStart(2, '0')}:${String(tpSeconds).padStart(2, '0')}`;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        pointerEvents: 'auto',
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
            className="text-warning fw-bold text-uppercase"
            style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: '1.4rem',
              letterSpacing: '0.15em',
            }}
          >
            {isTeamPause ? `${pauseType} Paused` : 'PAUSED'}
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
            DEBATE IS PAUSED
          </div>
        )}

        <div className="mt-4 pt-3 border-top border-secondary border-opacity-25 d-flex justify-content-around">
          <div>
            <div className="text-muted text-uppercase fw-semibold" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.1em' }}>
              Pause Duration
            </div>
            <div className="text-white fw-bold fs-4" style={{ fontFamily: 'Orbitron, monospace' }}>
              {pDisplay}
            </div>
          </div>
          {isTeamPause && (
            <div>
              <div className="text-warning text-uppercase fw-semibold" style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.1em' }}>
                Auto-Resume In
              </div>
              <div className="text-warning fw-bold fs-4" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 8px rgba(255, 193, 7, 0.3)' }}>
                {tpDisplay}
              </div>
            </div>
          )}
        </div>

        <div
          className="text-muted small mt-3 px-3"
          style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}
        >
          {canResume ? (
            'You have permission to resume this pause early.'
          ) : (
            `The debate will resume after 3 minutes or when the host/initiating team (${pauseType || 'host'}) clicks Resume.`
          )}
        </div>

        {canResume && onResume && (
          <button
            onClick={onResume}
            disabled={isResuming}
            className="btn btn-warning mt-4 px-4 py-2 fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2 mx-auto"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '13px',
              letterSpacing: '0.08em',
              boxShadow: '0 0 15px rgba(255, 193, 7, 0.45)',
              borderRadius: '8px',
              border: 'none',
              transition: 'all 0.2s ease-in-out',
            }}
          >
            <span>▶</span>
            <span>{isResuming ? 'Resuming...' : 'Resume Debate'}</span>
          </button>
        )}
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
