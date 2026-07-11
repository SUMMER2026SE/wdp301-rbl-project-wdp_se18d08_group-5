import { Button, ButtonGroup } from 'react-bootstrap';
import type { DebateFormat } from '@/types';

interface QueueConsoleProps {
  format: DebateFormat;
  onFormatChange: (format: DebateFormat) => void;
  isQueued: boolean;
  onJoin: () => void;
  onLeave: () => void;
  isPending: boolean;
  status: string;
}

export function QueueConsole({
  format,
  onFormatChange,
  isQueued,
  onJoin,
  onLeave,
  isPending,
  status,
}: QueueConsoleProps) {
  return (
    <div className="queue-console-card">
      <div className="console-title-wrap">
        <h3 className="h5 text-white mb-0" style={{ fontFamily: 'Orbitron, sans-serif' }}>
          Queue Controller
        </h3>
        <span
          className={`queue-console-status-badge ${status === 'matched' ? 'matched' : isQueued ? 'searching' : 'idle'}`}
        >
          {status === 'matched' ? 'Ready' : isQueued ? 'Searching' : 'Offline'}
        </span>
      </div>

      {/* Select Mode */}
      <div className="mb-4">
        <span className="console-label">Match Format</span>
        <p className="small text-muted mb-2">
          Select between single player duel (1v1) or squad debate tournament (3v3).
        </p>
        <ButtonGroup className="w-100" aria-label="Format select">
          {(['1v1', '3v3'] as DebateFormat[]).map((item) => (
            <Button
              key={item}
              variant={format === item ? 'primary' : 'outline-primary'}
              onClick={() => onFormatChange(item)}
              disabled={isQueued}
              className={format === item ? 'text-black fw-bold' : 'text-primary'}
              style={{ padding: '0.85rem' }}
            >
              {item} Format
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {/* Actions */}
      <div className="console-label mb-2">System Commands</div>
      <div className="d-flex gap-3 mt-1">
        {!isQueued ? (
          <Button
            onClick={onJoin}
            disabled={isPending}
            className="flex-grow-1 text-black fw-bold py-3"
            style={{
              background: 'var(--bs-primary)',
              border: 'none',
              fontFamily: 'Orbitron, sans-serif',
              boxShadow: '0 0 15px rgba(0, 245, 255, 0.3)',
            }}
          >
            <i className="bi bi-play-fill me-2 fs-5" />
            Initialize Queue
          </Button>
        ) : (
          <Button
            variant="danger"
            onClick={onLeave}
            disabled={isPending}
            className="flex-grow-1 text-white fw-bold py-3"
            style={{
              background: '#ff006e',
              border: 'none',
              fontFamily: 'Orbitron, sans-serif',
              boxShadow: '0 0 15px rgba(255, 0, 110, 0.3)',
            }}
          >
            <i className="bi bi-x-circle me-2 fs-5" />
            Abort Matching
          </Button>
        )}
      </div>
    </div>
  );
}
