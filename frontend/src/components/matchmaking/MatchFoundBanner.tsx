import { Button } from 'react-bootstrap';

interface MatchFoundBannerProps {
  roomId: string | undefined;
  onEnter: () => void;
}

export function MatchFoundBanner({ roomId, onEnter }: MatchFoundBannerProps) {
  if (!roomId) return null;

  return (
    <div className="match-found-banner">
      <div className="match-found-title">Match Found</div>
      <p className="small text-secondary mb-3">
        Opponent matches acquired! Your debate room has been initialized.
      </p>
      <Button
        variant="success"
        onClick={onEnter}
        className="px-4 py-2 text-black fw-bold d-inline-flex align-items-center gap-2"
        style={{
          background: 'var(--bs-success)',
          border: 'none',
          boxShadow: '0 0 15px rgba(57, 255, 20, 0.4)',
          fontFamily: 'Orbitron, sans-serif',
        }}
      >
        <i className="bi bi-door-open-fill fs-5" />
        Enter Arena
      </Button>
    </div>
  );
}
