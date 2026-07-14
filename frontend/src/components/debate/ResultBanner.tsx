import { useEffect, useState } from 'react';
import { Button as RBButton } from 'react-bootstrap';
const Button = RBButton as any;
import { useDebateStore } from '@stores/debateStore';
import { useNavigate } from 'react-router-dom';

interface ResultBannerProps {
  roomId: string;
  finalScores?: {
    teamProposition: { total: number };
    teamOpposition: { total: number };
    winner?: string | null;
    winnerTeam?: string | null;
  } | null;
  aiSummary?: string | null;
  onViewResult?: () => void;
}

export function ResultBanner({ roomId, finalScores, aiSummary, onViewResult }: ResultBannerProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);
  const aiFinalVerdict = useDebateStore((s) => s.aiFinalVerdict);
  const verdict = aiFinalVerdict ?? finalScores?.winnerTeam ?? finalScores?.winner;

  // Auto redirect after 10 seconds (per the rule docs).
  // useEffect must always be called, even when we render nothing below.
  useEffect(() => {
    if (!verdict) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          navigate(`/result/${roomId}`);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [verdict, roomId, navigate]);

  if (!verdict) return null;

  const propScore = finalScores?.teamProposition?.total ?? 0;
  const oppScore = finalScores?.teamOpposition?.total ?? 0;

  const getWinnerLabel = () => {
    if (verdict === 'proposition' || verdict === 'pro') return 'PROPOSITION';
    if (verdict === 'opposition' || verdict === 'opp') return 'OPPOSITION';
    return 'DRAW';
  };

  const getWinnerColor = () => {
    if (verdict === 'proposition' || verdict === 'pro') return '#00ff88';
    if (verdict === 'opposition' || verdict === 'opp') return '#ff4466';
    return '#ffcc00';
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
      style={{
        zIndex: 9999,
        background: 'rgba(5, 5, 10, 0.97)',
        backdropFilter: 'blur(12px)',
        fontFamily: 'Rajdhani, sans-serif',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.3); }
          50% { box-shadow: 0 0 40px rgba(0, 255, 136, 0.6); }
        }
        .animate-slide-in {
          animation: slideIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        .winner-glow {
          animation: glow-pulse 2s infinite;
        }
      `}</style>

      {/* Title */}
      <div className="animate-slide-in text-center mb-4">
        <div
          style={{
            fontSize: 'clamp(0.8rem, 2vw, 1rem)',
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
          }}
        >
          Match result
        </div>
      </div>

      {/* Score cards */}
      <div className="d-flex gap-4 flex-wrap justify-content-center align-items-center mb-4 animate-slide-in">
        {/* Proposition */}
        <div
          className="d-flex flex-column align-items-center justify-content-center rounded-4 p-4"
          style={{
            width: 'clamp(120px, 25vw, 160px)',
            height: 'clamp(140px, 28vw, 180px)',
            background:
              verdict === 'proposition' || verdict === 'pro'
                ? 'rgba(0, 255, 136, 0.15)'
                : 'rgba(255,255,255,0.05)',
            border:
              verdict === 'proposition' || verdict === 'pro'
                ? '2px solid rgba(0, 255, 136, 0.5)'
                : '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(0.6rem, 2vw, 0.75rem)',
              letterSpacing: '0.2em',
              color: 'rgba(0, 255, 136, 0.7)',
              textTransform: 'uppercase',
            }}
          >
            Proposition
          </div>
          <div
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
              fontWeight: 900,
              color: propScore >= oppScore ? '#00ff88' : 'rgba(255,255,255,0.3)',
              textShadow:
                propScore >= oppScore
                  ? '0 0 20px rgba(0, 255, 136, 0.5)'
                  : 'none',
            }}
          >
            {propScore.toFixed(1)}
          </div>
        </div>

        {/* VS divider */}
        <div
          style={{
            fontSize: 'clamp(1rem, 3vw, 1.5rem)',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.1em',
          }}
        >
          VS
        </div>

        {/* Opposition */}
        <div
          className="d-flex flex-column align-items-center justify-content-center rounded-4 p-4"
          style={{
            width: 'clamp(120px, 25vw, 160px)',
            height: 'clamp(140px, 28vw, 180px)',
            background:
              verdict === 'opposition' || verdict === 'opp'
                ? 'rgba(255, 68, 102, 0.15)'
                : 'rgba(255,255,255,0.05)',
            border:
              verdict === 'opposition' || verdict === 'opp'
                ? '2px solid rgba(255, 68, 102, 0.5)'
                : '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(0.6rem, 2vw, 0.75rem)',
              letterSpacing: '0.2em',
              color: 'rgba(255, 68, 102, 0.7)',
              textTransform: 'uppercase',
            }}
          >
            Opposition
          </div>
          <div
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
              fontWeight: 900,
              color: oppScore >= propScore ? '#ff4466' : 'rgba(255,255,255,0.3)',
              textShadow:
                oppScore >= propScore
                  ? '0 0 20px rgba(255, 68, 102, 0.5)'
                  : 'none',
            }}
          >
            {oppScore.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Winner announcement */}
      {(verdict === 'proposition' || verdict === 'pro' || verdict === 'opposition' || verdict === 'opp') && (
        <div
          className="winner-glow rounded-3 px-5 py-2 mb-4 animate-slide-in text-center"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: `2px solid ${getWinnerColor()}40`,
          }}
        >
          <div
            style={{
              fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
            }}
          >
            Winner
          </div>
          <div
            style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              fontWeight: 900,
              color: getWinnerColor(),
              textShadow: `0 0 20px ${getWinnerColor()}60`,
              letterSpacing: '0.1em',
            }}
          >
            {getWinnerLabel()}
          </div>
        </div>
      )}

      {verdict === 'draw' && (
        <div
          className="winner-glow rounded-3 px-5 py-2 mb-4 animate-slide-in text-center"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '2px solid rgba(255, 204, 0, 0.4)',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              fontWeight: 900,
              color: '#ffcc00',
              textShadow: '0 0 20px rgba(255, 204, 0, 0.4)',
              letterSpacing: '0.1em',
            }}
          >
            HOA
          </div>
        </div>
      )}

      {/* AI Summary */}
      {aiSummary && (
        <div
          className="animate-slide-in text-center mb-4 px-4"
          style={{
            maxWidth: '500px',
            fontSize: 'clamp(0.75rem, 2.5vw, 0.9rem)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.6,
          }}
        >
          <div
            style={{
              fontSize: 'clamp(0.6rem, 1.5vw, 0.7rem)',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            AI Judge Summary
          </div>
          {aiSummary}
        </div>
      )}

      {/* Buttons */}
      <div className="d-flex gap-3 animate-slide-in">
        <Button
          variant="primary"
          className="fw-bold px-4 py-2"
          style={{
            background: 'rgba(0, 245, 255, 0.15)',
            border: '2px solid rgba(0, 245, 255, 0.5)',
            color: '#00f5ff',
            fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
            letterSpacing: '0.05em',
          }}
          onClick={() => {
            if (onViewResult) onViewResult();
            else navigate(`/result/${roomId}`);
          }}
        >
          View details
        </Button>
        <Button
          variant="outline-light"
          className="fw-bold px-4 py-2"
          style={{
            fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
            letterSpacing: '0.05em',
            opacity: 0.7,
          }}
          onClick={() => navigate('/matches')}
        >
          Back ({countdown}s)
        </Button>
      </div>
    </div>
  );
}
