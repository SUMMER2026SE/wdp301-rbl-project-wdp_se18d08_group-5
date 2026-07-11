interface RadarScannerProps {
  isQueued: boolean;
  status: string;
}

export function RadarScanner({ isQueued, status }: RadarScannerProps) {
  const isSearching = isQueued && status !== 'matched';
  const isMatched = status === 'matched';

  return (
    <div className="radar-scanner-card">
      <div className="radar-screen-wrapper">
        {/* Radar concentric rings */}
        <div className="radar-ring ring-1" />
        <div className="radar-ring ring-2" />
        <div className="radar-ring ring-3" />

        {/* Crosshair grids */}
        <div className="radar-crosshair-v" />
        <div className="radar-crosshair-h" />

        {/* Rotating sweep line */}
        {isSearching && <div className="radar-sweep-line" />}

        {/* Blipped dots */}
        {isSearching && (
          <>
            <div className="radar-ping-dot pos-1" />
            <div className="radar-ping-dot pos-2" />
            <div className="radar-ping-dot pos-3" />
          </>
        )}

        {isMatched && (
          <div
            className="radar-ping-dot"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) scale(1.5)',
              background: '#39ff14',
              boxShadow: '0 0 15px 5px #39ff14',
            }}
          />
        )}
      </div>

      <div className="text-center mt-2">
        <h4
          className="h6 text-uppercase letter-spacing-1 text-muted mb-1"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          Visual Arena Radar
        </h4>
        {isMatched ? (
          <span className="small text-success fw-bold">
            <i className="bi bi-check-circle-fill me-1" /> TARGET ACQUIRED
          </span>
        ) : isSearching ? (
          <span className="small text-primary fw-bold">
            <span className="spinner-grow spinner-grow-sm me-2" role="status" aria-hidden="true" />
            SCANNING FOR OPPONENT COORDS...
          </span>
        ) : (
          <span className="small text-muted">SYSTEM OFFLINE — DECK READY</span>
        )}
      </div>
    </div>
  );
}
