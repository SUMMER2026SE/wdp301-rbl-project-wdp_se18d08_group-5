import { Link } from 'react-router-dom';
import type { ForumTopic } from '@/types';

interface ForumStatsWidgetProps {
  topics: ForumTopic[];
}

export function ForumStatsWidget({ topics }: ForumStatsWidgetProps) {
  // Aggregate stats from the topics list
  const totalTopics = topics.length;
  const totalPosts = topics.reduce((acc, curr) => acc + curr.postCount, 0);
  const totalVotes = topics.reduce((acc, curr) => acc + (curr.agreeCount + curr.disagreeCount), 0);

  // Get top 3 trending debates based on postCount + votes
  const trendingDebates = [...topics]
    .sort((a, b) => {
      const heatA = a.postCount * 2 + (a.agreeCount + a.disagreeCount);
      const heatB = b.postCount * 2 + (b.agreeCount + b.disagreeCount);
      return heatB - heatA;
    })
    .slice(0, 3);

  return (
    <div className="forum-stats-widget mb-4">
      {/* Aggregated Stats Grid */}
      <div className="forum-stats-grid">
        <div className="forum-stat-card">
          <div className="forum-stat-icon cyan">
            <i className="bi bi-journal-text" />
          </div>
          <div className="forum-stat-info">
            <span className="forum-stat-value">{totalTopics}</span>
            <span className="forum-stat-label">Debates</span>
          </div>
        </div>

        <div className="forum-stat-card">
          <div className="forum-stat-icon purple">
            <i className="bi bi-chat-dots-fill" />
          </div>
          <div className="forum-stat-info">
            <span className="forum-stat-value">{totalPosts}</span>
            <span className="forum-stat-label">Total Opinions</span>
          </div>
        </div>

        <div className="forum-stat-card">
          <div className="forum-stat-icon yellow">
            <i className="bi bi-people-fill" />
          </div>
          <div className="forum-stat-info">
            <span className="forum-stat-value">{totalVotes}</span>
            <span className="forum-stat-label">Votes Cast</span>
          </div>
        </div>
      </div>

      {/* Trending Debates List Card */}
      <div className="trending-side-card">
        <h5 className="trending-side-title">
          <i className="bi bi-fire text-danger" /> Trending Debates
        </h5>
        {trendingDebates.length > 0 ? (
          <div>
            {trendingDebates.map((topic, index) => {
              const totalVotes = topic.agreeCount + topic.disagreeCount;
              return (
                <Link key={topic._id} to={`/forum/${topic._id}`} className="trending-item-row">
                  <span className="trending-item-count">#0{index + 1}</span>
                  <div className="trending-item-body">
                    <h6 className="trending-item-title">{topic.title}</h6>
                    <span className="trending-item-meta">
                      {topic.postCount} posts · {totalVotes} votes
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="small text-muted mb-0">No active debates yet.</p>
        )}
      </div>
    </div>
  );
}
