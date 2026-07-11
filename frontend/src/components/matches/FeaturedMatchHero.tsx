import type { DebateRoom } from '@/types';

interface FeaturedMatchHeroProps {
  room: DebateRoom;
  onWatch: (room: DebateRoom) => void;
}

export function FeaturedMatchHero({ room, onWatch }: FeaturedMatchHeroProps) {
  const handleSpectateClick = () => {
    onWatch(room);
  };

  return (
    <section className="broadcast-hero-section">
      <div className="broadcast-hero-content d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
        <div>
          <div className="broadcast-hero-badge">
            <span className="live-ping-dot me-2" />
            ON AIR Broadcast
          </div>
          <h1 className="broadcast-hero-title">{room.title || 'Featured Match'}</h1>
          <p className="broadcast-hero-motion mb-3">
            "{room.motion || 'No debate motion announced'}"
          </p>

          <div className="d-flex flex-wrap align-items-center gap-3">
            <span
              className="badge bg-primary text-black fw-bold px-2 py-1"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {room.format} Format
            </span>
            <span
              className="badge bg-dark border border-secondary text-secondary px-2 py-1"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              {room.roomType.toUpperCase()}
            </span>
            <span className="broadcast-spectators-count">
              <i className="bi bi-eye-fill text-muted" />
              {room.participants.length} Active Users
            </span>
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={handleSpectateClick}
            className="btn btn-danger px-4 py-2 text-white fw-bold d-flex align-items-center gap-2"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              background: '#ff006e',
              border: 'none',
              boxShadow: '0 0 15px rgba(255, 0, 110, 0.4)',
            }}
          >
            <i className="bi bi-broadcast fs-5" />
            Spectate Now
          </button>
        </div>
      </div>
    </section>
  );
}
