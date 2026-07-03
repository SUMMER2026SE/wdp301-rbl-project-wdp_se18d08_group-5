import { useEffect, useState } from 'react';
import { useDebateStore } from '@stores/debateStore';

interface TransitionPopupProps {
  /** Override announcement text, e.g. for custom messages */
  overrideAnnouncement?: string;
}

/**
 * Full-screen overlay shown during the 3s mute transition between debate phases.
 * Displays the announcement text (e.g. "Prop S1 gets ready to speak", "End of Round 1")
 * and counts down for `transitionTime` seconds.
 *
 * Also used for the 3s GO! countdown before a phase starts (when turnStatus is idle).
 */
export function TransitionPopup({ overrideAnnouncement }: TransitionPopupProps) {
  const isTransitioning = useDebateStore((s) => s.isTransitioning);
  const transitionTime = useDebateStore((s) => s.transitionTime);
  const transitionAnnouncement = useDebateStore((s) => s.transitionAnnouncement);

  const [displayCount, setDisplayCount] = useState<number | 'GO!'>('GO!');

  const announcement = overrideAnnouncement ?? transitionAnnouncement;

  // Countdown during transition (auto-mute between phases)
  useEffect(() => {
    if (!isTransitioning) return;
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

  if (!isTransitioning) return null;

  const countdown = displayCount;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
      style={{
        zIndex: 9999,
        background: 'rgba(5, 5, 10, 0.95)',
        backdropFilter: 'blur(10px)',
        fontFamily: 'Orbitron, sans-serif',
      }}
    >
      <style>{`
        @keyframes zoomInScale {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(0.8); opacity: 0; }
          15% { transform: translateY(-20px) scale(1); opacity: 1; }
          100% { transform: translateY(-120px) scale(0.9); opacity: 0; }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(0, 245, 255, 0.4); }
          70% { box-shadow: 0 0 0 20px rgba(0, 245, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 245, 255, 0); }
        }
        .animate-zoom-scale {
          animation: zoomInScale 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .animate-float-up {
          animation: floatUp 3s ease-out forwards;
        }
        .animate-pulse-ring {
          animation: pulse-ring 1.5s infinite;
        }
      `}</style>

      {/* Announcement text */}
      {announcement && (
        <div
          key={`announce-${announcement}`}
          className="animate-float-up text-center mb-4 px-4"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: 'clamp(1rem, 3vw, 1.6rem)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'rgba(255, 255, 255, 0.85)',
            textShadow: '0 0 20px rgba(0, 245, 255, 0.3)',
            maxWidth: '90vw',
          }}
        >
          {announcement}
        </div>
      )}

      {/* Countdown or GO! */}
      <div
        key={`count-${countdown ?? 'go'}`}
        className="animate-zoom-scale text-center"
      >
        <div
          className="rounded-circle d-flex align-items-center justify-content-center animate-pulse-ring"
          style={{
            width: 'clamp(140px, 25vw, 200px)',
            height: 'clamp(140px, 25vw, 200px)',
            background: 'rgba(0, 245, 255, 0.1)',
            border: '3px solid rgba(0, 245, 255, 0.5)',
          }}
        >
          <span
            style={{
              fontSize: 'clamp(3rem, 10vw, 6rem)',
              fontWeight: 900,
              color: countdown === 'GO!' ? '#00ff88' : '#00f5ff',
              textShadow:
                countdown === 'GO!'
                  ? '0 0 20px rgba(0, 255, 136, 0.8), 0 0 40px rgba(0, 255, 136, 0.4)'
                  : '0 0 20px rgba(0, 242, 254, 0.8), 0 0 40px rgba(0, 242, 254, 0.4)',
              lineHeight: 1,
            }}
          >
            {countdown ?? 'GO!'}
          </span>
        </div>
      </div>

      {/* Label */}
      <div
        className="mt-4 text-uppercase text-muted"
        style={{
          fontSize: 'clamp(0.6rem, 2vw, 0.85rem)',
          letterSpacing: '0.2em',
        }}
      >
        {isTransitioning ? 'Phase transition' : 'Get ready'}
      </div>

      {/* Mute icon */}
      <div
        className="mt-3 d-flex align-items-center gap-2 text-warning"
        style={{ fontSize: '0.9rem' }}
      >
        <span style={{ fontSize: '1.4rem' }}>🔇</span>
        <span style={{ fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.05em' }}>
          Microphone muted
        </span>
      </div>
    </div>
  );
}
