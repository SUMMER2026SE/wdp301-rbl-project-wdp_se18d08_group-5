import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Dropdown, Form, ListGroup, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { debateService } from '@services/debateService';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import { useDebateSocket } from '@hooks/useDebateSocket';
import { useSocket } from '@hooks/useSocket';
import type { RoomParticipant, ScoreBreakdown, SpeakerTurn, Team } from '@/types';

const scoreFields: Array<{ key: keyof Omit<ScoreBreakdown, 'overall'>; max: number }> = [
  { key: 'logic', max: 30 },
  { key: 'rebuttal', max: 20 },
  { key: 'evidence', max: 15 },
  { key: 'crossExam', max: 15 },
  { key: 'strategy', max: 10 },
  { key: 'communication', max: 10 },
];

const speakerTurns: SpeakerTurn[] = ['PRO_S1', 'OPP_S1', 'PRO_S2', 'OPP_S2', 'PRO_S3', 'OPP_S3'];

export default function DebateRoomPage() {
  const { roomId = '' } = useParams();
  useSocket();
  useDebateSocket(roomId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [cardReason, setCardReason] = useState('');
  const [scoreSpeaker, setScoreSpeaker] = useState<SpeakerTurn>('PRO_S1');
  const [scoreWinner, setScoreWinner] = useState<Team | 'draw'>('proposition');
  const [notes, setNotes] = useState('');
  const [turnTranscript, setTurnTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isInDiscussionRoom, setIsInDiscussionRoom] = useState(false);
  const recognitionRef = useRef<any>(null);
  const lastNotifiedDrawRequestRef = useRef<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(scoreFields.map((field) => [field.key, Math.round(field.max * 0.7)])),
  );

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 8000,
  });

  const sessionQuery = useQuery({
    queryKey: ['debate-session', roomId],
    queryFn: async () => (await debateService.getSession(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 5000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    queryClient.invalidateQueries({ queryKey: ['debate-session', roomId] });
  };

  const controlMutation = useMutation({
    mutationFn: (action: 'next' | 'finish' | 'passCe' | 'finishCe' | 'pause' | 'resume' | 'end') => {
      if (action === 'next') {
        return roomService.nextTurnWithTranscript(roomId, { transcript: turnTranscript });
      }
      if (action === 'finish') return debateService.finishPhase(roomId, turnTranscript);
      if (action === 'passCe') {
        return roomService.passCrossExamWithTranscript(roomId, { transcript: turnTranscript });
      }
      if (action === 'finishCe') return debateService.finishCe(roomId, turnTranscript);
      if (action === 'pause') return debateService.pause(roomId);
      if (action === 'resume') return debateService.resume(roomId);
      return debateService.end(roomId);
    },
    onSuccess: () => {
      toast.success('Debate updated');
      setTurnTranscript('');
      invalidate();
    },
    onError: () => toast.error('Action failed'),
  });

  const cardMutation = useMutation({
    mutationFn: () => debateService.issueCard(roomId, selectedUserId, cardReason),
    onSuccess: () => {
      toast.success('Yellow card issued');
      setCardReason('');
      invalidate();
    },
    onError: () => toast.error('Could not issue card'),
  });

  const kickMutation = useMutation({
    mutationFn: () => debateService.kick(roomId, selectedUserId),
    onSuccess: () => {
      toast.success('Participant kicked');
      invalidate();
    },
    onError: () => toast.error('Could not kick participant'),
  });

  const scoreMutation = useMutation({
    mutationFn: () =>
      roomService.submitJudgeScore(roomId, {
        speaker: scoreSpeaker,
        logic: scores.logic,
        rebuttal: scores.rebuttal,
        evidence: scores.evidence,
        crossExam: scores.crossExam,
        strategy: scores.strategy,
        communication: scores.communication,
        winner: scoreWinner,
        notes,
      }),
    onSuccess: () => {
      toast.success('Score submitted');
      setNotes('');
      invalidate();
    },
    onError: () => toast.error('Could not submit score'),
  });

  const playerActionMutation = useMutation({
    mutationFn: (action: 'surrender' | 'draw') => {
      if (action === 'surrender') return debateService.surrender(roomId);
      return debateService.requestDraw(roomId);
    },
    onSuccess: (_response, action) => {
      toast.success(action === 'surrender' ? 'Surrender submitted' : 'Draw request sent');
      invalidate();
    },
    onError: () => toast.error('Action failed'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => roomService.leave(roomId),
    onSuccess: () => {
      toast.success('Left debate room');
      navigate('/matches');
    },
    onError: () => {
      navigate('/matches');
    },
  });

  const viewerChatMutation = useMutation({
    mutationFn: () => roomService.setViewerChat(roomId, !(room?.viewerChatEnabled ?? true)),
    onSuccess: () => {
      toast.success(`Viewer chat ${(room?.viewerChatEnabled ?? true) ? 'disabled' : 'enabled'}`);
      invalidate();
    },
    onError: () => toast.error('Could not update viewer chat'),
  });

  const transferHostMutation = useMutation({
    mutationFn: () => roomService.transferHost(roomId, selectedUserId),
    onSuccess: () => {
      toast.success('Host transferred');
      invalidate();
    },
    onError: () => toast.error('Could not transfer host'),
  });

  const aggregateMutation = useMutation({
    mutationFn: () => roomService.aggregateScores(roomId),
    onSuccess: () => {
      toast.success('Scores aggregated');
      invalidate();
    },
    onError: () => toast.error('Could not aggregate scores'),
  });

  const winnerMutation = useMutation({
    mutationFn: () => roomService.determineWinner(roomId),
    onSuccess: () => {
      toast.success('Winner determined');
      invalidate();
    },
    onError: () => toast.error('Could not determine winner'),
  });

  const room = roomQuery.data;
  const session = sessionQuery.data;
  const isController = Boolean(user && room?.hostId === user._id);
  const currentParticipant = room?.participants.find((participant) => participant.userId === user?._id);
  const canUseDebaterActions = currentParticipant?.roomRole === 'debater' && ['active', 'paused'].includes(room?.status || '');
  const isJudge = currentParticipant?.roomRole === 'judge';
  const debaters = room?.participants.filter((participant) => participant.roomRole === 'debater') || [];
  const judges = room?.participants.filter((participant) => participant.roomRole === 'judge') || [];
  const selectedParticipant = room?.participants.find((participant) => participant.userId === selectedUserId);
  const canManageScores = Boolean(isController || isJudge);
  const isDiscussionPhase = ['prep_7', 'prep_1'].includes(session?.currentTurn.phase || '');
  const canUseDiscussionRoom = room?.format === '3v3' && currentParticipant?.roomRole === 'debater' && isDiscussionPhase;
  const pendingDrawRequest = session?.finalScores?.drawRequests?.find((request) => request.status === 'pending');
  const ownTeamPendingDraw = Boolean(
    pendingDrawRequest && currentParticipant?.team && pendingDrawRequest.team === currentParticipant.team,
  );
  const opponentPendingDraw = Boolean(
    pendingDrawRequest && currentParticipant?.team && pendingDrawRequest.team !== currentParticipant.team,
  );

  const startMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Microphone transcription is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setTurnTranscript(transcript.trim());
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Microphone stopped');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopMic = () => {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    setIsListening(false);
  };

  useEffect(() => () => stopMic(), []);

  const progress = useMemo(() => {
    const turn = session?.currentTurn;
    if (!turn || !turn.timeLimit) return 0;
    return Math.max(0, Math.min(100, (turn.timeRemaining / turn.timeLimit) * 100));
  }, [session]);

  useEffect(() => {
    if (!canUseDiscussionRoom) {
      setIsInDiscussionRoom(false);
    }
  }, [canUseDiscussionRoom]);

  useEffect(() => {
    if (!isInDiscussionRoom || !session?.currentTurn.startTime || !session.currentTurn.timeLimit) return;

    const interval = window.setInterval(() => {
      const startTime = new Date(session.currentTurn.startTime).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, session.currentTurn.timeLimit - elapsed);
      if (remaining <= 0) {
        setIsInDiscussionRoom(false);
        toast('Discussion time ended. Back to main room.');
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isInDiscussionRoom, session?.currentTurn.startTime, session?.currentTurn.timeLimit]);

  useEffect(() => {
    if (!opponentPendingDraw || !pendingDrawRequest) return;

    const requestKey = `${pendingDrawRequest.team}:${pendingDrawRequest.requestedAt}`;
    if (lastNotifiedDrawRequestRef.current === requestKey) return;

    lastNotifiedDrawRequestRef.current = requestKey;
    toast(`${pendingDrawRequest.requestedByName || 'Opponent'} requested a draw`);
  }, [opponentPendingDraw, pendingDrawRequest]);

  if (roomQuery.isLoading || sessionQuery.isLoading) {
    return <Container fluid className="py-4"><Spinner animation="border" /></Container>;
  }

  if (!room || !session) {
    return <Container className="py-4"><Alert variant="warning">Debate session is not available yet.</Alert></Container>;
  }

  return (
    <Container fluid className="py-4">
      {opponentPendingDraw && (
        <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <strong>{pendingDrawRequest?.requestedByName || 'Opponent'}</strong> requested a draw.
            Accepting will end this debate as a draw.
          </div>
          {canUseDebaterActions && (
            <Button
              size="sm"
              variant="warning"
              onClick={() => playerActionMutation.mutate('draw')}
              disabled={playerActionMutation.isPending}
            >
              Accept Draw
            </Button>
          )}
        </Alert>
      )}
      {ownTeamPendingDraw && (
        <Alert variant="info">
          Draw request sent. Waiting for the opposing team to accept.
        </Alert>
      )}
      <Row className="g-4">
        <Col xl={8}>
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
            <div>
              <h2 className="mb-1">{room.title || 'Live Debate'}</h2>
              <div className="text-muted">{room.motion}</div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge bg={room.status === 'active' ? 'success' : 'secondary'} className="fs-6">
                {room.status}
              </Badge>
              {room.status === 'completed' && (
                <Button
                  size="sm"
                  variant="outline-light"
                  onClick={() => leaveMutation.mutate()}
                  disabled={leaveMutation.isPending}
                >
                  <i className="bi bi-box-arrow-right me-2" />
                  Thoát phòng
                </Button>
              )}
              {canUseDebaterActions && (
                <Dropdown align="end">
                  <Dropdown.Toggle variant="outline-light" size="sm" id="debater-actions">
                    <i className="bi bi-gear" />
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item
                      onClick={() => {
                        if (window.confirm('Surrender this debate?')) {
                          playerActionMutation.mutate('surrender');
                        }
                      }}
                    >
                      Surrender
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => playerActionMutation.mutate('draw')}>
                      Request Draw
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              )}
            </div>
          </div>

          <Card className="mb-4">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between gap-3 mb-3">
                <div>
                  <div className="text-muted small">Phase</div>
                  <h4 className="mb-0">{session.currentTurn.phase}</h4>
                </div>
                <div>
                  <div className="text-muted small">Current Speaker</div>
                  <h4 className="mb-0">{session.currentTurn.speaker}</h4>
                </div>
                <div>
                  <div className="text-muted small">Timer</div>
                  <h4 className="mb-0">{session.currentTurn.timeRemaining}s</h4>
                </div>
              </div>
              <ProgressBar now={progress} variant={progress < 20 ? 'danger' : 'primary'} />
              {canUseDiscussionRoom && (
                <div className="mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="text-muted small">
                    {isInDiscussionRoom
                      ? `You are in the ${currentParticipant?.team} discussion room.`
                      : '3v3 team discussion is available during preparation.'}
                  </div>
                  <Button
                    size="sm"
                    variant={isInDiscussionRoom ? 'outline-light' : 'outline-info'}
                    onClick={() => setIsInDiscussionRoom((current) => !current)}
                  >
                    <i className={`bi ${isInDiscussionRoom ? 'bi-box-arrow-left' : 'bi-people'} me-2`} />
                    {isInDiscussionRoom ? 'Back to Main Room' : 'Vào phòng thảo luận'}
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>

          {isInDiscussionRoom ? (
            <Card className="mb-4 border-info">
              <Card.Body>
                <Card.Title className="text-capitalize">{currentParticipant?.team} Discussion Room</Card.Title>
                <Alert variant="info" className="mb-3">
                  This space is for your team during preparation. You will be returned to the main room when preparation time ends.
                </Alert>
                <Table responsive size="sm" className="mb-0 align-middle">
                  <tbody>
                    {debaters
                      .filter((participant) => participant.team === currentParticipant?.team)
                      .map((participant) => (
                        <tr key={participant.userId}>
                          <td>{participant.username}</td>
                          <td>{participant.speakerSlot}</td>
                          <td>{participant.userId === user?._id ? 'You' : 'Teammate'}</td>
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          ) : (
            <Row className="g-3">
              {(['proposition', 'opposition'] as Team[]).map((team) => (
                <Col md={6} key={team}>
                  <TeamCard team={team} participants={debaters.filter((participant) => participant.team === team)} currentSpeaker={session.currentTurn.speaker} />
                </Col>
              ))}
            </Row>
          )}

          {session.currentTurn.phase === 'cross_exam' && (
            <Card className="mt-4">
              <Card.Body>
                <Card.Title>Cross Examination</Card.Title>
                <Row className="g-3 align-items-center">
                  <Col md={3}>
                    <div className="text-muted small">Asking</div>
                    <div className="fw-semibold">{session.currentTurn.ceState?.askingTeam || '-'}</div>
                  </Col>
                  <Col md={3}>
                    <div className="text-muted small">Answering</div>
                    <div className="fw-semibold">{session.currentTurn.ceState?.answeringTeam || '-'}</div>
                  </Col>
                  <Col md={3}>
                    <div className="text-muted small">Quota</div>
                    <div className="fw-semibold">
                      {session.currentTurn.ceState?.questionsAsked || 0}/{session.currentTurn.ceState?.quotaPerTeam || 2}
                    </div>
                  </Col>
                  <Col md={3} className="d-flex gap-2">
                    <Button size="sm" onClick={() => controlMutation.mutate('passCe')}>Pass Turn</Button>
                    <Button size="sm" variant="outline-secondary" onClick={() => controlMutation.mutate('finishCe')}>Finish</Button>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col xl={4}>
          {isController && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Host Controls</Card.Title>
                <Form.Group className="mb-3">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <Form.Label className="mb-0">Turn Transcript</Form.Label>
                    <div className="d-flex gap-2">
                      <Button
                        size="sm"
                        variant={isListening ? 'danger' : 'outline-info'}
                        onClick={isListening ? stopMic : startMic}
                      >
                        <i className={`bi ${isListening ? 'bi-mic-mute-fill' : 'bi-mic-fill'} me-2`} />
                        {isListening ? 'Stop Mic' : 'Start Mic'}
                      </Button>
                      <Button size="sm" variant="outline-secondary" onClick={() => setTurnTranscript('')}>
                        Clear
                      </Button>
                    </div>
                  </div>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Speak with the mic or type the transcript before moving to the next turn. AI judge uses this text."
                    value={turnTranscript}
                    onChange={(event) => setTurnTranscript(event.target.value)}
                  />
                </Form.Group>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Button size="sm" onClick={() => controlMutation.mutate('next')}>
                    Next Turn + AI
                  </Button>
                  <Button size="sm" variant="outline-primary" onClick={() => controlMutation.mutate('finish')}>Finish Phase</Button>
                  <Button size="sm" variant="outline-warning" onClick={() => controlMutation.mutate(room.status === 'paused' ? 'resume' : 'pause')}>
                    {room.status === 'paused' ? 'Resume' : 'Pause'}
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => controlMutation.mutate('end')}>End</Button>
                </div>
                <div className="d-flex align-items-center justify-content-between rounded border border-info px-3 py-2 mb-2">
                  <span>Viewer Chat</span>
                  <Badge bg={room.viewerChatEnabled ? 'success' : 'secondary'}>
                    {room.viewerChatEnabled ? 'On' : 'Off'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  className="w-100 mb-2"
                  variant={room.viewerChatEnabled ? 'outline-warning' : 'outline-info'}
                  onClick={() => viewerChatMutation.mutate()}
                  disabled={viewerChatMutation.isPending}
                >
                  <i className={`bi ${room.viewerChatEnabled ? 'bi-chat-square-x' : 'bi-chat-square-text'} me-2`} />
                  {room.viewerChatEnabled ? 'Disable Viewer Chat' : 'Enable Viewer Chat'}
                </Button>
                <Form.Select className="mb-2" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                  <option value="">Select participant</option>
                  {room.participants.map((participant) => (
                    <option key={participant.userId} value={participant.userId}>{participant.username}</option>
                  ))}
                </Form.Select>
                <Form.Control
                  className="mb-2"
                  placeholder="Card reason"
                  value={cardReason}
                  onChange={(event) => setCardReason(event.target.value)}
                />
                <div className="d-flex gap-2">
                  <Button size="sm" variant="warning" disabled={!selectedParticipant} onClick={() => cardMutation.mutate()}>
                    Issue Card
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-info"
                    disabled={!selectedParticipant || transferHostMutation.isPending}
                    onClick={() => transferHostMutation.mutate()}
                  >
                    Transfer Host
                  </Button>
                  <Button size="sm" variant="outline-danger" disabled={!selectedParticipant} onClick={() => kickMutation.mutate()}>
                    Kick
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

          {isJudge && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Judge Scoring</Card.Title>
                <Form.Label>Speaker</Form.Label>
                <Form.Select className="mb-3" value={scoreSpeaker} onChange={(event) => setScoreSpeaker(event.target.value as SpeakerTurn)}>
                  {speakerTurns
                    .filter((speaker) => room.format === '3v3' || speaker.endsWith('_S1'))
                    .map((speaker) => <option key={speaker} value={speaker}>{speaker}</option>)}
                </Form.Select>
                <Form.Label>Winner Vote</Form.Label>
                <Form.Select className="mb-3" value={scoreWinner} onChange={(event) => setScoreWinner(event.target.value as Team | 'draw')}>
                  <option value="proposition">Proposition</option>
                  <option value="opposition">Opposition</option>
                  <option value="draw">Draw</option>
                </Form.Select>
                {scoreFields.map(({ key, max }) => (
                  <Form.Group className="mb-2" key={key}>
                    <Form.Label className="text-capitalize">{key}: {scores[key]}/{max}</Form.Label>
                    <Form.Range
                      min={0}
                      max={max}
                      value={scores[key]}
                      onChange={(event) => setScores((current) => ({ ...current, [key]: Number(event.target.value) }))}
                    />
                  </Form.Group>
                ))}
                <Form.Control as="textarea" rows={2} placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                <Button className="w-100 mt-3" onClick={() => scoreMutation.mutate()}>Submit Score</Button>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Body>
              <Card.Title>Score Breakdown</Card.Title>
              <ScoreBreakdown finalScores={session.finalScores} />
              {canManageScores && (
                <div className="d-grid gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => aggregateMutation.mutate()}
                    disabled={aggregateMutation.isPending}
                  >
                    Aggregate Scores
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-success"
                    onClick={() => winnerMutation.mutate()}
                    disabled={winnerMutation.isPending}
                  >
                    Determine Winner
                  </Button>
                </div>
              )}
              <div className="mt-3">
                <div className="text-muted small mb-2">Judges</div>
                <ListGroup>
                  {judges.length ? judges.map((judge) => (
                    <ListGroup.Item key={judge.userId}>{judge.username}</ListGroup.Item>
                  )) : <ListGroup.Item>No judges assigned</ListGroup.Item>}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

function TeamCard({ team, participants, currentSpeaker }: { team: Team; participants: RoomParticipant[]; currentSpeaker: string }) {
  return (
    <Card>
      <Card.Body>
        <Card.Title className="text-capitalize">{team}</Card.Title>
        <Table responsive size="sm" className="mb-0 align-middle">
          <tbody>
            {participants.map((participant) => {
              const expectedSpeaker = `${team === 'proposition' ? 'PRO' : 'OPP'}_${participant.speakerSlot}`;
              const isCurrent = currentSpeaker === expectedSpeaker;
              return (
                <tr key={participant.userId} className={isCurrent ? 'table-primary' : ''}>
                  <td>{participant.username}</td>
                  <td>{participant.speakerSlot}</td>
                  <td>{participant.muted ? 'Muted' : 'Live'}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
}

function ScoreBreakdown({ finalScores }: { finalScores: any }) {
  const pro = finalScores?.teamProposition?.total || 0;
  const opp = finalScores?.teamOpposition?.total || 0;
  const total = Math.max(pro + opp, 1);

  return (
    <>
      <div className="mb-2">Proposition</div>
      <ProgressBar now={(pro / total) * 100} label={String(Math.round(pro))} className="mb-3" />
      <div className="mb-2">Opposition</div>
      <ProgressBar now={(opp / total) * 100} label={String(Math.round(opp))} variant="danger" className="mb-3" />
      <Alert variant={finalScores?.winner ? 'success' : 'secondary'} className="mb-0">
        Winner: {finalScores?.winner || 'Pending'}
      </Alert>
    </>
  );
}
