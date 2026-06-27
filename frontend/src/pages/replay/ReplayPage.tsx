import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Card, Col, Container, ListGroup, ProgressBar, Row, Spinner, Button } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { debateService } from '@services/debateService';
import { useSocket } from '@hooks/useSocket';
import { clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';

export default function ReplayPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    clearDebateRoomFromStorage();
  }, []);

  const replayQuery = useQuery({
    queryKey: ['replay', sessionId],
    queryFn: async () => (await debateService.getReplay(sessionId)).data.data,
    enabled: Boolean(sessionId),
    refetchInterval: 3000, // Poll every 3 seconds as a backup
  });

  // Real-time socket listener to invalidate queries and update immediately
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['replay', sessionId] });
    };

    socket.on('score:updated', handleUpdate);
    socket.on('score:aggregate-updated', handleUpdate);
    socket.on('score:winner-determined', handleUpdate);
    socket.on('debate:ended', handleUpdate);

    return () => {
      socket.off('score:updated', handleUpdate);
      socket.off('score:aggregate-updated', handleUpdate);
      socket.off('score:winner-determined', handleUpdate);
      socket.off('debate:ended', handleUpdate);
    };
  }, [sessionId, queryClient, socket]);

  if (replayQuery.isLoading) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
        <div className="text-center text-white">
          <Spinner animation="border" variant="info" className="mb-3" />
          <div style={{ fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>Loading match results...</div>
        </div>
      </Container>
    );
  }

  if (!replayQuery.data) {
    return (
      <Container className="py-5">
        <Alert variant="warning" className="border-warning bg-dark text-warning p-4 rounded-3">
          <h4 style={{ fontFamily: 'Orbitron' }}>MATCH NOT FOUND</h4>
          <p className="mb-0">The requested debate session results could not be located.</p>
        </Alert>
      </Container>
    );
  }

  const { session } = replayQuery.data;
  const room = replayQuery.data.room as any;
  const proScore = session.finalScores?.teamProposition?.total || 0;
  const oppScore = session.finalScores?.teamOpposition?.total || 0;
  const total = Math.max(proScore + oppScore, 1);

  const winner = session.finalScores?.winner || 'draw';
  const participants = room?.participants || [];
  const verdicts = session.finalScores?.judgeVerdicts || [];

  const proDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'proposition');
  const oppDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'opposition');
  const judges = participants.filter((p: any) => p.roomRole === 'judge');
  const hosts = participants.filter((p: any) => p.roomRole === 'host' || p.roomRole === 'owner');

  const rounds = [
    { name: 'Round 1: Opening Speeches', turns: ['PRO_S1', 'OPP_S1'] },
    { name: 'Round 2: Rebuttal & Extensions', turns: ['PRO_S2', 'OPP_S2'] },
    { name: 'Round 3: Final Summaries', turns: ['PRO_S3', 'OPP_S3'] },
  ];

  return (
    <div style={{ background: '#0a0a0f', color: '#fff', minHeight: '100vh', fontFamily: 'Rajdhani, sans-serif' }} className="py-4">
      <Container>
        {/* Header Block */}
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4 p-4 rounded-4 border border-secondary border-opacity-15 bg-secondary bg-opacity-5">
          <div className="min-width-0">
            <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.15em', fontFamily: 'Orbitron' }}>
              DEBATE ARENA CONCLUDED
            </span>
            <h1 className="m-0 text-white mt-1 text-truncate" style={{ fontFamily: 'Orbitron', fontSize: '1.6rem', fontWeight: 700 }}>
              &ldquo;{room?.motion || 'Motion Selection'}&rdquo;
            </h1>
          </div>
          <div className="text-end">
            <span className="text-muted d-block small mb-1" style={{ fontFamily: 'Orbitron', fontSize: '9px' }}>WINNER</span>
            <Badge
              bg={winner === 'proposition' ? 'info' : winner === 'opposition' ? 'danger' : 'warning'}
              className="fs-6 px-3 py-2 text-uppercase"
              style={{
                fontFamily: 'Orbitron',
                letterSpacing: '0.05em',
                boxShadow: winner === 'proposition' ? '0 0 10px rgba(0, 245, 255, 0.4)' : winner === 'opposition' ? '0 0 10px rgba(255, 0, 110, 0.4)' : '0 0 10px rgba(255, 214, 10, 0.4)',
                color: winner === 'draw' ? '#000' : '#fff'
              }}
            >
              {winner === 'proposition' ? 'Proposition Wins' : winner === 'opposition' ? 'Opposition Wins' : 'Draw Match'}
            </Badge>
          </div>
        </div>

        <Row className="g-4">
          {/* Left Column: Scores & Participants */}
          <Col lg={4} className="d-flex flex-column gap-4">
            
            {/* Scorecard */}
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-bar-chart-fill text-neon-cyan me-2"></i> Final Scoreboard
                </Card.Title>
                
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1 small fw-bold">
                    <span className="text-neon-cyan">PROPOSITION</span>
                    <span className="text-white">{Math.round(proScore)} points</span>
                  </div>
                  <ProgressBar 
                    now={(proScore / total) * 100} 
                    className="bg-dark border border-secondary border-opacity-10" 
                    style={{ height: '12px' }} 
                    variant="info" 
                  />
                </div>

                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1 small fw-bold">
                    <span className="text-neon-pink">OPPOSITION</span>
                    <span className="text-white">{Math.round(oppScore)} points</span>
                  </div>
                  <ProgressBar 
                    now={(oppScore / total) * 100} 
                    className="bg-dark border border-secondary border-opacity-10" 
                    style={{ height: '12px' }} 
                    variant="danger" 
                  />
                </div>

                {session.aiSummary && (
                  <div className="p-3 bg-secondary bg-opacity-10 rounded border border-secondary border-opacity-15 mt-3">
                    <div className="text-neon-yellow text-uppercase fw-bold mb-1.5" style={{ fontSize: '9px', fontFamily: 'Orbitron' }}>AI Summary Verdict</div>
                    <p className="m-0 text-muted small" style={{ lineHeight: 1.4 }}>{session.aiSummary}</p>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Participants list */}
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-people-fill text-neon-cyan me-2"></i> Match Participants
                </Card.Title>

                <ListGroup className="bg-transparent border-0 d-flex flex-column gap-2.5">
                  {/* Hosts */}
                  {hosts.map((h: any) => (
                    <div key={h.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{h.username}</span>
                      <Badge bg="warning" className="text-dark font-monospace text-uppercase" style={{ fontSize: '8px' }}>Host</Badge>
                    </div>
                  ))}

                  {/* Judges */}
                  {judges.map((j: any) => (
                    <div key={j.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{j.username}</span>
                      <Badge bg="secondary" className="font-monospace text-uppercase" style={{ fontSize: '8px', background: '#ffd60a', color: '#000' }}>Judge</Badge>
                    </div>
                  ))}

                  {/* PRO Debaters */}
                  {proDebaters.map((p: any) => (
                    <div key={p.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{p.username}</span>
                      <Badge bg="info" className="font-monospace text-uppercase" style={{ fontSize: '8px' }}>PRO {p.speakerSlot || ''}</Badge>
                    </div>
                  ))}

                  {/* OPP Debaters */}
                  {oppDebaters.map((p: any) => (
                    <div key={p.userId} className="d-flex align-items-center justify-content-between bg-dark bg-opacity-30 border border-secondary border-opacity-10 rounded-3 p-2 px-3">
                      <span className="fw-semibold text-white">{p.username}</span>
                      <Badge bg="danger" className="font-monospace text-uppercase" style={{ fontSize: '8px' }}>OPP {p.speakerSlot || ''}</Badge>
                    </div>
                  ))}

                  {participants.length === 0 && (
                    <div className="text-muted small text-center py-2">No participant records found.</div>
                  )}
                </ListGroup>
              </Card.Body>
            </Card>

            <div className="d-grid mt-2">
              <Button variant="outline-light" onClick={() => navigate('/matches')} className="py-2 fw-semibold" style={{ fontSize: '12px', fontFamily: 'Orbitron' }}>
                <i className="bi bi-chevron-left me-1"></i> Back to Matches
              </Button>
            </div>
          </Col>

          {/* Right Column: Detailed Feedback by Turn */}
          <Col lg={8}>
            <Card className="border-secondary border-opacity-15 rounded-4 bg-secondary bg-opacity-5">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-chat-left-quote-fill text-neon-cyan me-2"></i> Judges Feedback & Score Breakdown
                </Card.Title>

                <div className="d-flex flex-column gap-4">
                  {rounds.map((round) => {
                    return (
                      <div key={round.name} className="p-3 rounded-3 bg-dark bg-opacity-20 border border-secondary border-opacity-10">
                        <h5 className="text-neon-cyan border-bottom border-secondary border-opacity-15 pb-2 mb-3" style={{ fontFamily: 'Orbitron', fontSize: '13px' }}>
                          {round.name}
                        </h5>

                        <div className="d-flex flex-column gap-3">
                          {round.turns.map((turn) => {
                            const turnVerdicts = verdicts.filter((v: any) => v.speaker === turn);
                            const sideLabel = turn.startsWith('PRO_') ? 'PRO' : 'OPP';
                            const sideColorClass = turn.startsWith('PRO_') ? 'text-neon-cyan' : 'text-neon-pink';

                            return (
                              <div key={turn} className="bg-secondary bg-opacity-5 border border-secondary border-opacity-10 rounded p-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <span className={`fw-bold font-monospace text-uppercase ${sideColorClass}`} style={{ fontSize: '11px' }}>
                                    {sideLabel} Speaking Slot ({turn.replace('_', ' ')})
                                  </span>
                                  <Badge bg="secondary" style={{ fontSize: '8px' }}>
                                    {turnVerdicts.length} ratings
                                  </Badge>
                                </div>

                                {turnVerdicts.length === 0 ? (
                                  <p className="text-muted small italic m-0">No judge verdicts or comments submitted yet for this turn.</p>
                                ) : (
                                  <div className="d-flex flex-column gap-2.5 mt-2">
                                    {turnVerdicts.map((v: any, vIdx: number) => {
                                      const sc = v.score || {};
                                      return (
                                        <div key={vIdx} className="bg-black bg-opacity-25 rounded p-2.5 border-start border-warning border-2">
                                          <div className="d-flex justify-content-between align-items-center mb-1.5 flex-wrap gap-1">
                                            <span className="text-white small fw-bold">{v.judgeName || 'Judge'}</span>
                                            <span className="text-muted font-monospace" style={{ fontSize: '9px' }}>
                                              Winner Vote: <strong className="text-white text-uppercase">{v.winner || 'None'}</strong>
                                            </span>
                                          </div>
                                          
                                          {v.notes && (
                                            <p className="text-light small mb-2 italic" style={{ fontSize: '10px', lineHeight: 1.4 }}>
                                              &ldquo;{v.notes}&rdquo;
                                            </p>
                                          )}

                                          <div className="d-flex flex-wrap gap-2 text-muted" style={{ fontSize: '9px' }}>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">Logic: <strong>{sc.logic || 0}</strong></span>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">Rebuttal: <strong>{sc.rebuttal || 0}</strong></span>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">Evidence: <strong>{sc.evidence || 0}</strong></span>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">CE: <strong>{sc.crossExam || 0}</strong></span>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">Strategy: <strong>{sc.strategy || 0}</strong></span>
                                            <span className="bg-secondary bg-opacity-10 px-1.5 py-0.5 rounded text-white">Delivery: <strong>{sc.communication || 0}</strong></span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
