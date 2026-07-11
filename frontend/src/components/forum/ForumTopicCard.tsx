import { Link } from 'react-router-dom';
import type { ForumTopic } from '@/types';
import { formatRelativeTime } from '@utils/formatters';

interface ForumTopicCardProps {
  topic: ForumTopic;
}

export function ForumTopicCard({ topic }: ForumTopicCardProps) {
  const totalVotes = topic.agreeCount + topic.disagreeCount;
  const agreePercentage = totalVotes > 0 ? Math.round((topic.agreeCount / totalVotes) * 100) : 50;
  const disagreePercentage = totalVotes > 0 ? 100 - agreePercentage : 50;

  return (
    <Link to={`/forum/${topic._id}`} className="forum-topic-card-premium text-decoration-none">
      <div>
        <div className="forum-topic-title-area">
          <h4 className="forum-topic-title">{topic.title}</h4>
          <i className="bi bi-arrow-up-right-circle text-primary fs-5" />
        </div>
        {topic.description && <p className="forum-topic-desc">{topic.description}</p>}
      </div>

      <div>
        {/* Ratio bar */}
        <div className="d-flex justify-content-between small text-muted mb-1 px-1">
          <span className="text-proposition fw-bold">{agreePercentage}% Agree</span>
          <span className="text-opposition fw-bold">{disagreePercentage}% Disagree</span>
        </div>
        <div className="ratio-poll-bar">
          <div className="ratio-fill-agree" style={{ width: `${agreePercentage}%` }} />
          <div className="ratio-fill-disagree" style={{ width: `${disagreePercentage}%` }} />
        </div>

        {/* Metadata */}
        <div className="topic-meta-row">
          <div className="topic-badges">
            <span className="topic-badge-stat agree-theme">
              <i className="bi bi-hand-thumbs-up-fill" /> {topic.agreeCount}
            </span>
            <span className="topic-badge-stat disagree-theme">
              <i className="bi bi-hand-thumbs-down-fill" /> {topic.disagreeCount}
            </span>
            <span className="topic-badge-stat">
              <i className="bi bi-chat-square-text-fill text-muted" /> {topic.postCount}
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            {topic.createdBy?.avatar ? (
              <img
                src={topic.createdBy.avatar}
                alt={topic.createdBy.displayName}
                className="topic-creator-avatar"
                title={`Created by ${topic.createdBy.displayName}`}
              />
            ) : (
              <i className="bi bi-person-circle text-muted" style={{ fontSize: '1.15rem' }} />
            )}
            <span className="small text-muted">{formatRelativeTime(topic.lastActivityAt)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
