import { useState } from 'react';
import { Button, Card, Form, InputGroup } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';
import { getSocket } from '@hooks/useSocket';
import { CETimer } from './CETimer';
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
  const [answer, setAnswer] = useState('');

  const socket = getSocket();

  if (!ceState || !ceState.activeTeam) {
    return null;
  }

  const me = room?.participants.find((p) => p.userId === user?._id);
  const myTeam: Team | undefined = me?.team || undefined;
  const isActiveTeamDebater = myTeam === ceState.activeTeam && me?.roomRole === 'debater';

  const handleAsk = () => {
    if (!question.trim() || !myTeam || !socket) return;
    socket.emit('cross-exam:question', { roomId, team: myTeam, question: question.trim() });
    setQuestion('');
  };

  const handleAnswer = () => {
    if (!answer.trim() || !myTeam || !socket) return;
    socket.emit('cross-exam:answer', { roomId, team: myTeam, answer: answer.trim() });
    setAnswer('');
  };

  const handlePass = () => {
    if (!socket) return;
    socket.emit('cross-exam:pass-turn', { roomId });
  };

  const handleFinish = () => {
    if (!myTeam || !socket) {
      toast.error('Cannot finish CE from this view');
      return;
    }
    socket.emit('cross-exam:finish', { roomId, team: myTeam });
  };

  return (
    <Card className="mt-3 border-info">
      <Card.Body>
        <Card.Title>
          <i className="bi bi-chat-square-text me-2" />
          Cross Examination
          <span className="text-muted small ms-2">
            Active: <strong className="text-uppercase">{ceState.activeTeam}</strong>
          </span>
        </Card.Title>

        <div className="d-flex gap-3 flex-wrap my-3">
          <CETimer
            team="proposition"
            timeRemaining={ceState.proTimeRemaining ?? 180}
            isActive={ceState.activeTeam === 'proposition'}
            isPaused={Boolean(ceState.isPaused)}
          />
          <CETimer
            team="opposition"
            timeRemaining={ceState.oppTimeRemaining ?? 180}
            isActive={ceState.activeTeam === 'opposition'}
            isPaused={Boolean(ceState.isPaused)}
          />
        </div>

        {isActiveTeamDebater ? (
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
                <Button onClick={handleAsk} disabled={!question.trim()}>
                  Ask
                </Button>
              </InputGroup>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small text-muted mb-1">Answer current question</Form.Label>
              <InputGroup>
                <Form.Control
                  placeholder="Type your answer..."
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAnswer();
                    }
                  }}
                />
                <Button variant="outline-primary" onClick={handleAnswer} disabled={!answer.trim()}>
                  Reply
                </Button>
              </InputGroup>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={handlePass}>
                <i className="bi bi-skip-end me-1" />
                Pass Turn
              </Button>
              <Button variant="outline-warning" onClick={handleFinish}>
                <i className="bi bi-stop-circle me-1" />
                Finish CE
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted small mb-0">
            {t('waitingForActiveTeam', `Waiting for ${ceState.activeTeam} to act...`)}
          </p>
        )}
      </Card.Body>
    </Card>
  );
}
