import { useTranslation } from 'react-i18next';
import type { DebatePhase } from '@/types';

interface PhaseIndicatorProps {
  phase: DebatePhase | string | null;
  speaker?: string;
}

/**
 * Readable display of the current debate phase. Falls back to a raw
 * phase string if no i18n entry is available.
 */
export function PhaseIndicator({ phase, speaker }: PhaseIndicatorProps) {
  const { t } = useTranslation('common');
  if (!phase) {
    return <span className="text-muted">—</span>;
  }

  const phaseLabel = t(`debate.phases.${phase}`, { defaultValue: phase });

  return (
    <div className="d-flex flex-column">
      <div className="text-uppercase text-muted small">Phase</div>
      <div className="fs-5 fw-semibold text-capitalize">{phaseLabel}</div>
      {speaker ? (
        <div className="text-muted small mt-1">
          <i className="bi bi-person-badge me-1" />
          {speaker}
        </div>
      ) : null}
    </div>
  );
}
