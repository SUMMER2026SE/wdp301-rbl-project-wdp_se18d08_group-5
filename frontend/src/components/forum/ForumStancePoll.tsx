interface ForumStancePollProps {
  agreeCount: number;
  disagreeCount: number;
  userStance: 'agree' | 'disagree' | null;
}

export function ForumStancePoll({ agreeCount, disagreeCount, userStance }: ForumStancePollProps) {
  const total = agreeCount + disagreeCount;
  const agreePct = total > 0 ? Math.round((agreeCount / total) * 100) : 50;
  const disagreePct = total > 0 ? 100 - agreePct : 50;

  return (
    <div className="stance-poll-widget">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h4 className="h6 text-uppercase letter-spacing-1 text-muted mb-0">Community Stance</h4>
        <span className="badge bg-dark border border-secondary text-secondary">
          {total} {total === 1 ? 'vote' : 'votes'} total
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-baseline mb-2">
        <div>
          <span className="stance-percentage-label agree">{agreePct}%</span>
          <span className="small text-muted ms-2">({agreeCount} agree)</span>
        </div>
        <div className="text-end">
          <span className="small text-muted me-2">({disagreeCount} disagree)</span>
          <span className="stance-percentage-label disagree">{disagreePct}%</span>
        </div>
      </div>

      <div className="ratio-poll-bar" style={{ height: '10px' }}>
        <div
          className="ratio-fill-agree"
          style={{
            width: `${agreePct}%`,
            boxShadow: userStance === 'agree' ? '0 0 12px var(--color-proposition)' : 'none',
          }}
        />
        <div
          className="ratio-fill-disagree"
          style={{
            width: `${disagreePct}%`,
            boxShadow: userStance === 'disagree' ? '0 0 12px var(--color-opposition)' : 'none',
          }}
        />
      </div>

      {userStance && (
        <p className="text-center small text-muted mt-2 mb-0">
          <i className="bi bi-info-circle me-1" />
          You voted{' '}
          <strong className={userStance === 'agree' ? 'text-proposition' : 'text-opposition'}>
            {userStance === 'agree' ? 'Agree' : 'Disagree'}
          </strong>
          . You can change your stance below.
        </p>
      )}
    </div>
  );
}
