import { useDebateStore } from '@stores/debateStore';

interface AIFeedbackPopupProps {
  /** Called when the user dismisses the popup */
  onDismiss?: () => void;
}

/**
 * Displays AI-generated feedback during judge feedback phases.
 * Shown as an overlay card when `aiFeedback` is set in the store.
 */
export function AIFeedbackPopup({ onDismiss }: AIFeedbackPopupProps) {
  const aiFeedback = useDebateStore((s) => s.aiFeedback);

  if (!aiFeedback) return null;

  const { speaker, feedback } = aiFeedback;
  const score = feedback?.score || {};

  return (
    <div
      className="position-fixed bottom-0 start-0 w-100 p-3"
      style={{ zIndex: 9000 }}
    >
      <div
        className="rounded-4 mx-auto"
        style={{
          maxWidth: '600px',
          background: 'rgba(10, 10, 30, 0.95)',
          border: '1px solid rgba(0, 245, 255, 0.3)',
          backdropFilter: 'blur(10px)',
          fontFamily: 'Rajdhani, sans-serif',
        }}
      >
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .ai-feedback-animate {
            animation: slideUp 0.4s ease-out both;
          }
        `}</style>

        <div className="ai-feedback-animate p-3">
          {/* Header */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <span
                style={{
                  fontSize: '0.8rem',
                  letterSpacing: '0.15em',
                  color: 'rgba(0, 245, 255, 0.8)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                AI Judge Feedback — {speaker}
              </span>
            </div>
            {onDismiss && (
              <button
                className="btn-close btn-close-white"
                style={{ opacity: 0.5 }}
                onClick={onDismiss}
              />
            )}
          </div>

          {/* Score breakdown */}
          {score && Object.keys(score).length > 0 && (
            <div className="mb-3">
              <div
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  marginBottom: '0.5rem',
                }}
              >
                Score breakdown
              </div>
              <div className="d-flex flex-wrap gap-2">
                {Object.entries(score).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-3 px-3 py-1"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'rgba(255,255,255,0.5)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                      }}
                    >
                      {key}
                    </div>
                    <div
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        color: '#00f5ff',
                      }}
                    >
                      {typeof value === 'number' ? value : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {feedback?.summary && (
            <div
              style={{
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.6,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '0.75rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase',
                  marginBottom: '0.3rem',
                }}
              >
                Summary
              </div>
              {feedback.summary}
            </div>
          )}

          {/* Strengths */}
          {feedback?.strengths && feedback.strengths.length > 0 && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'rgba(0, 255, 136, 0.8)',
                marginTop: '0.5rem',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '0.5rem',
              }}
            >
              <span style={{ marginRight: '0.3rem' }}>👍</span>
              {feedback.strengths.slice(0, 2).join(' • ')}
            </div>
          )}

          {/* Weaknesses */}
          {feedback?.weaknesses && feedback.weaknesses.length > 0 && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 68, 102, 0.8)',
                marginTop: '0.25rem',
              }}
            >
              <span style={{ marginRight: '0.3rem' }}>👎</span>
              {feedback.weaknesses.slice(0, 2).join(' • ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
