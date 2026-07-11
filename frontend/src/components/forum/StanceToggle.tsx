import { Spinner } from 'react-bootstrap';

interface StanceToggleProps {
  userStance: 'agree' | 'disagree' | null;
  onSelectStance: (stance: 'agree' | 'disagree') => void;
  isPending: boolean;
}

export function StanceToggle({ userStance, onSelectStance, isPending }: StanceToggleProps) {
  return (
    <div className="stance-selection-card">
      <div className="text-center mb-3">
        <h3 className="h5 text-white mb-1">Pick Your Battlefield Side</h3>
        <p className="small text-muted mb-0">
          You must choose a stance before publishing arguments. You can change sides at any time.
        </p>
      </div>

      <div className="d-flex gap-3 flex-column flex-sm-row">
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSelectStance('agree')}
          className={`stance-option-btn agree ${userStance === 'agree' ? 'selected' : ''}`}
        >
          {isPending && userStance === 'agree' ? (
            <Spinner animation="border" size="sm" variant="info" />
          ) : (
            <>
              <i className="bi bi-hand-thumbs-up-fill fs-3" />
              <span>Agree side</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => onSelectStance('disagree')}
          className={`stance-option-btn disagree ${userStance === 'disagree' ? 'selected' : ''}`}
        >
          {isPending && userStance === 'disagree' ? (
            <Spinner animation="border" size="sm" variant="danger" />
          ) : (
            <>
              <i className="bi bi-hand-thumbs-down-fill fs-3" />
              <span>Disagree side</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
