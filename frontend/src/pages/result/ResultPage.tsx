import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Card, Col, Container, ListGroup, ProgressBar, Row, Spinner, Button } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { debateService } from '@services/debateService';
import { useSocket } from '@hooks/useSocket';
import { clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';

const ROUNDS = [
  { num: 1, label: 'Round 1 — Opening Speeches', propSpeaker: 'PRO_S1', oppSpeaker: 'OPP_S1', hasCE: true },
  { num: 2, label: 'Round 2 — Rebuttal & Extensions', propSpeaker: 'PRO_S2', oppSpeaker: 'OPP_S2', hasCE: true },
  { num: 3, label: 'Round 3 — Final Summaries', propSpeaker: 'PRO_S3', oppSpeaker: 'OPP_S3', hasCE: false },
];

export default function ResultPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { t } = useTranslation('result');

  useEffect(() => {
    clearDebateRoomFromStorage();
  }, []);

  const resultQuery = useQuery({
    queryKey: ['result', sessionId],
    queryFn: async () => (await debateService.getReplay(sessionId)).data.data,
    enabled: Boolean(sessionId),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['result', sessionId] });
    socket.on('score:updated', handleUpdate);
    socket.on('score:aggregate-updated', handleUpdate);
    socket.on('score:winner-determined', handleUpdate);
    socket.on('debate:ended', handleUpdate);
    return () => {
      socket.off('score:updated', handleUpdate);
      socket.off('score:aggregate-updated', handleUpdate);
      socket.off('score:winner-determined', handleUpdate);
      socket.off('score:debate:ended', handleUpdate);
    };
  }, [sessionId, queryClient, socket]);

  if (resultQuery.isLoading) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <div className="text-center text-white">
          <Spinner animation="border" variant="info" className="mb-3" />
          <div style={{ fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>{t('loadingMatchResults')}</div>
        </div>
      </Container>
    );
  }

  if (!resultQuery.data) {
    return (
      <Container className="py-5">
        <Alert variant="warning" className="border-warning bg-dark text-warning p-4 rounded-3">
          <h4 style={{ fontFamily: 'Orbitron' }}>{t('matchNotFound')}</h4>
          <p className="mb-0">{t('matchNotFoundDesc')}</p>
        </Alert>
      </Container>
    );
  }

  const { session } = resultQuery.data;
  const room = resultQuery.data.room as any;
  const participants = room?.participants || [];
  const verdicts = session.finalScores?.judgeVerdicts || [];

  // Detect round-based scoring
  const isRoundBased = verdicts.some((v: any) => v.round !== undefined);

  // Get unique judges
  const judgeIds = Array.from(new Set(verdicts.map((v: any) => v.judgeId?.toString()).filter(Boolean)));

  // Per-round per-team averages (round-based only)
  const roundTeamScores = ROUNDS.map(({ num, propSpeaker, oppSpeaker }) => {
    const propVerdicts = verdicts.filter((v: any) => v.speaker === propSpeaker);
    const oppVerdicts = verdicts.filter((v: any) => v.speaker === oppSpeaker);

    const propAvg =
      judgeIds.length > 0
        ? propVerdicts.reduce((sum, v) => sum + ((Number(v.score?.logic) || 0) + (Number(v.score?.crossExam) || 0)), 0) / judgeIds.length
        : 0;
    const oppAvg =
      judgeIds.length > 0
        ? oppVerdicts.reduce((sum, v) => sum + ((Number(v.score?.logic) || 0) + (Number(v.score?.crossExam) || 0)), 0) / judgeIds.length
        : 0;

    return { num, label: ROUNDS[num - 1].label, propAvg, oppAvg, propVerdicts, oppVerdicts };
  });

  const grandPropTotal = roundTeamScores.reduce((s, r) => s + r.propAvg, 0);
  const grandOppTotal = roundTeamScores.reduce((s, r) => s + r.oppAvg, 0);
  const grandTotal = Math.max(grandPropTotal + grandOppTotal, 1);

  const winner =
    session.finalScores?.winner === 'proposition'
      ? 'proposition'
      : session.finalScores?.winner === 'opposition'
        ? 'opposition'
        : 'draw';

  const proDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'proposition');
  const oppDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'opposition');
  const judgeList = participants.filter((p: any) => p.roomRole === 'judge');
  const hosts = participants.filter((p: any) => p.roomRole === 'host' || p.roomRole === 'owner');

  return (
    <div style={{ background: '#0a0a0f', color: '#fff', minHeight: '100vh', fontFamily: 'Rajdhani, sans-serif' }} className="py-4">
      <Container>
        {/* Header */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-4 rounded-4 border border-secondary border-opacity-15 bg-secondary bg-opacity-5">
          <div className="min-width-0">
            <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.15em', fontFamily: 'Orbitron' }}>
              DEBATE ARENA CONCLUDED
            </span>
            <h1 className="m-0 text-white mt-1 text-truncate" style={{ fontFamily: 'Orbitron', fontSize: '1.6rem', fontWeight: 700 }}>
              &ldquo;{room?.motion || t('motionSelection')}&rdquo;
            </h1>
          </div>
          <div className="text-end">
            <span className="text-muted d-block small mb-1" style={{ fontFamily: 'Orbitron', fontSize: '9px' }}>{t('winner')}</span>
            <Badge
              bg={winner === 'proposition' ? 'info' : winner === 'opposition' ? 'danger' : 'warning'}
              className="fs-6 px-3 py-2 text-uppercase"
              style={{
                fontFamily: 'Orbitron',
                letterSpacing: '0.05em',
                boxShadow: winner === 'proposition'
                  ? '0 0 10px rgba(0, 245, 255, 0.4)'
                  : winner === 'opposition'
                    ? '0 0 10px rgba(255, 0, 110, 0.4)'
                    : '0 0 10px rgba(255, 214, 10, 0.4)',
                color: winner === 'draw' ? '#000' : '#fff',
              }}
            >
            {winner === 'proposition' ? t('propositionWins') : winner === 'opposition' ? t('oppositionWins') : t('drawMatch')}
            </Badge>
          </div>
        </div>

        <Row className="g-4">
          {/* Left Column */}
          <Col lg={4} className="d-flex flex-column gap-4">

            {/* Scorecard — per-round breakdown */}
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-bar-chart-fill text-neon-cyan me-2"></i> {t('finalScoreboard')}
                </Card.Title>

                {isRoundBased || verdicts.length > 0 ? (
                  <>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-1 small fw-bold">
                        <span className="text-neon-cyan">{t('proposition')}</span>
                        <span className="text-white">{grandPropTotal.toFixed(1)} {t('points')}</span>
                      </div>
                      <ProgressBar now={(grandPropTotal / grandTotal) * 100} className="bg-dark" style={{ height: '12px' }} variant="info" />
                    </div>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-1 small fw-bold">
                        <span className="text-neon-pink">{t('opposition')}</span>
                        <span className="text-white">{grandOppTotal.toFixed(1)} {t('points')}</span>
                      </div>
                      <ProgressBar now={(grandOppTotal / grandTotal) * 100} className="bg-dark" style={{ height: '12px' }} variant="danger" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-1 small fw-bold">
                        <span className="text-neon-cyan">{t('proposition')}</span>
                        <span className="text-white">— {t('points')}</span>
                      </div>
                      <ProgressBar now={50} className="bg-dark" style={{ height: '12px' }} variant="info" />
                    </div>
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-1 small fw-bold">
                        <span className="text-neon-pink">{t('opposition')}</span>
                        <span className="text-white">— {t('points')}</span>
                      </div>
                      <ProgressBar now={50} className="bg-dark" style={{ height: '12px' }} variant="danger" />
                    </div>
                  </>
                )}

                {session.aiSummary && (
                  <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-15 mt-3">
                    <div className="text-neon-yellow text-uppercase fw-bold mb-1.5" style={{ fontSize: '9px', fontFamily: 'Orbitron' }}>{t('aiSummaryVerdict')}</div>
                    <p className="m-0 text-muted small" style={{ lineHeight: 1.4 }}>{session.aiSummary}</p>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Participants */}
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-people-fill text-neon-cyan me-2"></i> {t('matchParticipants')}
                </Card.Title>
                <ListGroup className="bg-transparent border-0 d-flex flex-column gap-2.5">
                  {hosts.map((h: any) => (
                    <div key={h.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{h.username}</span>
                      <Badge bg="warning" className="text-dark font-monospace text-uppercase" style={{ fontSize: '8px' }}>{t('host')}</Badge>
                    </div>
                  ))}
                  {judgeList.map((j: any) => (
                    <div key={j.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{j.username}</span>
                      <Badge style={{ fontSize: '8px', background: '#ffd60a', color: '#000' }} className="font-monospace text-uppercase">{t('judge')}</Badge>
                    </div>
                  ))}
                  {proDebaters.map((p: any) => (
                    <div key={p.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{p.username}</span>
                      <Badge bg="info" className="font-monospace text-uppercase" style={{ fontSize: '8px' }}>PRO {p.speakerSlot || ''}</Badge>
                    </div>
                  ))}
                  {oppDebaters.map((p: any) => (
                    <div key={p.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{p.username}</span>
                      <Badge bg="danger" className="font-monospace text-uppercase" style={{ fontSize: '8px' }}>OPP {p.speakerSlot || ''}</Badge>
                    </div>
                  ))}
                  {participants.length === 0 && (
                    <div className="text-muted small text-center py-2">{t('noParticipantRecords')}</div>
                  )}
                </ListGroup>
              </Card.Body>
            </Card>

            <div className="d-grid mt-2">
              <Button variant="outline-light" onClick={() => navigate('/matches')} className="py-2 fw-semibold" style={{ fontSize: '12px', fontFamily: 'Orbitron' }}>
                <i className="bi bi-chevron-left me-1"></i> {t('backToMatches')}
              </Button>
            </div>
          </Col>

          {/* Right Column — Judges Feedback per Round */}
          <Col lg={8}>
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-chat-left-quote-fill text-neon-cyan me-2"></i> {t('judgesFeedback')}
                </Card.Title>

                <div className="d-flex flex-column gap-4">
                  {ROUNDS.map((round) => {
                    const propVerdicts = verdicts.filter((v: any) => v.speaker === round.propSpeaker);
                    const oppVerdicts = verdicts.filter((v: any) => v.speaker === round.oppSpeaker);

                    return (
                      <div key={round.num} className="p-3 rounded-3 bg-dark bg-opacity-20 border border-secondary border-opacity-10">
                        <h5 className="text-neon-yellow border-bottom border-secondary border-opacity-15 pb-2 mb-3 text-uppercase" style={{ fontFamily: 'Orbitron', fontSize: '13px', fontWeight: 700 }}>
                          {round.label}
                        </h5>

                        {judgeIds.length === 0 ? (
                          <p className="text-muted small italic m-0">{t('noScoresForRound')}</p>
                        ) : (
                          <div className="d-flex flex-column gap-3">
                            {judgeIds.map((jId) => {
                              const propV = propVerdicts.find((v: any) => v.judgeId?.toString() === jId);
                              const oppV = oppVerdicts.find((v: any) => v.judgeId?.toString() === jId);
                              const judgeName = propV?.judgeName || oppV?.judgeName || 'Judge';
                              const hasProp = Boolean(propV);
                              const hasOpp = Boolean(oppV);

                              if (!hasProp && !hasOpp) return null;

                              return (
                                <div key={jId} className="bg-black bg-opacity-25 rounded p-3 border-start border-warning border-2">
                                  {/* Judge name + round badge */}
                                  <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="text-white fw-bold small">{judgeName}</span>
                                    <Badge bg="secondary" style={{ fontSize: '8px', fontFamily: 'Orbitron' }}>
                                      Round {t('round', { num: round.num })}
                                    </Badge>
                                  </div>

                                  <Row>
                                    {/* Proposition scores */}
                                    <Col md={6} className="mb-2 mb-md-0">
                                      <div className="text-neon-cyan small fw-bold mb-1">{t('proposition')}</div>
                                      {hasProp ? (
                                        (() => {
                                          const pv = propV!;
                                          return (
                                            <div className="small">
                                              <div className="mb-1 text-white-50">
                                                {t('speech')}: <strong className="text-white">{pv.score?.logic ?? 0}</strong>/20
                                                {round.hasCE && (
                                                  <> | {t('ce')}: <strong className="text-white">{pv.score?.crossExam ?? 0}</strong>/20</>
                                                )}
                                                <span className="text-muted ms-2">({((Number(pv.score?.logic) || 0) + (Number(pv.score?.crossExam) || 0)).toFixed(1)}/40)</span>
                                              </div>
                                              {pv.notes && (
                                                <div className="text-light italic" style={{ fontSize: '10px', lineHeight: 1.4 }}>
                                                  &ldquo;{pv.notes}&rdquo;
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <div className="text-muted small">{t('notSubmitted')}</div>
                                      )}
                                    </Col>

                                    {/* Opposition scores */}
                                    <Col md={6}>
                                      <div className="text-neon-pink small fw-bold mb-1">{t('opposition')}</div>
                                      {hasOpp ? (
                                        (() => {
                                          const ov = oppV!;
                                          return (
                                            <div className="small">
                                              <div className="mb-1 text-white-50">
                                                {t('speech')}: <strong className="text-white">{ov.score?.logic ?? 0}</strong>/20
                                                {round.hasCE && (
                                                  <> | {t('ce')}: <strong className="text-white">{ov.score?.crossExam ?? 0}</strong>/20</>
                                                )}
                                                <span className="text-muted ms-2">({((Number(ov.score?.logic) || 0) + (Number(ov.score?.crossExam) || 0)).toFixed(1)}/40)</span>
                                              </div>
                                              {ov.notes && (
                                                <div className="text-light italic" style={{ fontSize: '10px', lineHeight: 1.4 }}>
                                                  &ldquo;{ov.notes}&rdquo;
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <div className="text-muted small">{t('notSubmitted')}</div>
                                      )}
                                    </Col>
                                  </Row>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
