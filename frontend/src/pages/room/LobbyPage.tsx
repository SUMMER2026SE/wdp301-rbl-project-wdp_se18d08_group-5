import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import type { SpeakerSlot, Team } from '@/types';

type AssignableRole = 'debater' | 'host' | 'judge' | 'viewer';

export default function LobbyPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [team, setTeam] = useState<Team>('proposition');
  const [speakerSlot, setSpeakerSlot] = useState<SpeakerSlot>('S1');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignRole, setAssignRole] = useState<AssignableRole>('debater');
  const [assignTeam, setAssignTeam] = useState<Team>('proposition');
  const [assignSlot, setAssignSlot] = useState<SpeakerSlot>('S1');

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const invalidateRoom = () => queryClient.invalidateQueries({ queryKey: ['room', roomId] });

  const selectMutation = useMutation({
    mutationFn: () => roomService.selectPosition(roomId, team, speakerSlot),
    onSuccess: () => {
      toast.success('Position selected');
      invalidateRoom();
    },
    onError: () => toast.error('Only assigned debaters can select position'),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      roomService.assignParticipant(roomId, {
        userId: selectedUserId,
        role: assignRole,
        team: assignRole === 'debater' ? assignTeam : null,
        speakerSlot: assignRole === 'debater' ? assignSlot : null,
      }),
    onSuccess: () => {
      toast.success('Participant updated');
      invalidateRoom();
    },
    onError: () => toast.error('Could not update participant'),
  });

  const lockMutation = useMutation({
    mutationFn: () => roomService.lockPositions(roomId),
    onSuccess: () => {
      toast.success('Debater positions locked');
      invalidateRoom();
    },
    onError: () => toast.error('Only owner can lock positions'),
  });

  const startMutation = useMutation({
    mutationFn: () => roomService.start(roomId),
    onSuccess: () => {
      toast.success('Debate started');
      navigate(`/debate/${roomId}`);
    },
    onError: () => toast.error('Assign host, fill debaters, then lock positions first'),
  });

  const room = roomQuery.data;
  const viewerChatEnabled = room?.viewerChatEnabled ?? true;
  const isOwner = Boolean(user && room?.createdBy === user._id);
  const currentParticipant = room?.participants.find((item) => item.userId === user?._id);
  const isAssignedDebater = currentParticipant?.roomRole === 'debater';
  const slots = useMemo(() => (room?.format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3']) as SpeakerSlot[], [room?.format]);

  const viewerChatMutation = useMutation({
    mutationFn: () => roomService.setViewerChat(roomId, !viewerChatEnabled),
    onSuccess: () => {
      toast.success(`Viewer chat ${viewerChatEnabled ? 'disabled' : 'enabled'}`);
      invalidateRoom();
    },
    onError: () => toast.error('Could not update viewer chat'),
  });

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
        <Col xl={8}>
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

        <Col xl={4}>
          {isOwner && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Assign Participant</Card.Title>
                <Form.Group className="mb-3">
                  <Form.Label>User</Form.Label>
                  <Form.Select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                    <option value="">Select user</option>
                    {room.participants.map((participant) => (
                      <option key={participant.userId} value={participant.userId}>
                        {participant.username} ({participant.roomRole})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={assignRole} onChange={(event) => setAssignRole(event.target.value as AssignableRole)}>
                    <option value="debater">Debater</option>
                    <option value="host">Host</option>
                    <option value="judge">Judge</option>
                    <option value="viewer">Viewer</option>
                  </Form.Select>
                </Form.Group>
                {assignRole === 'debater' && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Team</Form.Label>
                      <ButtonGroup className="w-100">
                        {(['proposition', 'opposition'] as Team[]).map((item) => (
                          <Button
                            key={item}
                            type="button"
                            variant={assignTeam === item ? 'primary' : 'outline-primary'}
                            onClick={() => setAssignTeam(item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Speaker</Form.Label>
                      <Form.Select value={assignSlot} onChange={(event) => setAssignSlot(event.target.value as SpeakerSlot)}>
                        {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                      </Form.Select>
                    </Form.Group>
                  </>
                )}
                <Button
                  className="w-100"
                  disabled={!selectedUserId || assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                >
                  Save Assignment
                </Button>
              </Card.Body>
            </Card>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Card.Title>My Debater Position</Card.Title>
              {!isAssignedDebater && (
                <Alert variant="info">Wait for the owner to assign you as a debater.</Alert>
              )}
              {currentParticipant?.positionLocked && (
                <Alert variant="success">Your position is locked.</Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Team</Form.Label>
                <ButtonGroup className="w-100">
                  {(['proposition', 'opposition'] as Team[]).map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant={team === item ? 'primary' : 'outline-primary'}
                      onClick={() => setTeam(item)}
                      disabled={!isAssignedDebater || currentParticipant?.positionLocked}
                    >
                      {item}
                    </Button>
                  ))}
                </ButtonGroup>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Speaker</Form.Label>
                <Form.Select
                  value={speakerSlot}
                  disabled={!isAssignedDebater || currentParticipant?.positionLocked}
                  onChange={(event) => setSpeakerSlot(event.target.value as SpeakerSlot)}
                >
                  {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                </Form.Select>
              </Form.Group>
              <Button
                className="w-100"
                onClick={() => selectMutation.mutate()}
                disabled={!isAssignedDebater || Boolean(currentParticipant?.positionLocked) || selectMutation.isPending}
              >
                Save My Position
              </Button>
            </Card.Body>
          </Card>

          {isOwner && (
            <Card>
              <Card.Body>
                <Card.Title>Room Setup</Card.Title>
                <div className="d-grid gap-2">
                  <div className="d-flex align-items-center justify-content-between rounded border border-info px-3 py-2">
                    <span>Viewer Chat</span>
                    <Badge bg={viewerChatEnabled ? 'success' : 'secondary'}>
                      {viewerChatEnabled ? 'On' : 'Off'}
                    </Badge>
                  </div>
                  <Button
                    variant={viewerChatEnabled ? 'outline-warning' : 'outline-info'}
                    onClick={() => viewerChatMutation.mutate()}
                    disabled={viewerChatMutation.isPending}
                  >
                    <i className={`bi ${viewerChatEnabled ? 'bi-chat-square-x' : 'bi-chat-square-text'} me-2`} />
                    {viewerChatEnabled ? 'Disable Viewer Chat' : 'Enable Viewer Chat'}
                  </Button>
                  <Button variant="outline-secondary" onClick={() => lockMutation.mutate()} disabled={lockMutation.isPending}>
                    <i className="bi bi-lock me-2" />
                    Lock Debaters
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
