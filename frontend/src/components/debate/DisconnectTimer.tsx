import { useEffect, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { useDebateStore } from '@stores/debateStore';

const DISCONNECT_TIMEOUT_SECONDS = 5 * 60; // 5 minutes

export function DisconnectTimer() {
  const { disconnectTimerActive, disconnectTimerTeam, disconnectTimerStartTime, disconnectedMembers } = useDebateStore();
  const [secondsRemaining, setSecondsRemaining] = useState(DISCONNECT_TIMEOUT_SECONDS);

  useEffect(() => {
    if (!disconnectTimerActive || !disconnectTimerStartTime) {
      setSecondsRemaining(DISCONNECT_TIMEOUT_SECONDS);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - disconnectTimerStartTime) / 1000);
      const remaining = Math.max(0, DISCONNECT_TIMEOUT_SECONDS - elapsed);
      setSecondsRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [disconnectTimerActive, disconnectTimerStartTime]);

  if (!disconnectTimerActive) {
    return null;
  }

  const teamLabel = disconnectTimerTeam === 'proposition' ? 'PROPOSITION' : 'OPPOSITION';
  const teamColor = disconnectTimerTeam === 'proposition' ? '#00f5ff' : '#ff006e';

  // Get disconnected members of this team
  const teamDisconnectedMembers = Object.values(disconnectedMembers).filter(
    (m) => m.team === disconnectTimerTeam
  );

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <Alert
      variant="warning"
      className="d-flex align-items-center justify-content-between gap-2 py-2 px-3 mb-2 flex-shrink-0"
      style={{
        background: 'rgba(255, 193, 7, 0.15)',
        border: '1px solid rgba(255, 193, 7, 0.4)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <i className="bi bi-exclamation-triangle-fill text-warning"></i>
        <div>
          <span className="fw-bold" style={{ color: teamColor }}>
            {teamLabel}
          </span>{' '}
          <span className="text-white">team disconnected</span>
          <div className="small text-muted">
            {teamDisconnectedMembers.map((m) => m.username).join(', ')} — waiting for reconnection
          </div>
        </div>
      </div>
      <div
        className="text-center px-3 py-1 rounded"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 193, 7, 0.5)',
          fontFamily: 'Orbitron',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          color: secondsRemaining <= 60 ? '#ff006e' : '#ffd60a',
          textShadow: secondsRemaining <= 60 ? '0 0 10px #ff006e' : '0 0 10px #ffd60a',
        }}
      >
        {timeDisplay}
        <div className="small" style={{ fontSize: '8px', opacity: 0.7 }}>
          FORFEIT COUNTDOWN
        </div>
      </div>
    </Alert>
  );
}
