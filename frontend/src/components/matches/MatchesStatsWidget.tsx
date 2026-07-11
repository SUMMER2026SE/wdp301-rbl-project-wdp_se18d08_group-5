import type { DebateRoom } from '@/types';

interface MatchesStatsWidgetProps {
  rooms: DebateRoom[];
}

export function MatchesStatsWidget({ rooms }: MatchesStatsWidgetProps) {
  const totalRooms = rooms.length;
  const liveCount = rooms.filter((r) => r.status === 'active' || r.status === 'paused').length;
  const waitingCount = rooms.filter((r) => r.status === 'waiting' || r.status === 'ready').length;
  const totalOccupancy = rooms.reduce((acc, curr) => acc + curr.participants.length, 0);

  return (
    <div className="matches-stats-wrapper">
      <h5 className="matches-stats-title">Arena Analytics</h5>

      <div className="matches-stats-row">
        <span className="matches-stats-label">Total Rooms</span>
        <span className="matches-stats-val text-white">{totalRooms}</span>
      </div>

      <div className="matches-stats-row">
        <span className="matches-stats-label">Live Broadcasts</span>
        <span className="matches-stats-val live">{liveCount} On Air</span>
      </div>

      <div className="matches-stats-row">
        <span className="matches-stats-label">Waiting Lobbies</span>
        <span className="matches-stats-val cyan">{waitingCount} Open</span>
      </div>

      <div className="matches-stats-row">
        <span className="matches-stats-label">Global Occupancy</span>
        <span className="matches-stats-val text-white">{totalOccupancy} Users</span>
      </div>
    </div>
  );
}
