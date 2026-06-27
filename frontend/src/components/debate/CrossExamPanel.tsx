import { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';
import { getSocket } from '@hooks/useSocket';
import type { Team } from '@/types';

interface CrossExamPanelProps {
  roomId: string;
}

/**
 * Server-authoritative Cross Examination UI. Only the active team's
 * debaters see the input/buttons. Quota is tracked on the server.
 */
export function CrossExamPanel({ roomId }: CrossExamPanelProps) {
  const { t } = useTranslation('common');
  const user = useAuthStore((state) => state.user);
  const ceState = useDebateStore((state) => state.ceState);
  const room = useDebateStore((state) => state.room);
  const [question, setQuestion] = useState('');

  const socket = getSocket();
  const currentPhase = useDebateStore((s) => s.currentPhase);

  // Only show CE panel when in cross_exam phase
  if (currentPhase !== 'cross_exam') {
    return null;
  }

  const me = room?.participants.find((p) => p.userId === user?._id);
  const myTeam: Team | undefined = me?.team || undefined;
  const effectiveRole = me
    ? me.roomRole === 'owner'
      ? me.primaryRole
      : me.roomRole
    : null;
  const isDebater = effectiveRole === 'debater';
  // In the new CE model, both teams can ask questions (shared timer, both mics open)

  const handleAsk = () => {
    if (!question.trim() || !myTeam || !socket) return;
    socket.emit('cross-exam:question', { roomId, team: myTeam, question: question.trim() });
    setQuestion('');
  };

  const handlePass = () => {
    if (!socket) return;
    socket.emit('cross-exam:pass-turn', { roomId });
  };

  const handleFinish = () => {
    if (!socket) {
      toast.error('Cannot finish CE from this view');
      return;
    }
    socket.emit('cross-exam:finish', { roomId });
  };

  // Shared CE timer state
  const sharedRemaining = ceState?.sharedRemaining ?? 0;
  const questionsPro = ceState?.questionsPro ?? 0;
  const questionsOpp = ceState?.questionsOpp ?? 0;
  const quotaPerTeam = ceState?.quotaPerTeam ?? 2;
  const isPausedCE = ceState?.isPaused ?? false;
  const proQuotaLeft = quotaPerTeam - questionsPro;
  const oppQuotaLeft = quotaPerTeam - questionsOpp;

  const safe = Math.max(0, Math.floor(sharedRemaining || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <Card className="mt-3 border-info">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-chat-square-text me-2" />
          Cross Examination
          <span className="text-muted small ms-2">
            Both teams can speak simultaneously
          </span>
        </Card.Title>

        {/* Shared countdown timer */}
        <div className="d-flex align-items-center justify-content-center my-3 p-3 rounded-3" style={{ background: 'rgba(0,245,255,0.05)', border: '1px solid rgba(0,245,255,0.2)' }}>
          <div className="text-center">
            <div
              className="fw-bold"
              style={{
                fontFamily: 'Orbitron, monospace',
                fontSize: '2.5rem',
                color: safe <= 30 ? '#ff006e' : safe <= 60 ? '#ffd60a' : '#00f5ff',
                textShadow: safe <= 30 ? '0 0 10px rgba(255,0,110,0.5)' : '0 0 10px rgba(0,245,255,0.5)',
                lineHeight: 1,
              }}
            >
              {display}
            </div>
            <div className="text-muted small mt-1">Shared CE Timer</div>
            {isPausedCE && <div className="text-warning small mt-1">⏸ Paused</div>}
          </div>
        </div>

        {/* Quota trackers */}
        <div className="d-flex gap-3 mb-3">
          <div className="flex-fill text-center p-2 rounded-3" style={{ background: 'rgba(0,245,255,0.08)', border: '1px solid rgba(0,245,255,0.2)' }}>
            <div className="text-neon-cyan fw-bold" style={{ fontFamily: 'Orbitron', fontSize: '1.1rem' }}>
              {proQuotaLeft}/{quotaPerTeam}
            </div>
            <div className="text-muted small">Prop Questions Left</div>
          </div>
          <div className="flex-fill text-center p-2 rounded-3" style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.2)' }}>
            <div className="text-neon-pink fw-bold" style={{ fontFamily: 'Orbitron', fontSize: '1.1rem' }}>
              {oppQuotaLeft}/{quotaPerTeam}
            </div>
            <div className="text-muted small">Opp Questions Left</div>
          </div>
        </div>

        {/* Both teams can ask questions */}
        {isDebater ? (
          <>
            <Form.Group className="mb-2">
              <Form.Label className="small text-muted mb-1">Ask a question</Form.Label>
              <InputGroup>
                <Form.Control
                  placeholder="Type your question..."
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAsk();
                    }
                  }}
                />
                <Button
                  onClick={handleAsk}
                  disabled={!question.trim() || proQuotaLeft <= 0 && myTeam === 'proposition' || oppQuotaLeft <= 0 && myTeam === 'opposition'}
                >
                  Ask
                </Button>
              </InputGroup>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button
                variant="outline-secondary"
                onClick={handlePass}
                title="Pass turn (uses 1 question quota)"
              >
                <i className="bi bi-skip-end me-1" />
                Pass ({proQuotaLeft}/{quotaPerTeam} or {oppQuotaLeft}/{quotaPerTeam} left)
              </Button>
              <Button variant="outline-warning" onClick={handleFinish}>
                <i className="bi bi-stop-circle me-1" />
                Finish CE
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted small mb-0">
            {t('waitingForActiveTeam', 'Waiting for debaters to act...')}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
