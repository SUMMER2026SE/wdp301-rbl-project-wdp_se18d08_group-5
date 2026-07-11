import type { DebateRoom } from '@/types';

interface MatchCardProps {
  room: DebateRoom;
  currentUserId?: string;
  onJoin: (room: DebateRoom) => void;
  onWatch: (room: DebateRoom) => void;
  onRejoin: (roomId: string) => void;
  onResult: (roomId: string) => void;
}

function getEffectiveRole(participant: DebateRoom['participants'][0] | undefined): string | null {
  if (!participant) return null;
  if (participant.roomRole === 'owner') return participant.primaryRole || 'owner';
  return participant.roomRole;
}

export function MatchCard({
  room,
  currentUserId,
  onJoin,
  onWatch,
  onRejoin,
  onResult,
}: MatchCardProps) {
  const userPart = room.participants.find((p) => p.userId === currentUserId);
  const userEffectiveRole = getEffectiveRole(userPart);
  const canRejoin =
    room.status !== 'completed' &&
    userPart &&
    ['host', 'debater', 'judge'].includes(userEffectiveRole || '');
  const isLive = room.status === 'active' || room.status === 'paused';

  // Determine state class for glows
  const stateClass = isLive
    ? 'state-live'
    : room.status === 'completed'
      ? 'state-completed'
      : 'state-waiting';

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (room.status === 'completed') {
      onResult(room._id);
    } else if (isLive) {
      if (canRejoin) {
        onRejoin(room._id);
      } else {
        onWatch(room);
      }
    } else {
      onJoin(room);
    }
  };

  return (
    <div className={`match-card-premium ${stateClass}`}>
      <div>
        {/* Header Title & Status Badge */}
        <div className="match-card-header">
          <h4 className="match-card-title">{room.title || 'Untitled debate room'}</h4>
          <span className={`match-status-badge ${room.status}`}>
            {room.status === 'active' ? (
              <>
                <span className="live-ping-dot me-1" />
                Live
              </>
            ) : (
              room.status
            )}
          </span>
        </div>

        {/* Debate Motion */}
        <p className="match-card-motion">{room.motion || 'No debate motion announced yet'}</p>

        {/* Tags */}
        <div className="match-tags">
          <span className="match-tag-pill format-badge">{room.format}</span>
          <span className="match-tag-pill type-badge">{room.roomType}</span>
          {room.isPrivate && <span className="match-tag-pill private-badge">Private</span>}
        </div>
      </div>

      {/* Footer Info & Actions */}
      <div className="match-card-footer">
        <span className="match-occupancy">
          <i className="bi bi-people-fill text-muted" />
          {room.participants.length} participants
        </span>

        {room.status === 'completed' ? (
          <button type="button" className="match-action-btn result" onClick={handleActionClick}>
            View Result
          </button>
        ) : isLive ? (
          canRejoin ? (
            <button type="button" className="match-action-btn rejoin" onClick={handleActionClick}>
              Rejoin
            </button>
          ) : (
            <button type="button" className="match-action-btn watch" onClick={handleActionClick}>
              Watch Live
            </button>
          )
        ) : (
          <button type="button" className="match-action-btn join" onClick={handleActionClick}>
            Join Lobby
          </button>
        )}
      </div>
    </div>
  );
}
