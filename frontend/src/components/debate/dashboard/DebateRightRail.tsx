import { useState, type ReactNode } from 'react';

type ChatChannel = 'match' | 'viewer';

interface DebateRightRailProps {
  scoreContent: ReactNode;
  matchChatContent: ReactNode;
  viewerChatContent?: ReactNode;
  canViewViewerChat: boolean;
}

export function DebateRightRail({
  scoreContent,
  matchChatContent,
  viewerChatContent,
  canViewViewerChat,
}: DebateRightRailProps) {
  const [chatChannel, setChatChannel] = useState<ChatChannel>('match');
  const activeChannel = chatChannel === 'viewer' && canViewViewerChat ? 'viewer' : 'match';

  return (
    <aside className="debate-right-rail" aria-label="Score and chat panel">
      <section className="debate-right-score-panel">
        <header className="debate-right-panel-heading">
          <div>
            <span className="debate-panel-eyebrow">Match score</span>
            <strong><i className="bi bi-journal-check" aria-hidden="true" /> Score</strong>
          </div>
        </header>
        <div className="debate-right-score-content">
          {scoreContent}
        </div>
      </section>

      <section className="debate-right-chat-panel">
        <header className="debate-right-chat-heading">
          <div>
            <span className="debate-panel-eyebrow">Communication</span>
            <strong><i className="bi bi-chat-dots-fill" aria-hidden="true" /> Chat</strong>
          </div>
          <div className="debate-chat-channel-switch" role="tablist" aria-label="Chat channel">
            <button
              type="button"
              role="tab"
              aria-selected={activeChannel === 'match'}
              className={activeChannel === 'match' ? 'is-active' : ''}
              onClick={() => setChatChannel('match')}
            >
              Match
            </button>
            {canViewViewerChat && (
              <button
                type="button"
                role="tab"
                aria-selected={activeChannel === 'viewer'}
                className={activeChannel === 'viewer' ? 'is-active' : ''}
                onClick={() => setChatChannel('viewer')}
              >
                Viewer
              </button>
            )}
          </div>
        </header>
        <div className="debate-right-chat-content" role="tabpanel">
          {activeChannel === 'viewer' ? viewerChatContent : matchChatContent}
        </div>
      </section>
    </aside>
  );
}
