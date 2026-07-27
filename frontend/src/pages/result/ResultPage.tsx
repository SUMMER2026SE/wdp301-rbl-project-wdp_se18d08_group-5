import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Card, Col, Container, ListGroup, ProgressBar, Row, Spinner, Button as RBButton } from 'react-bootstrap';
const Button = RBButton as any;
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { debateService } from '@services/debateService';
import { useSocket } from '@hooks/useSocket';
import { clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';
import type { AIDebateFinalAnalysis, Team } from '@/types';

// Import CSS
import '../../styles/result.css';

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

  const replayRoom = resultQuery.data?.room as { status?: string } | undefined;
  const replayAnalysis = resultQuery.data?.session.aiDebateAnalysis;
  const finalAnalysisQuery = useQuery({
    queryKey: ['final-analysis', sessionId],
    queryFn: async () => (await debateService.generateFinalAnalysis(sessionId)).data.data,
    enabled: Boolean(
      sessionId
      && replayRoom?.status === 'completed'
      && replayAnalysis?.status !== 'completed',
    ),
    retry: 1,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (!finalAnalysisQuery.data) return;
    void queryClient.invalidateQueries({ queryKey: ['result', sessionId] });
  }, [finalAnalysisQuery.data, queryClient, sessionId]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ['result', sessionId] });
    socket.on('score:updated', handleUpdate);
    socket.on('score:aggregate-updated', handleUpdate);
    socket.on('score:winner-determined', handleUpdate);
    socket.on('debate:ended', handleUpdate);
    socket.on('debate:final-analysis-ready', handleUpdate);
    return () => {
      socket.off('score:updated', handleUpdate);
      socket.off('score:aggregate-updated', handleUpdate);
      socket.off('score:winner-determined', handleUpdate);
      socket.off('debate:ended', handleUpdate);
      socket.off('debate:final-analysis-ready', handleUpdate);
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
  const finalAnalysis = finalAnalysisQuery.data?.analysis || session.aiDebateAnalysis || null;

  // Detect round-based scoring
  const isRoundBased = verdicts.some((v: any) => v.round !== undefined);

  // Get unique judges
  const verdictJudgeKey = (verdict: any) => verdict.judgeId?.toString() || (verdict.source === 'ai' ? 'ai' : null);
  const judgeIds = Array.from(new Set(verdicts.map(verdictJudgeKey).filter(Boolean)));

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
        : session.finalScores?.winner === 'draw'
          ? 'draw'
          : null;
  const isAIJudgeResultPending = room?.judgeType === 'ai' && winner === null;

  const proDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'proposition');
  const oppDebaters = participants.filter((p: any) => p.roomRole === 'debater' && p.team === 'opposition');
  const judgeList = participants.filter((p: any) => p.roomRole === 'judge');
  const hosts = participants.filter((p: any) => p.roomRole === 'host' || p.roomRole === 'owner');

  return (
    <div style={{ background: '#0a0a0f', color: '#fff', minHeight: '100vh', fontFamily: 'Rajdhani, sans-serif' }} className="py-4">
      <Container className="result-page-container">
        {/* Header */}
        <div className="result-header-panel d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
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
              bg={winner === 'proposition' ? 'info' : winner === 'opposition' ? 'danger' : winner === 'draw' ? 'warning' : 'secondary'}
              className="fs-6 px-3 py-2 text-uppercase"
              style={{
                fontFamily: 'Orbitron',
                letterSpacing: '0.05em',
                boxShadow: winner === 'proposition'
                  ? '0 0 10px rgba(0, 245, 255, 0.4)'
                  : winner === 'opposition'
                    ? '0 0 10px rgba(255, 0, 110, 0.4)'
                    : winner === 'draw'
                      ? '0 0 10px rgba(255, 214, 10, 0.4)'
                      : '0 0 10px rgba(108, 117, 125, 0.4)',
                color: winner === 'draw' ? '#000' : '#fff',
              }}
            >
            {winner === 'proposition'
              ? t('propositionWins')
              : winner === 'opposition'
                ? t('oppositionWins')
                : winner === 'draw'
                  ? t('drawMatch')
                  : t('resultPending')}
            </Badge>
          </div>
        </div>

        {isAIJudgeResultPending && (
          <Alert variant="warning" className="d-flex align-items-center gap-2 mb-4">
            <Spinner animation="border" size="sm" />
            <span>{t('aiJudgeResultPending')}</span>
          </Alert>
        )}

        <Row className="g-4">
          {/* Left Column */}
          <Col lg={4} className="d-flex flex-column gap-4">

            {/* Scorecard — per-round breakdown */}
            <Card className="result-premium-card">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-bar-chart-fill text-neon-cyan me-2"></i> {t('finalScoreboard')}
                </Card.Title>

                {isRoundBased || verdicts.length > 0 ? (
                  <>
                    <div className="result-progress-wrapper">
                      <div className="result-progress-label">
                        <span className="text-neon-cyan">{t('proposition')}</span>
                        <span className="text-white">{grandPropTotal.toFixed(1)} {t('points')}</span>
                      </div>
                      <ProgressBar now={(grandPropTotal / grandTotal) * 100} className="bg-dark result-progress-bar-cyan" style={{ height: '12px' }} />
                    </div>
                    <div className="result-progress-wrapper">
                      <div className="result-progress-label">
                        <span className="text-neon-pink">{t('opposition')}</span>
                        <span className="text-white">{grandOppTotal.toFixed(1)} {t('points')}</span>
                      </div>
                      <ProgressBar now={(grandOppTotal / grandTotal) * 100} className="bg-dark result-progress-bar-pink" style={{ height: '12px' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="result-progress-wrapper">
                      <div className="result-progress-label">
                        <span className="text-neon-cyan">{t('proposition')}</span>
                        <span className="text-white">— {t('points')}</span>
                      </div>
                      <ProgressBar now={50} className="bg-dark result-progress-bar-cyan" style={{ height: '12px' }} />
                    </div>
                    <div className="result-progress-wrapper">
                      <div className="result-progress-label">
                        <span className="text-neon-pink">{t('opposition')}</span>
                        <span className="text-white">— {t('points')}</span>
                      </div>
                      <ProgressBar now={50} className="bg-dark result-progress-bar-pink" style={{ height: '12px' }} />
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
            <Card className="result-premium-card">
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
            <Card className="result-premium-card">
              <Card.Body className="p-4">
                <Card.Title className="text-uppercase font-monospace mb-4 text-muted" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
                  <i className="bi bi-chat-left-quote-fill text-neon-cyan me-2"></i> {t('judgesFeedback')}
                </Card.Title>

                <div className="d-flex flex-column gap-4">
                  {ROUNDS.map((round) => {
                    const propVerdicts = verdicts.filter((v: any) => v.speaker === round.propSpeaker);
                    const oppVerdicts = verdicts.filter((v: any) => v.speaker === round.oppSpeaker);

                    return (
                      <div key={round.num} className="round-feedback-card">
                        <h5 className="text-neon-yellow border-bottom border-secondary border-opacity-15 pb-2 mb-3 text-uppercase" style={{ fontFamily: 'Orbitron', fontSize: '13px', fontWeight: 700 }}>
                          {round.label}
                        </h5>

                        {judgeIds.length === 0 ? (
                          <p className="text-muted small italic m-0">{t('noScoresForRound')}</p>
                        ) : (
                          <div className="d-flex flex-column gap-3">
                            {judgeIds.map((jId) => {
                              const propV = propVerdicts.find((v: any) => verdictJudgeKey(v) === jId);
                              const oppV = oppVerdicts.find((v: any) => verdictJudgeKey(v) === jId);
                              const judgeName = propV?.judgeName || oppV?.judgeName || 'Judge';
                              const hasProp = Boolean(propV);
                              const hasOpp = Boolean(oppV);

                              if (!hasProp && !hasOpp) return null;

                              const propScore = (Number(propV?.score?.logic) || 0) + (Number(propV?.score?.crossExam) || 0);
                              const oppScore = (Number(oppV?.score?.logic) || 0) + (Number(oppV?.score?.crossExam) || 0);
                              const accentClass = propScore > oppScore ? 'prop-accent' : propScore < oppScore ? 'opp-accent' : 'draw-accent';

                              return (
                                <div key={jId} className={`judge-verdict-node ${accentClass}`}>
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
        <FinalAnalysisPanel
          analysis={finalAnalysis}
          isLoading={finalAnalysisQuery.isLoading || finalAnalysis?.status === 'processing'}
          error={finalAnalysisQuery.isError ? finalAnalysisQuery.error : null}
          onRetry={() => void finalAnalysisQuery.refetch()}
        />
      </Container>
    </div>
  );
}

function AnalysisList({ items }: { items?: string[] }) {
  if (!items?.length) return <span className="text-muted small">No notable items.</span>;
  return (
    <ul className="result-analysis-list">
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ul>
  );
}

function TeamAnalysis({
  team,
  analysis,
}: {
  team: Team;
  analysis: NonNullable<AIDebateFinalAnalysis['teams']>[Team];
}) {
  const { t } = useTranslation('result');
  return (
    <section className={`result-analysis-team team-${team}`}>
      <header>
        <strong>{team === 'proposition' ? t('proposition') : t('opposition')}</strong>
        <span>{analysis.score}/100</span>
      </header>
      <h6>{t('aiKeyArguments')}</h6>
      <AnalysisList items={analysis.keyArguments} />
      <div className="result-analysis-team-columns">
        <div><h6>{t('aiStrengths')}</h6><AnalysisList items={analysis.strengths} /></div>
        <div><h6>{t('aiWeaknesses')}</h6><AnalysisList items={analysis.weaknesses} /></div>
      </div>
    </section>
  );
}

function FinalAnalysisPanel({
  analysis,
  isLoading,
  error,
  onRetry,
}: {
  analysis: AIDebateFinalAnalysis | null;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const { t } = useTranslation('result');

  return (
    <Card className="result-premium-card result-ai-analysis mt-4">
      <Card.Body className="p-4">
        <div className="result-analysis-header">
          <div>
            <span>{t('aiDetailedAnalysis')}</span>
            <h2>{t('aiDebateReview')}</h2>
          </div>
          {analysis?.judgeMode && (
            <Badge bg={analysis.affectsOfficialResult ? 'info' : 'secondary'}>
              {analysis.affectsOfficialResult ? t('officialAiJudge') : t('advisoryAiAnalysis')}
            </Badge>
          )}
        </div>

        {isLoading && !analysis?.summary && (
          <div className="result-analysis-loading">
            <Spinner animation="border" variant="info" size="sm" />
            <span>{t('aiAnalysisProcessing')}</span>
          </div>
        )}

        {Boolean(error) && analysis?.status !== 'completed' && (
          <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{t('aiAnalysisFailed')}</span>
            <Button size="sm" variant="outline-warning" onClick={onRetry}>{t('retryAnalysis')}</Button>
          </Alert>
        )}

        {analysis?.status === 'completed' && (
          <>
            {!analysis.affectsOfficialResult && (
              <Alert variant="info" className="result-analysis-policy">
                {t('humanJudgePolicy')}
              </Alert>
            )}

            <div className="result-analysis-summary">
              <p>{analysis.summary}</p>
              {analysis.winnerReason && <small>{analysis.winnerReason}</small>}
            </div>

            {analysis.transcriptQuality && (
              <section className="result-transcript-quality">
                <div>
                  <strong>{t('transcriptConfidence')}</strong>
                  <span>{Math.round(analysis.transcriptQuality.overallConfidence * 100)}%</span>
                </div>
                <ProgressBar now={analysis.transcriptQuality.overallConfidence * 100} />
                {analysis.transcriptQuality.notes && <p>{analysis.transcriptQuality.notes}</p>}
                <AnalysisList items={analysis.transcriptQuality.issues} />
              </section>
            )}

            {analysis.keyClashes && analysis.keyClashes.length > 0 && (
              <section className="result-analysis-clashes">
                <h3>{t('keyClashes')}</h3>
                <AnalysisList items={analysis.keyClashes} />
              </section>
            )}

            {analysis.teams && (
              <div className="result-analysis-teams">
                <TeamAnalysis team="proposition" analysis={analysis.teams.proposition} />
                <TeamAnalysis team="opposition" analysis={analysis.teams.opposition} />
              </div>
            )}

            {analysis.rounds && analysis.rounds.length > 0 && (
              <section className="result-analysis-rounds">
                <h3>{t('roundAnalysis')}</h3>
                {analysis.rounds.map((round) => (
                  <article key={round.round}>
                    <header><strong>{t('round', { num: round.round })}</strong></header>
                    {(['proposition', 'opposition'] as const).map((team) => {
                      const side = round[team];
                      return (
                        <div className={`round-analysis-side team-${team}`} key={team}>
                          <div>
                            <strong>{side.username}</strong>
                            <small>{side.speaker}</small>
                          </div>
                          <p>{side.summary}</p>
                          <span>{t('speech')} {side.speechScore}/20</span>
                          <span>{t('ce')} {side.crossExamScore}/20</span>
                          <span>{Math.round(side.transcriptConfidence * 100)}% {t('confidence')}</span>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </section>
            )}

            {analysis.participants && analysis.participants.length > 0 && (
              <section className="result-participant-insights">
                <h3>{t('participantInsights')}</h3>
                <div>
                  {analysis.participants.map((participant) => (
                    <article className={`team-${participant.team}`} key={participant.userId}>
                      <header>
                        <strong>{participant.username}</strong>
                        <span>{Math.round(participant.transcriptConfidence * 100)}%</span>
                      </header>
                      <p>{participant.summary}</p>
                      <h6>{t('aiStrengths')}</h6>
                      <AnalysisList items={participant.strengths} />
                      <h6>{t('improvements')}</h6>
                      <AnalysisList items={participant.improvements} />
                    </article>
                  ))}
                </div>
              </section>
            )}

            {analysis.judgeSynthesis?.summary && (
              <section className="result-judge-synthesis">
                <h3>{t('judgeSynthesis')}</h3>
                <p>{analysis.judgeSynthesis.summary}</p>
                <div>
                  <div><h6>{t('agreements')}</h6><AnalysisList items={analysis.judgeSynthesis.agreements} /></div>
                  <div><h6>{t('disagreements')}</h6><AnalysisList items={analysis.judgeSynthesis.disagreements} /></div>
                </div>
              </section>
            )}
          </>
        )}
      </Card.Body>
    </Card>
  );
}
