import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useParams, useNavigate } from 'react-router-dom';
import { TopicPicker, getTopicValue, type TopicInputMode } from '@components/room/TopicPicker';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import { useLobbySocket } from '@hooks/useLobbySocket';
import { useDebateRoomTracker, clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';
import { isSeededDebateTopic } from '@utils/debateTopics';
import type { RoomParticipant, SpeakerSlot, Team } from '@/types';

type AssignableRole = 'debater' | 'host' | 'judge' | 'viewer';

function getLockState(participant: RoomParticipant) {
  if (!isLockable(participant)) {
    return <Badge bg="secondary">Not required</Badge>;
  }

  return participant.positionLocked ? <i className="bi bi-lock-fill" /> : <i className="bi bi-unlock" />;
}

function isLockable(participant: RoomParticipant) {
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;

  if (!effectiveRole || effectiveRole === 'viewer') return false;
  if (!['debater', 'host', 'judge'].includes(effectiveRole)) return false;
  if (effectiveRole === 'debater' && (!participant.team || !participant.speakerSlot)) return false;

  return true;
}

function getDisplayRole(participant: RoomParticipant) {
  // The room creator keeps 'owner' regardless of the role they play in the
  // debate. Show their "primary role" so the participants table reflects what
  // they are actually doing in the room.
  if (participant.roomRole === 'owner') {
    return participant.primaryRole ?? 'viewer';
  }
  return participant.roomRole;
}

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
  const [topicMode, setTopicMode] = useState<TopicInputMode>('preset');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [lockFeedback, setLockFeedback] = useState<{ userId: string; locked: boolean } | null>(null);

  useEffect(() => {
    if (!lockFeedback) return;

    const timeoutId = window.setTimeout(() => {
      setLockFeedback(null);
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [lockFeedback]);

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const room = roomQuery.data;

  // Track room in storage for ReturnToDebateBanner while in the lobby
  useDebateRoomTracker(roomId, room?.title, true);

  const leaveMutation = useMutation({
    mutationFn: (newOwnerId?: string) => roomService.leave(roomId, newOwnerId),
    onSuccess: () => {
      clearDebateRoomFromStorage();
      toast.success('Left debate room');
      navigate('/matches');
    },
    onError: () => {
      clearDebateRoomFromStorage();
      navigate('/matches');
    },
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

  const unlockMutation = useMutation({
    mutationFn: () => roomService.unlockPositions(roomId),
    onSuccess: (response) => {
      const unlocked = (response?.data?.data as { unlockedCount?: number } | undefined)
        ?.unlockedCount;
      if (unlocked === 0) {
        toast.success('No positions were locked');
      } else {
        toast.success(`Unlocked ${unlocked} participant${unlocked === 1 ? '' : 's'}`);
      }
      invalidateRoom();
    },
    onError: () => toast.error('Only owner can unlock positions'),
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ userId, locked }: { userId: string; locked: boolean }) =>
      roomService.toggleParticipantLock(roomId, userId, locked),
    onMutate: (variables) => {
      setLockFeedback({ userId: variables.userId, locked: variables.locked });
    },
    onSuccess: (_response, variables) => {
      toast.success(variables.locked ? 'Position locked' : 'Position unlocked');
      invalidateRoom();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || 'Could not update lock state';
      toast.error(message);
      invalidateRoom();
    },
  });

  const startMutation = useMutation({
    mutationFn: () => roomService.start(roomId),
    onSuccess: () => {
      toast.success('Debate is starting...');
      navigate(`/debate/${roomId}`);
    },
    onError: () => toast.error('Assign host, choose topic, fill debaters, then lock positions first'),
  });

  const viewerChatEnabled = room?.viewerChatEnabled ?? true;
  const isOwner = Boolean(user && room?.createdBy === user._id);
  const isHost = Boolean(user && room?.hostId === user._id);
  const canManageTopic = isOwner || isHost;
  const topicValue = getTopicValue(topicMode, selectedTopic, customTopic);
  const currentParticipant = room?.participants.find((item) => item.userId === user?._id);

  const myEffectiveRole = currentParticipant
    ? currentParticipant.roomRole === 'owner'
      ? currentParticipant.primaryRole
      : currentParticipant.roomRole
    : null;
  const mySlot = currentParticipant?.speakerSlot;

  const canStartDebate = useMemo(() => {
    if (!room || !user || !currentParticipant) return false;
    if (isOwner) return true; // Room Owner can always start the match!
    
    if (room.hostType !== 'human') {
      if (room.judgeType === 'ai') {
        // No-host + AI judge: S1 debaters start
        return myEffectiveRole === 'debater' && mySlot === 'S1';
      } else {
        // No-host + Human judge: Judge S1 starts
        return myEffectiveRole === 'judge' && mySlot === 'S1';
      }
    } else {
      // Host-led: Host can start
      return myEffectiveRole === 'host';
    }
  }, [room, user, currentParticipant, myEffectiveRole, mySlot, isOwner]);
  const isAssignedDebater =
    currentParticipant?.roomRole === 'debater' ||
    (currentParticipant?.roomRole === 'owner' && currentParticipant?.primaryRole === 'debater');
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
        <div className="d-flex align-items-center gap-2">
          <Badge bg={room.status === 'ready' ? 'success' : 'secondary'} className="fs-6">
            {room.status}
          </Badge>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              const currentParticipant = room?.participants.find((p) => p.userId === user?._id);
              const isOwner = currentParticipant?.roomRole === 'owner';
              const otherParticipants = room?.participants.filter((p) => p.userId !== user?._id) || [];
              if (isOwner && otherParticipants.length > 0) {
                setShowLeaveConfirmModal(true);
              } else {
                leaveMutation.mutate(undefined);
              }
            }}
            disabled={leaveMutation.isPending}
          >
            <i className="bi bi-box-arrow-right me-1"></i> Leave Room
          </Button>
        </div>
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
                  {room.participants.map((participant) => {
                    const isRoomCreator = participant.userId === room.createdBy;
                    const lockable = isLockable(participant);
                    return (
                      <tr key={participant.userId}>
                        <td>
                          {participant.username}
                          {isRoomCreator && (
                            <Badge bg="warning" text="dark" className="ms-2" pill>
                              owner
                            </Badge>
                          )}
                        </td>
                        <td>{getDisplayRole(participant)}</td>
                        <td>{participant.team || '-'}</td>
                        <td>{participant.speakerSlot || '-'}</td>
                        <td>
                          {isOwner && lockable ? (
                            <Button
                              size="sm"
                              variant={participant.positionLocked ? 'success' : 'outline-secondary'}
                              onClick={() =>
                                toggleLockMutation.mutate({
                                  userId: participant.userId,
                                  locked: !participant.positionLocked,
                                })
                              }
                              disabled={toggleLockMutation.isPending}
                              title={participant.positionLocked ? 'Click to unlock' : 'Click to lock'}
                            >
                              <i
                                className={`bi ${
                                  participant.positionLocked ? 'bi-lock-fill' : 'bi-unlock'
                                } ${
                                  lockFeedback?.userId === participant.userId
                                    ? lockFeedback.locked
                                      ? 'lock-icon-flash-lock'
                                      : 'lock-icon-flash-unlock'
                                    : ''
                                } me-1`}
                              />
                              {participant.positionLocked ? 'Unlock' : 'Lock'}
                            </Button>
                          ) : (
                            getLockState(participant)
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                        {participant.username} ({getDisplayRole(participant)})
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
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      className="flex-fill"
                      onClick={() => lockMutation.mutate()}
                      disabled={lockMutation.isPending}
                    >
                      <i className="bi bi-lock me-2" />
                      Lock All
                    </Button>
                    <Button
                      variant="outline-success"
                      className="flex-fill"
                      onClick={() => unlockMutation.mutate()}
                      disabled={unlockMutation.isPending}
                    >
                      <i className="bi bi-unlock me-2" />
                      Unlock All
                    </Button>
                  </div>
                  {canStartDebate && (
                    <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                      <i className="bi bi-play-fill me-2" />
                      Start Debate
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}

          {!isOwner && canStartDebate && (
            <Card className="mb-3 border-success border-opacity-30">
              <Card.Body className="d-grid gap-2">
                <Card.Title className="text-success font-monospace" style={{ fontSize: '14px' }}>
                  Action Required
                </Card.Title>
                <p className="text-secondary small mb-2">
                  {room?.hostType !== 'human' && room?.judgeType === 'ai'
                    ? 'Both S1 debaters must click Start Debate to begin the match.'
                    : 'As Judge S1, you are responsible for starting the match.'}
                </p>
                <Button variant="success" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                  <i className="bi bi-play-fill me-2" />
                  Start Debate
                </Button>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* === LEAVE CONFIRMATION MODAL === */}
      <Modal
        show={showLeaveConfirmModal}
        onHide={() => setShowLeaveConfirmModal(false)}
        centered
        className="dark-theme-modal"
      >
        <Modal.Header closeButton className="border-neon bg-dark text-white border-opacity-20">
          <Modal.Title style={{ fontFamily: 'Orbitron', fontSize: '16px' }}>
            Leave Debate Room
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px' }}>
          <p className="mb-3">
            You are the <strong>Room Owner</strong>. If you leave, you must transfer room ownership.
          </p>
          
          {room?.participants && room.participants.filter(p => p.userId !== user?._id).length > 0 ? (
            <>
              <p className="text-secondary small mb-3">
                Select a successor to transfer ownership to, or click "Leave directly" to automatically transfer ownership to the next participant.
              </p>
              <div className="list-group list-group-flush mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {room.participants
                  .filter((p) => p.userId !== user?._id)
                  .map((p) => (
                    <button
                      key={p.userId}
                      className="list-group-item list-group-item-action bg-dark text-white border-secondary border-opacity-20 d-flex align-items-center justify-content-between py-2 px-3"
                      onClick={() => {
                        setShowLeaveConfirmModal(false);
                        leaveMutation.mutate(p.userId);
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <img
                          src={p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}
                          alt={p.username}
                          className="rounded-circle me-2"
                          style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                        />
                        <span>{p.username}</span>
                      </div>
                      <span className="badge bg-primary text-capitalize">{p.roomRole === 'debater' ? p.primaryRole || 'debater' : p.roomRole}</span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-secondary small mb-4">
              Since you are the only one in the room, leaving will close the room.
            </p>
          )}

          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-light" size="sm" onClick={() => setShowLeaveConfirmModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowLeaveConfirmModal(false);
                leaveMutation.mutate(undefined);
              }}
            >
              Leave directly
            </Button>
          </div>
        </Modal.Body>
      </Modal>

    </Container>
  );
}
