import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import type { SpeakerSlot, Team } from '@/types';

export default function LobbyPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [team, setTeam] = useState<Team>('proposition');
  const [speakerSlot, setSpeakerSlot] = useState<SpeakerSlot>('S1');

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const selectMutation = useMutation({
    mutationFn: () => roomService.selectPosition(roomId, team, speakerSlot),
    onSuccess: () => {
      toast.success('Position selected');
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: () => toast.error('Could not select position'),
  });

  const lockMutation = useMutation({
    mutationFn: () => roomService.lockPositions(roomId),
    onSuccess: () => {
      toast.success('Positions locked');
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    },
    onError: () => toast.error('Only owner can lock positions'),
  });

  const startMutation = useMutation({
    mutationFn: () => roomService.start(roomId),
    onSuccess: () => {
      toast.success('Debate started');
      navigate(`/debate/${roomId}`);
    },
    onError: () => toast.error('Fill and lock all debater positions first'),
  });

  const room = roomQuery.data;
  const isOwner = Boolean(user && room?.createdBy === user._id);
  const currentParticipant = room?.participants.find((item) => item.userId === user?._id);

  if (roomQuery.isLoading) {
    return <Container className="py-4"><Spinner animation="border" /></Container>;
  }

  if (!room) {
    return <Container className="py-4"><Alert variant="warning">Room not found.</Alert></Container>;
  }

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1">{room.title || 'Debate Lobby'}</h2>
          <div className="text-muted">{room.motion || 'Motion will be announced by the host.'}</div>
        </div>
        <Badge bg={room.status === 'ready' ? 'success' : 'secondary'} className="fs-6">
          {room.status}
        </Badge>
      </div>

      <Row className="g-4">
        <Col lg={8}>
          <Card>
            <Card.Body>
              <Card.Title>Participants</Card.Title>
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Team</th>
                    <th>Slot</th>
                    <th>Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {room.participants.map((participant) => (
                    <tr key={participant.userId}>
                      <td>{participant.username}</td>
                      <td>{participant.roomRole}</td>
                      <td>{participant.team || '-'}</td>
                      <td>{participant.speakerSlot || '-'}</td>
                      <td>{participant.positionLocked ? <i className="bi bi-lock-fill" /> : <i className="bi bi-unlock" />}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>Select Position</Card.Title>
              {currentParticipant?.positionLocked && (
                <Alert variant="success">Your position is locked.</Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Team</Form.Label>
                <ButtonGroup className="w-100">
                  {(['proposition', 'opposition'] as Team[]).map((item) => (
                    <Button
                      key={item}
                      variant={team === item ? 'primary' : 'outline-primary'}
                      onClick={() => setTeam(item)}
                    >
                      {item}
                    </Button>
                  ))}
                </ButtonGroup>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Speaker</Form.Label>
                <Form.Select value={speakerSlot} onChange={(event) => setSpeakerSlot(event.target.value as SpeakerSlot)}>
                  {(room.format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3']).map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Button className="w-100" onClick={() => selectMutation.mutate()} disabled={selectMutation.isPending}>
                Save Position
              </Button>
            </Card.Body>
          </Card>

          {isOwner && (
            <Card>
              <Card.Body>
                <Card.Title>Owner Controls</Card.Title>
                <div className="d-grid gap-2">
                  <Button variant="outline-secondary" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
                    <i className="bi bi-lock me-2" />
                    Lock Positions
                  </Button>
                  <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                    <i className="bi bi-play-fill me-2" />
                    Start Debate
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}
