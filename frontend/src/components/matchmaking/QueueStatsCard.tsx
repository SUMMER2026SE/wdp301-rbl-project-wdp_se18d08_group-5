import { Alert } from 'react-bootstrap';

interface QueueStatsCardProps {
  waitTime: number;
  eloRange: number | undefined;
  format: string | undefined;
  isQueued: boolean;
  status: string;
}

export function QueueStatsCard({
  waitTime,
  eloRange,
  format,
  isQueued,
  status,
}: QueueStatsCardProps) {
  return (
    <div className="queue-stats-card-wrapper mt-4">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <span
          className="small text-muted text-uppercase fw-bold"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          Queue Metrics
        </span>
      </div>

      <Alert
        variant={status === 'matched' ? 'success' : 'info'}
        className="bg-dark text-white border-secondary mb-0"
      >
        <div className="d-flex flex-column gap-2">
          <div className="d-flex justify-content-between">
            <span className="text-secondary small">Search Duration:</span>
            <span className="fw-bold text-primary">{waitTime}s</span>
          </div>

          {eloRange && (
            <div className="d-flex justify-content-between">
              <span className="text-secondary small">ELO Bracket Gap:</span>
              <span className="fw-bold text-warning">+/- {eloRange}</span>
            </div>
          )}

          {format && (
            <div className="d-flex justify-content-between">
              <span className="text-secondary small">Lobby Format:</span>
              <span className="fw-bold text-success">{format}</span>
            </div>
          )}
        </div>
      </Alert>

      {/* Futuristic Command Logs */}
      {isQueued && (
        <div className="queue-logs-panel mt-3">
          <div className="queue-log-line cyan">[SYS] Connection initialized.</div>
          <div className="queue-log-line">[SYS] Matching socket channel bound.</div>
          {waitTime > 0 && (
            <div className="queue-log-line">[SYS] Looking for suitable debaters...</div>
          )}
          {eloRange && eloRange > 50 && (
            <div className="queue-log-line text-warning">
              [SYS] Expanding ELO limits bracket to match wider skill levels.
            </div>
          )}
          {status === 'matched' && (
            <div className="queue-log-line success">
              [SYS] Debater found! Matching session verified.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
