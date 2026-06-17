import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useParams } from 'react-router-dom';
import { TopicPicker, getTopicValue, type TopicInputMode } from '@components/room/TopicPicker';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import { useLobbySocket } from '@hooks/useLobbySocket';
import { isSeededDebateTopic } from '@utils/debateTopics';
import type { RoomParticipant, SpeakerSlot, Team } from '@/types';

type AssignableRole = 'debater' | 'host' | 'judge' | 'viewer';

function getLockState(participant: RoomParticipant) {
  if (participant.roomRole === 'owner' || participant.roomRole === 'viewer') {
    return <Badge bg="secondary">Not required</Badge>;
  }

  return participant.positionLocked ? <i className="bi bi-lock-fill" /> : <i className="bi bi-unlock" />;
}

export default function LobbyPage() {
  const { roomId = '' } = useParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [team, setTeam] = useState<Team>('proposition');
  const [speakerSlot, setSpeakerSlot] = useState<SpeakerSlot>('S1');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignRole, setAssignRole] = useState<AssignableRole>('debater');
  const [assignTeam, setAssignTeam] = useState<Team>('proposition');
  const [assignSlot, setAssignSlot] = useState<SpeakerSlot>('S1');
  const [topicMode, setTopicMode] = useState<TopicInputMode>('preset');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const invalidateRoom = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['room', roomId] }),
    [queryClient, roomId],
  );

  // Live room state sync — refetch when other participants mutate the room.
  useLobbySocket(roomId, invalidateRoom);

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
    onSuccess: (response) => {
      const data = response?.data?.data as {
        lockedCount?: number;
        lockableCount?: number;
        participantCount?: number;
      } | undefined;
      if (data?.lockedCount !== undefined && data?.lockableCount !== undefined) {
        toast.success(
          data.lockedCount === 0
            ? `No assigned positions to lock (${data.participantCount ?? 0} participants in room)`
            : `All assigned positions locked (${data.lockedCount}/${data.lockableCount} required)`,
        );
      } else {
        toast.success('All assigned positions locked');
      }
      invalidateRoom();
    },
    onError: () => toast.error('Only owner can lock positions'),
  });

  const startMutation = useMutation({
    mutationFn: () => roomService.start(roomId),
    onSuccess: () => {
      toast.success('Debate is starting...');
      // Do NOT navigate here. Wait for the socket's 'debate:started' event
      // which useLobbySocket listens for and will navigate all participants.
    },
    onError: () => toast.error('Assign host, choose topic, fill debaters, then lock positions first'),
  });

  const room = roomQuery.data;
  const viewerChatEnabled = room?.viewerChatEnabled ?? true;
  const isOwner = Boolean(user && room?.createdBy === user._id);
  const isHost = Boolean(user && room?.hostId === user._id);
  const canManageTopic = isOwner || isHost;
  const topicValue = getTopicValue(topicMode, selectedTopic, customTopic);
  const currentParticipant = room?.participants.find((item) => item.userId === user?._id);
  const isAssignedDebater = currentParticipant?.roomRole === 'debater';
  const slots = useMemo(() => (room?.format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3']) as SpeakerSlot[], [room?.format]);

  useEffect(() => {
    if (!room) return;

    if (!room.motion) {
      setTopicMode('preset');
      setSelectedTopic('');
      setCustomTopic('');
      return;
    }

    if (isSeededDebateTopic(room.motion)) {
      setTopicMode('preset');
      setSelectedTopic(room.motion);
      setCustomTopic('');
      return;
    }

    setTopicMode('custom');
    setSelectedTopic('');
    setCustomTopic(room.motion);
  }, [room?._id, room?.motion]);

  const viewerChatMutation = useMutation({
    mutationFn: () => roomService.setViewerChat(roomId, !viewerChatEnabled),
    onSuccess: () => {
      toast.success(`Viewer chat ${viewerChatEnabled ? 'disabled' : 'enabled'}`);
      invalidateRoom();
    },
    onError: () => toast.error('Could not update viewer chat'),
  });

  const topicMutation = useMutation({
    mutationFn: () => roomService.updateMotion(roomId, topicValue),
    onSuccess: () => {
      toast.success('Topic saved');
      invalidateRoom();
    },
    onError: () => toast.error('Choose or type a debate topic'),
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
                      <td>{getLockState(participant)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col xl={4}>
          {canManageTopic && ['waiting', 'ready'].includes(room.status) && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>Debate Topic</Card.Title>
                <TopicPicker
                  mode={topicMode}
                  selectedTopic={selectedTopic}
                  customTopic={customTopic}
                  onModeChange={setTopicMode}
                  onSelectedTopicChange={setSelectedTopic}
                  onCustomTopicChange={setCustomTopic}
                  disabled={topicMutation.isPending}
                />
                <Button
                  className="w-100 mt-3"
                  onClick={() => topicMutation.mutate()}
                  disabled={!topicValue || topicMutation.isPending}
                >
                  <i className="bi bi-check2-circle me-2" />
                  Save Topic
                </Button>
              </Card.Body>
            </Card>
          )}

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
                    Lock All Positions
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
