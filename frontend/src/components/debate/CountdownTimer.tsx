import { useTranslation } from 'react-i18next';

interface CountdownTimerProps {
  timeRemaining: number;
  totalTime?: number;
  isPaused?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Server-synced countdown timer. Receives the remaining seconds from the
 * debate store (driven by socket `debate:timer-update`). Does NOT self-tick.
 *
 * Visual cues:
 *   - Yellow at <= 60s
 *   - Red at <= 30s
 *   - Paused shows a paused indicator
 */
export function CountdownTimer({
  timeRemaining,
  totalTime,
  isPaused,
  label,
  size = 'md',
}: CountdownTimerProps) {
  const { t } = useTranslation('common');
  const safe = Math.max(0, Math.floor(timeRemaining || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  let color = 'text-light';
  if (safe === 0) color = 'text-muted';
  else if (safe <= 30) color = 'text-danger';
  else if (safe <= 60) color = 'text-warning';

  const fontSize = size === 'lg' ? '3rem' : size === 'sm' ? '1.25rem' : '2rem';

  return (
    <div className="d-flex flex-column align-items-center">
      {label && <div className="text-muted small mb-1">{label}</div>}
      <div
        className={`fw-bold ${color}`}
        style={{ fontFamily: 'Orbitron, monospace', fontSize, lineHeight: 1 }}
        aria-live="polite"
      >
        {display}
      </div>
      {isPaused && <div className="text-warning small mt-1">⏸ {t('paused', 'Paused')}</div>}
      {totalTime ? (
        <div
          className="mt-2 bg-secondary rounded-pill"
          style={{ width: '100%', height: 6, overflow: 'hidden' }}
        >
          <div
            className={`h-100 ${safe <= 30 ? 'bg-danger' : safe <= 60 ? 'bg-warning' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, (safe / totalTime) * 100)}%`, transition: 'width 0.4s linear' }}
          />
        </div>
      ) : null}
    </div>
  );
}
