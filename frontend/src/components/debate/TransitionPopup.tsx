import { useEffect, useState } from 'react';
import { useDebateStore } from '@stores/debateStore';
import { useTranslation } from 'react-i18next';

interface TransitionPopupProps {
  /** Override announcement text, e.g. for custom messages */
  overrideAnnouncement?: string;
  countdownSeconds?: number | 'GO!' | null;
  countdownLabel?: string;
  countdownFooter?: string;
}

/**
 * Semi-transparent overlay shown during the 3s mute transition between debate
 * phases, and for the 3s GO! countdown before a phase starts.
 *
 * Uses a unified neon-cyan digit and dark blurred backdrop.
 */
export function TransitionPopup({ overrideAnnouncement, countdownSeconds, countdownLabel, countdownFooter }: TransitionPopupProps) {
  const { t: td } = useTranslation('debate');
  const isTransitioning = useDebateStore((s) => s.isTransitioning);
  const transitionTime = useDebateStore((s) => s.transitionTime);
  const transitionAnnouncement = useDebateStore((s) => s.transitionAnnouncement);

  const [displayCount, setDisplayCount] = useState<number | 'GO!' | null>(null);

  // Countdown during transition (auto-mute between phases)
  useEffect(() => {
    if (!isTransitioning) {
      // Reset display so the next transition starts fresh.
      setDisplayCount(null);
      return;
    }

    setDisplayCount(transitionTime);
    let remaining = transitionTime;

    const interval = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        setDisplayCount('GO!');
        clearInterval(interval);
      } else {
        setDisplayCount(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isTransitioning, transitionTime]);

  const isActiveTransition = isTransitioning && displayCount !== null;
  const isActiveStart = !isTransitioning && countdownSeconds !== null && countdownSeconds !== undefined;

  if (!isActiveTransition && !isActiveStart) return null;

  const currentCount = isActiveTransition ? displayCount : countdownSeconds;
  
  const defaultTransitionLabel = td('debateRoom.phaseTransition', { defaultValue: 'PHASE TRANSITION' });
  const currentLabel = isActiveTransition 
    ? (overrideAnnouncement || transitionAnnouncement || defaultTransitionLabel) 
    : countdownLabel;
    
  const defaultTransitionFooter = td('debateRoom.muteMicAndLockChat', { defaultValue: 'MUTE MIC AND LOCK CHAT' });
  const currentFooter = isActiveTransition
    ? (currentCount === 'GO!' ? 'GO!' : defaultTransitionFooter)
    : (countdownFooter || (currentCount === 'GO!' ? 'GO!' : 'Starting Soon'));

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
      style={{
        zIndex: 9999,
        // Semi-transparent backdrop — let the debate room show through.
        background: 'rgba(10, 10, 18, 0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        fontFamily: 'Orbitron, sans-serif',
      }}
    >
      <style>{`
        @keyframes zoomInScale {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-zoom-scale {
          animation: zoomInScale 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
      `}</style>

      <div className="animate-zoom-scale text-center" key={`count-${currentCount}`}>
        {currentLabel && (
          <p
            className="mb-2 text-uppercase text-secondary"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '12px',
              letterSpacing: '4px',
            }}
          >
            {currentLabel}
          </p>
        )}

        <h1
          className="m-0 text-neon-cyan"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: currentCount === 'GO!' ? '120px' : '150px',
            fontWeight: 900,
            textShadow:
              '0 0 20px rgba(0, 242, 254, 0.8), 0 0 40px rgba(0, 242, 254, 0.4)',
            lineHeight: 1,
          }}
        >
          {currentCount}
        </h1>

        {currentFooter && (
          <p
            className="mt-3 mb-0 text-uppercase text-secondary"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '14px',
              letterSpacing: '3px',
            }}
          >
            {currentFooter}
          </p>
        )}
      </div>
    </div>
  );
}
