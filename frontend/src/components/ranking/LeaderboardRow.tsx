import { useNavigate } from 'react-router-dom';
import type { LeaderboardEntry } from '@/types';
import { RankBadge } from './RankBadge';

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  currentUserId?: string;
}

export function LeaderboardRow({ entry, currentUserId }: LeaderboardRowProps) {
  const navigate = useNavigate();
  const isCurrentUser = entry._id === currentUserId;
  const playerName = entry.displayName || entry.username;

  const totalGames = entry.wins + entry.losses + (entry.draws ?? 0);
  const winRate = totalGames > 0 ? Math.round((entry.wins / totalGames) * 100) : 0;

  // Visual Medal for ranking
  const renderRankBadge = (rank: number) => {
    if (rank === 1)
      return (
        <span className="rank-badge-node medal-1">
          <i className="bi bi-trophy-fill" />
        </span>
      );
    if (rank === 2) return <span className="rank-badge-node medal-2">2</span>;
    if (rank === 3) return <span className="rank-badge-node medal-3">3</span>;
    if (rank <= 10) return <span className="rank-badge-node medal-top10">{rank}</span>;
    return <span className="fw-semibold px-2">{rank}</span>;
  };

  const handleRowClick = () => {
    navigate(`/profile/${entry._id}`);
  };

  return (
    <tr
      className={`leaderboard-row-premium ${isCurrentUser ? 'current-user' : ''}`}
      onClick={handleRowClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Rank Medal */}
      <td>{renderRankBadge(entry.rank)}</td>

      {/* Profile Details */}
      <td>
        <div className="avatar-cell-wrapper">
          {entry.avatar ? (
            <img src={entry.avatar} alt={playerName} className="avatar-cell-img" />
          ) : (
            <span className="avatar-cell-fallback">{playerName.charAt(0).toUpperCase()}</span>
          )}
          <div className="text-start">
            <span className="fw-semibold text-white d-block">{playerName}</span>
            <span className="text-muted small">@{entry.username}</span>
          </div>
        </div>
      </td>

      {/* ELO */}
      <td>
        <span className="elo-cell-text">{entry.elo}</span>
      </td>

      {/* Badge */}
      <td>
        <RankBadge tier={entry.tier} />
      </td>

      {/* Win rate visual progress */}
      <td>
        <div className="d-flex align-items-center gap-3">
          <span className="text-nowrap" style={{ width: '85px' }}>
            {entry.wins}W - {entry.losses}L - {entry.draws ?? 0}D
          </span>
          <div className="winrate-bar-wrapper d-none d-sm-flex">
            <div className="winrate-progress-bar-container">
              <div className="winrate-progress-fill" style={{ width: `${winRate}%` }} />
            </div>
            <span className="winrate-bar-label">{winRate}% win rate</span>
          </div>
        </div>
      </td>
    </tr>
  );
}
