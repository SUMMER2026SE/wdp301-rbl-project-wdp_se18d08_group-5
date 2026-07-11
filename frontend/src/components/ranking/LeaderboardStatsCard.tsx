import type { LeaderboardEntry } from '@/types';

interface LeaderboardStatsCardProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardStatsCard({ entries }: LeaderboardStatsCardProps) {
  const totalPlayers = entries.length;

  const highestElo = entries.length > 0 ? Math.max(...entries.map((e) => e.elo)) : 0;

  const averageElo =
    entries.length > 0
      ? Math.round(entries.reduce((acc, curr) => acc + curr.elo, 0) / entries.length)
      : 0;

  return (
    <div className="leaderboard-stats-row">
      <div className="leaderboard-stat-card-premium">
        <div className="leaderboard-stat-icon gold">
          <i className="bi bi-award-fill" />
        </div>
        <div>
          <span className="leaderboard-stat-value">{highestElo}</span>
          <span className="leaderboard-stat-label d-block">Peak ELO Score</span>
        </div>
      </div>

      <div className="leaderboard-stat-card-premium">
        <div className="leaderboard-stat-icon">
          <i className="bi bi-graph-up-arrow" />
        </div>
        <div>
          <span className="leaderboard-stat-value">{averageElo}</span>
          <span className="leaderboard-stat-label d-block">Average ELO</span>
        </div>
      </div>

      <div className="leaderboard-stat-card-premium">
        <div className="leaderboard-stat-icon pink">
          <i className="bi bi-people-fill" />
        </div>
        <div>
          <span className="leaderboard-stat-value">{totalPlayers}</span>
          <span className="leaderboard-stat-label d-block">Tracked Competitors</span>
        </div>
      </div>
    </div>
  );
}
