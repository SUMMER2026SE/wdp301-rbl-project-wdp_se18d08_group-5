import type { ReactNode } from 'react';
import { CountdownTimer } from '../CountdownTimer';

export interface DebateMotionNotification {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  tone: 'score' | 'system';
}

interface DebateMotionStageProps {
  motion: string;
  phaseLabel: string;
  speakerName: string;
  speakerCode: string;
  format: string;
  hostType: string;
  judgeType: string;
  timeRemaining: number;
  totalTime: number;
  isPaused: boolean;
  isTransitioning: boolean;
  viewerCount: number;
  isViewer: boolean;
  mediaControls?: ReactNode;
  captionsPanel?: ReactNode;
  notifications?: DebateMotionNotification[];
  onOpenRules: () => void;
  onOpenPrivateRoom?: () => void;
}

function MetaBadge({ icon, children, tone = 'neutral' }: {
  icon: string;
  children: ReactNode;
  tone?: 'neutral' | 'purple' | 'cyan';
}) {
  return (
    <span className={`debate-motion-meta-badge tone-${tone}`}>
      <i className={`bi ${icon}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function DebateMotionStage({
  motion,
  phaseLabel,
  speakerName,
  speakerCode,
  format,
  hostType,
  judgeType,
  timeRemaining,
  totalTime,
  isPaused,
  isTransitioning,
  viewerCount,
  isViewer,
  mediaControls,
  captionsPanel,
  notifications = [],
  onOpenRules,
  onOpenPrivateRoom,
}: DebateMotionStageProps) {
  const stageState = isTransitioning ? 'Transitioning' : isPaused ? 'Paused' : 'In progress';

  return (
    <section className={`debate-motion-stage ${captionsPanel ? 'has-captions' : ''} ${isPaused ? 'is-paused' : ''} ${isTransitioning ? 'is-transitioning' : ''}`}>
      <div className="debate-motion-main">
        <div className="debate-motion-heading-row">
          <span className="debate-panel-eyebrow">Motion announcement</span>
          <div className="debate-motion-utility-actions">
            {mediaControls}
            <button type="button" onClick={onOpenRules} aria-label="Open debate rules" title="Rules">
              <i className="bi bi-book-fill" aria-hidden="true" />
            </button>
            {onOpenPrivateRoom && (
              <button type="button" onClick={onOpenPrivateRoom} aria-label="Open private room" title="Private room">
                <i className="bi bi-door-closed-fill" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <blockquote className="debate-motion-quote">
          <span aria-hidden="true">“</span>
          <p>{motion || 'The motion will appear here when the room is ready.'}</p>
          <span aria-hidden="true">”</span>
        </blockquote>

        {captionsPanel && (
          <div className="debate-motion-caption-panel">
            {captionsPanel}
          </div>
        )}

        <div className="debate-motion-meta">
          <MetaBadge icon="bi-broadcast-pin" tone="cyan">{phaseLabel || 'Waiting'}</MetaBadge>
          <MetaBadge icon="bi-people-fill" tone="purple">{format}</MetaBadge>
          <MetaBadge icon="bi-person-workspace">{hostType === 'human' ? 'Human host' : 'No host'}</MetaBadge>
          <MetaBadge icon="bi-award-fill">{judgeType === 'human' ? 'Human judge' : 'AI judge'}</MetaBadge>
          {isViewer && <MetaBadge icon="bi-eye-fill">Spectator</MetaBadge>}
        </div>

        <div className="debate-motion-speaker">
          <span>Current speaker</span>
          <strong title={`${speakerName} (${speakerCode})`}>{speakerName}</strong>
          <small>{speakerCode}</small>
        </div>

        <section className="debate-motion-session" aria-label="Live session information">
          <div className="debate-motion-session-title">
            <i aria-hidden="true" />
            <span>Live session</span>
          </div>
          <dl>
            <div><dt>Format</dt><dd>{format}</dd></div>
            <div><dt>Host</dt><dd>{hostType === 'human' ? 'Human' : 'No host'}</dd></div>
            <div><dt>Phase</dt><dd title={phaseLabel}>{phaseLabel || 'Waiting'}</dd></div>
          </dl>
        </section>

        <section className="debate-motion-notifications" aria-label="Debate notifications">
          <header>
            <div>
              <i className="bi bi-bell-fill" aria-hidden="true" />
              <span>Notifications</span>
            </div>
            <small>{notifications.length} updates</small>
          </header>
          <div className="debate-motion-notification-list">
            {notifications.length > 0 ? notifications.slice(0, 8).map((notification) => (
              <article className={`tone-${notification.tone}`} key={notification.id}>
                <span className="debate-motion-notification-icon">
                  <i className={`bi ${notification.tone === 'score' ? 'bi-award-fill' : 'bi-info-circle-fill'}`} aria-hidden="true" />
                </span>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.detail}</p>
                </div>
                {notification.meta && <small>{notification.meta}</small>}
              </article>
            )) : (
              <div className="debate-motion-notification-empty">
                Judge scores and system updates will appear here.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="debate-motion-timer-panel">
        <div className="debate-motion-timer-status">
          <span className={isPaused ? 'is-paused' : ''}><i aria-hidden="true" /> {stageState}</span>
          <span><i className="bi bi-eye-fill" aria-hidden="true" /> {viewerCount}</span>
        </div>
        <div className="debate-motion-clock">
          <CountdownTimer
            timeRemaining={timeRemaining}
            totalTime={totalTime}
            isPaused={isPaused}
            size="lg"
          />
        </div>
        <div className="debate-motion-timer-caption">
          <span>Phase timer</span>
          <small>Server synchronized</small>
        </div>
      </div>
    </section>
  );
}
