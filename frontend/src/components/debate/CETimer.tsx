interface CETimerProps {
  team: 'proposition' | 'opposition';
  timeRemaining: number;
  isActive: boolean;
  isPaused: boolean;
}

/**
 * Per-team CE timer. Receives the remaining seconds from the socket
 * (driven by ceTimerService). Does NOT self-tick.
 */
export function CETimer({ team, timeRemaining, isActive, isPaused }: CETimerProps) {
  const safe = Math.max(0, Math.floor(timeRemaining || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const baseColor = team === 'proposition' ? 'text-info' : 'text-danger';
  const mutedColor = 'text-muted';
  const dangerColor = 'text-danger';

  const color = !isActive
    ? mutedColor
    : safe <= 0
      ? mutedColor
      : safe <= 30
        ? dangerColor
        : baseColor;

  return (
    <div
      className={`p-3 rounded-3 text-center ${isActive ? 'border border-primary' : 'border border-secondary'}`}
      style={{ minWidth: 140, opacity: isActive ? 1 : 0.55 }}
    >
      <div className="text-uppercase small text-muted mb-1">{team}</div>
      <div
        className={`fw-bold ${color}`}
        style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.75rem', lineHeight: 1 }}
      >
        {display}
      </div>
      {isActive && isPaused ? (
        <div className="text-warning small mt-1">⏸ Paused</div>
      ) : !isActive ? (
        <div className="text-muted small mt-1">Idle</div>
      ) : null}
    </div>
  );
}
