import { useEffect, useState } from 'react';
import { useDebateStore } from '@stores/debateStore';

interface TransitionPopupProps {
  /** Override announcement text, e.g. for custom messages */
  overrideAnnouncement?: string;
}

/**
 * Semi-transparent overlay shown during the 3s mute transition between debate
 * phases. Displays the announcement text (e.g. "Prop S1 gets ready to speak",
 * "End of Round 1") and counts down for `transitionTime` seconds.
 *
 * Also used for the 3s GO! countdown before a phase starts (when turnStatus
 * is idle).
 *
 * Visual style is intentionally aligned with the Start Phase countdown overlay
 * (`startPhaseMutation` block at the bottom of DebateRoomPage): same Orbitron
 * font, same neon-cyan digit, same semi-transparent dark backdrop. Users see
 * the underlying debate room structure during the 3s countdown so it doesn't
 * read as a "black screen".
 */
export function TransitionPopup({ overrideAnnouncement }: TransitionPopupProps) {
  const isTransitioning = useDebateStore((s) => s.isTransitioning);
  const transitionTime = useDebateStore((s) => s.transitionTime);
  const transitionAnnouncement = useDebateStore((s) => s.transitionAnnouncement);

  const [displayCount, setDisplayCount] = useState<number | 'GO!' | null>(null);

  const announcement = overrideAnnouncement ?? transitionAnnouncement;

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

  if (!isTransitioning || displayCount === null) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
      style={{
        zIndex: 9999,
        // Semi-transparent backdrop — let the debate room show through.
        // Matches the Start Phase countdown overlay in DebateRoomPage so the
        // two popups feel like the same UI element.
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

      <div className="animate-zoom-scale text-center" key={`count-${displayCount}`}>
        {/* Optional announcement above the digit (e.g. "End of Round 1") */}
        {announcement && (
          <p
            className="mb-2 text-uppercase text-secondary"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: '12px',
              letterSpacing: '4px',
            }}
          >
            {announcement}
          </p>
        )}

        {/* Countdown digit or GO! */}
        <h1
          className="m-0 text-neon-cyan"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: displayCount === 'GO!' ? '120px' : '150px',
            fontWeight: 900,
            textShadow:
              '0 0 20px rgba(0, 242, 254, 0.8), 0 0 40px rgba(0, 242, 254, 0.4)',
            lineHeight: 1,
          }}
        >
          {displayCount}
        </h1>

        {/* Footer label — matches the Start Phase overlay exactly. */}
        <p
          className="mt-3 mb-0 text-uppercase text-secondary"
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: '14px',
            letterSpacing: '3px',
          }}
        >
          {displayCount === 'GO!' ? 'GO!' : 'Starting Soon'}
        </p>
      </div>
    </div>
  );
}
