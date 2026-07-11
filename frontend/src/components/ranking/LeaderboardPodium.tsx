import { Link } from 'react-router-dom';
import type { LeaderboardEntry } from '@/types';
import { RankBadge } from './RankBadge';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export function LeaderboardPodium({ entries, currentUserId }: LeaderboardPodiumProps) {
  // Extract top 3 players
  const first = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third = entries.find((e) => e.rank === 3);

  const renderPedestal = (entry: LeaderboardEntry | undefined, rank: 1 | 2 | 3) => {
    if (!entry) return null;

    const isCurrentUser = entry._id === currentUserId;
    const playerName = entry.displayName || entry.username;
    const totalGames = entry.wins + entry.losses + (entry.draws ?? 0);
    const winRate = totalGames > 0 ? Math.round((entry.wins / totalGames) * 100) : 0;

    return (
      <div
        className={`podium-pedestal rank-${rank} ${isCurrentUser ? 'current-user-pedestal' : ''}`}
      >
        <div className="podium-avatar-wrapper">
          {entry.avatar ? (
            <img src={entry.avatar} alt={playerName} className="podium-avatar" />
          ) : (
            <span className="podium-avatar d-inline-flex align-items-center justify-content-center fw-bold fs-4 text-black bg-primary">
              {playerName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="podium-medal">{rank}</span>
        </div>

        <Link to={`/profile/${entry._id}`} className="podium-name text-nowrap">
          {playerName}
        </Link>
        <span className="podium-username">@{entry.username}</span>

        <span className="podium-elo">{entry.elo} ELO</span>
        <div className="mt-2 mb-2">
          <RankBadge tier={entry.tier} />
        </div>
        <span className="podium-winrate">
          {winRate}% WR ({entry.wins}W - {entry.losses}L)
        </span>
      </div>
    );
  };

  if (entries.length === 0) return null;

  return (
    <div className="podium-container">
      {/* Silver - Left */}
      {renderPedestal(second, 2)}

      {/* Gold - Center */}
      {renderPedestal(first, 1)}

      {/* Bronze - Right */}
      {renderPedestal(third, 3)}
    </div>
  );
}
