import type { ReactNode } from 'react';
import type { DebateWorkflowViewStep } from './types';

interface DebateRoomHeaderProps {
  roomTitle: string;
  roomCode: string;
  phaseLabel: string;
  status: string;
  workflowSteps: DebateWorkflowViewStep[];
  currentWorkflowIndex: number;
  actions?: ReactNode;
}

function getVisibleWorkflow(steps: DebateWorkflowViewStep[], currentIndex: number) {
  if (steps.length <= 5) return steps.map((step, index) => ({ step, index }));
  const safeIndex = Math.max(0, currentIndex);
  const start = Math.min(Math.max(0, safeIndex - 1), steps.length - 5);
  return steps.slice(start, start + 5).map((step, offset) => ({ step, index: start + offset }));
}

function workflowState(index: number, currentIndex: number) {
  if (index < currentIndex) return 'completed';
  if (index === currentIndex) return 'active';
  if (index === currentIndex + 1) return 'next';
  return 'pending';
}

export function DebateRoomHeader({
  roomTitle,
  roomCode,
  phaseLabel,
  status,
  workflowSteps,
  currentWorkflowIndex,
  actions,
}: DebateRoomHeaderProps) {
  const isLive = status === 'active' || status === 'paused';
  const visibleWorkflow = getVisibleWorkflow(workflowSteps, currentWorkflowIndex);

  return (
    <header className="debate-dashboard-header">
      <div className="debate-dashboard-header-brand">
        <span className="debate-dashboard-logo" aria-hidden="true">
          <i className="bi bi-chat-square-quote-fill" />
        </span>
        <div className="debate-dashboard-room-identity">
          <div className="debate-dashboard-room-name" title={roomTitle}>
            <span>Debate room:</span> {roomTitle || 'Custom Room'}
          </div>
          <div className="debate-dashboard-room-meta">
            <span>Room #{roomCode}</span>
            <span className={`debate-dashboard-connection ${isLive ? 'is-live' : ''}`}>
              <i aria-hidden="true" /> {phaseLabel || status}
            </span>
          </div>
        </div>
      </div>

      <section className="debate-header-workflow" aria-label="Debate workflow">
        <div className="debate-header-workflow-title">
          <span>Workflow</span>
          <small>{currentWorkflowIndex >= 0 ? currentWorkflowIndex + 1 : 0}/{workflowSteps.length}</small>
        </div>
        <div className="debate-header-workflow-track">
          {visibleWorkflow.map(({ step, index }) => {
            const state = workflowState(index, currentWorkflowIndex);
            return (
              <div
                key={`${step.speaker}-${step.phase}-${index}`}
                className={`debate-header-workflow-step is-${state}`}
                aria-current={state === 'active' ? 'step' : undefined}
                title={`${step.label}: ${step.detail}`}
              >
                <span>{state === 'completed' ? <i className="bi bi-check-lg" aria-hidden="true" /> : index + 1}</span>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="debate-header-match-actions" aria-label="Match actions">
        {actions}
      </section>
    </header>
  );
}
