import React from 'react';

interface ForumEmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionButton?: React.ReactNode;
}

export function ForumEmptyState({
  icon = 'bi-chat-left-dots-fill',
  title,
  description,
  actionButton,
}: ForumEmptyStateProps) {
  return (
    <div className="forum-empty-state">
      <i className={`bi ${icon} forum-empty-icon`} />
      <h3 className="forum-empty-title">{title}</h3>
      <p className="forum-empty-desc mb-3">{description}</p>
      {actionButton && <div className="mt-3">{actionButton}</div>}
    </div>
  );
}
