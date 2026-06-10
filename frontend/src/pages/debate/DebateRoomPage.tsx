import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Container, Form, ListGroup, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { debateService } from '@services/debateService';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import type { RoomParticipant, ScoreBreakdown, Team } from '@/types';

const scoreFields: Array<keyof ScoreBreakdown> = [
  'logic',
  'rebuttal',
  'evidence',
  'crossExam',
  'strategy',
  'communication',
];

export default function DebateRoomPage() {
  const { roomId = '' } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [cardReason, setCardReason] = useState('');
  const [scoreTeam, setScoreTeam] = useState<Team>('proposition');
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(scoreFields.map((field) => [field, 7])),
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
      if (action === 'next') return debateService.nextTurn(roomId);
      if (action === 'finish') return debateService.finishPhase(roomId);
      if (action === 'passCe') return debateService.passCeTurn(roomId);
      if (action === 'finishCe') return debateService.finishCe(roomId);
      if (action === 'pause') return debateService.pause(roomId);
      if (action === 'resume') return debateService.resume(roomId);
      return debateService.end(roomId);
    },
    onSuccess: () => {
      toast.success('Debate updated');
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
    mutationFn: () => debateService.submitScore(roomId, { team: scoreTeam, score: scores, notes }),
    onSuccess: () => {
      toast.success('Score submitted');
      setNotes('');
      invalidate();
    },
    onError: () => toast.error('Could not submit score'),
  });

  const room = roomQuery.data;
  const session = sessionQuery.data;
  const isController = Boolean(user && room && (room.createdBy === user._id || room.hostId === user._id));
  const debaters = room?.participants.filter((participant) => participant.roomRole === 'debater') || [];
  const judges = room?.participants.filter((participant) => participant.roomRole === 'judge') || [];
  const selectedParticipant = room?.participants.find((participant) => participant.userId === selectedUserId);

  const progress = useMemo(() => {
    const turn = session?.currentTurn;
    if (!turn || !turn.timeLimit) return 0;
    return Math.max(0, Math.min(100, (turn.timeRemaining / turn.timeLimit) * 100));
  }, [session]);

  if (roomQuery.isLoading || sessionQuery.isLoading) {
    return <Container fluid className="py-4"><Spinner animation="border" /></Container>;
  }

  if (!room || !session) {
    return <Container className="py-4"><Alert variant="warning">Debate session is not available yet.</Alert></Container>;
  }

  return (
    <Container fluid className="py-4">
      <Row className="g-4">
        <Col xl={8}>
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
            <div>
              <h2 className="mb-1">{room.title || 'Live Debate'}</h2>
              <div className="text-muted">{room.motion}</div>
            </div>
            <Badge bg={room.status === 'active' ? 'success' : 'secondary'} className="fs-6">
              {room.status}
            </Badge>
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
            </Card.Body>
          </Card>

          <Row className="g-3">
            {(['proposition', 'opposition'] as Team[]).map((team) => (
              <Col md={6} key={team}>
                <TeamCard team={team} participants={debaters.filter((participant) => participant.team === team)} currentSpeaker={session.currentTurn.speaker} />
              </Col>
            ))}
          </Row>

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
                <div className="d-flex flex-wrap gap-2 mb-3">
                  <Button size="sm" onClick={() => controlMutation.mutate('next')}>Next Turn</Button>
                  <Button size="sm" variant="outline-primary" onClick={() => controlMutation.mutate('finish')}>Finish Phase</Button>
                  <Button size="sm" variant="outline-warning" onClick={() => controlMutation.mutate(room.status === 'paused' ? 'resume' : 'pause')}>
                    {room.status === 'paused' ? 'Resume' : 'Pause'}
                  </Button>
                  <Button size="sm" variant="outline-danger" onClick={() => controlMutation.mutate('end')}>End</Button>
                </div>
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
                  <Button size="sm" variant="outline-danger" disabled={!selectedParticipant} onClick={() => kickMutation.mutate()}>
                    Kick
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Judge Scoring</Card.Title>
              <Form.Select className="mb-3" value={scoreTeam} onChange={(event) => setScoreTeam(event.target.value as Team)}>
                <option value="proposition">Proposition</option>
                <option value="opposition">Opposition</option>
              </Form.Select>
              {scoreFields.map((field) => (
                <Form.Group className="mb-2" key={field}>
                  <Form.Label className="text-capitalize">{field}: {scores[field]}</Form.Label>
                  <Form.Range min={1} max={10} value={scores[field]} onChange={(event) => setScores((current) => ({ ...current, [field]: Number(event.target.value) }))} />
                </Form.Group>
              ))}
              <Form.Control as="textarea" rows={2} placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              <Button className="w-100 mt-3" onClick={() => scoreMutation.mutate()}>Submit Score</Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <Card.Title>Score Breakdown</Card.Title>
              <ScoreBreakdown finalScores={session.finalScores} />
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
