import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useMemo, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { TopicPicker, getTopicValue, type TopicInputMode } from '@components/room/TopicPicker';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import { useLobbySocket } from '@hooks/useLobbySocket';
import { useDebateRoomTracker, clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';
import { isSeededDebateTopic } from '@utils/debateTopics';
import type { RoomParticipant, SpeakerSlot, Team } from '@/types';
import { hasHostControl } from '../../utils/roomPermissions';

type AssignableRole = 'debater' | 'host' | 'judge' | 'viewer';
type EntityRef = string | { _id?: string; id?: string } | null | undefined;

function getEntityId(value: EntityRef) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
}

function getLockState(participant: RoomParticipant, t: (key: string) => string) {
  if (!isLockable(participant)) {
    return <Badge bg="secondary">{t('notRequired')}</Badge>;
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
  const { t } = useTranslation('lobby');
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

  const readinessQuery = useQuery({
    // Polled so the Start button reacts to join/leave events without requiring
    // a manual page reload. The socket already broadcasts `room:state-restore`
    // on every change, so we also re-fetch on that event via the useLobbySocket
    // hook below.
    queryKey: ['room', roomId, 'start-readiness'],
    queryFn: async () => (await roomService.getStartReadiness(roomId)).data.data,
    enabled: Boolean(roomId) && roomQuery.data?.status !== 'active' && roomQuery.data?.status !== 'completed',
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  const room = roomQuery.data;
  const startReadiness = readinessQuery.data;

  // Track room in storage for ReturnToDebateBanner while in the lobby
  useDebateRoomTracker(roomId, room?.title, true);

  const leaveMutation = useMutation({
    mutationFn: (newOwnerId?: string) => roomService.leave(roomId, newOwnerId),
    onSuccess: () => {
      clearDebateRoomFromStorage();
      toast.success(t('leftRoom'));
      navigate('/matches');
    },
    onError: () => {
      clearDebateRoomFromStorage();
      navigate('/matches');
    },
  });

  const invalidateRoom = useCallback(
    () => {
      queryClient.invalidateQueries({ queryKey: ['room', roomId] });
      queryClient.invalidateQueries({ queryKey: ['room', roomId, 'start-readiness'] });
    },
    [queryClient, roomId],
  );

  // Live room state sync — refetch when other participants mutate the room.
  useLobbySocket(roomId, invalidateRoom);

  const selectMutation = useMutation({
    mutationFn: () => roomService.selectPosition(roomId, team, speakerSlot),
    onSuccess: () => {
      toast.success(t('positionSelected'));
      invalidateRoom();
    },
    onError: () => toast.error(t('onlyAssignedCanSelect')),
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
      toast.success(t('participantUpdated'));
      invalidateRoom();
    },
    onError: () => toast.error(t('couldNotUpdate')),
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
            ? t('noPositionsLocked')
            : t('positionsLocked'),
        );
      } else {
        toast.success(t('positionsLocked'));
      }
      invalidateRoom();
    },
    onError: () => toast.error(t('onlyOwnerCanLock')),
  });

  const unlockMutation = useMutation({
    mutationFn: () => roomService.unlockPositions(roomId),
    onSuccess: (response) => {
      const unlocked = (response?.data?.data as { unlockedCount?: number } | undefined)
        ?.unlockedCount;
      if (unlocked === 0) {
        toast.success(t('noPositionsLocked'));
      } else {
        toast.success(t('unlockedParticipants', { n: unlocked }));
      }
      invalidateRoom();
    },
    onError: () => toast.error(t('onlyOwnerCanUnlock')),
  });

  const toggleLockMutation = useMutation({
    mutationFn: ({ userId, locked }: { userId: string; locked: boolean }) =>
      roomService.toggleParticipantLock(roomId, userId, locked),
    onMutate: (variables) => {
      setLockFeedback({ userId: variables.userId, locked: variables.locked });
    },
    onSuccess: (_response, variables) => {
      toast.success(variables.locked ? t('positionLockedToast') : t('positionUnlockedToast'));
      invalidateRoom();
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || t('couldNotUpdateLock');
      toast.error(message);
      invalidateRoom();
    },
  });

  const startMutation = useMutation({
    mutationFn: () => roomService.start(roomId),
    onSuccess: (response) => {
      const result = response.data?.data as any;
      if (result?.pendingStart) {
        const readyCount = result.readyUserIds?.length || 0;
        const totalDebaters = result.totalDebaters || 2;
        toast.success(`Waiting for S1 start consensus (${readyCount}/${totalDebaters})`);
        return;
      }
      toast.success(t('debateStarting'));
      navigate(`/debate/${roomId}`);
    },
    onError: () => toast.error(t('mustLockFirst')),
  });

  const viewerChatEnabled = room?.viewerChatEnabled ?? true;
  const createdById = getEntityId(room?.createdBy as EntityRef);
  const isOwner = Boolean(user && createdById === user._id);
  const isHost = hasHostControl(room, user?._id);
  const canManageLocks = isOwner || isHost;
  const canManageTopic = isOwner || isHost;
  const topicValue = getTopicValue(topicMode, selectedTopic, customTopic);
  const currentParticipant = room?.participants.find((item) => getEntityId(item.userId as EntityRef) === user?._id);

  const myEffectiveRole = currentParticipant
    ? currentParticipant.roomRole === 'owner'
      ? currentParticipant.primaryRole
      : currentParticipant.roomRole
    : null;
  const mySlot = currentParticipant?.speakerSlot as string | null | undefined;

  const canStartDebate = useMemo(() => {
    if (!room || !user || !currentParticipant) return false;

    if (room.hostType !== 'human' && room.judgeType === 'ai') {
      // No-Host + AI: S1 debaters can start
      return myEffectiveRole === 'debater' && mySlot === 'S1';
    }

    // Host rooms still allow the owner to start; No-Host + Human uses Judge S1 via isHost.
    if (isOwner && room.hostType === 'human') return true;
    return isHost;
  }, [room, user, currentParticipant, myEffectiveRole, mySlot, isOwner, isHost]);
  const isAssignedDebater =
    currentParticipant?.roomRole === 'debater' ||
    (currentParticipant?.roomRole === 'owner' && currentParticipant?.primaryRole === 'debater');
  const slots = useMemo(() => (room?.format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3']) as SpeakerSlot[], [room?.format]);

  // Reset `assignRole` to a valid option when the room config makes the current
  // selection unavailable (e.g. switched to No Host while "Host" was selected).
  useEffect(() => {
    if (!room) return;
    if (assignRole === 'host' && room.hostType !== 'human') {
      setAssignRole('debater');
    }
    if (assignRole === 'judge' && room.judgeType !== 'human') {
      setAssignRole('debater');
    }
  }, [room?.hostType, room?.judgeType, room?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!room) return;

    // Auto-redirect to the live debate page if the debate is already in
    // progress (e.g. another tab opened LobbyPage, or socket missed the
    // `debate:started` event because the participant wasn't in the lobby
    // channel at the moment of broadcast).
    if (['active', 'paused'].includes(room.status)) {
      navigate(`/debate/${roomId}`, { replace: true });
      return;
    }

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
  }, [room?._id, room?.motion, room?.status, roomId, navigate]);

  const viewerChatMutation = useMutation({
    mutationFn: () => roomService.setViewerChat(roomId, !viewerChatEnabled),
    onSuccess: () => {
      toast.success(viewerChatEnabled ? t('viewerChatDisabled') : t('viewerChatEnabled'));
      invalidateRoom();
    },
    onError: () => toast.error(t('couldNotUpdateChat')),
  });

  const topicMutation = useMutation({
    mutationFn: () => roomService.updateMotion(roomId, topicValue),
    onSuccess: () => {
      toast.success(t('topicSaved'));
      invalidateRoom();
    },
    onError: () => toast.error(t('chooseOrTypeTopic')),
  });

  if (roomQuery.isLoading) {
    return <Container className="py-4"><Spinner animation="border" /></Container>;
  }

  if (!room) {
    return <Container className="py-4"><Alert variant="warning">{t('roomNotFound')}</Alert></Container>;
  }

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <h2 className="mb-1">{room.title || t('debateLobby')}</h2>
          <div className="text-muted">{room.motion || t('motionWillBeAnnounced')}</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Badge bg={room.status === 'ready' ? 'success' : 'secondary'} className="fs-6">
            {room.status}
          </Badge>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              const currentParticipant = room?.participants.find((p) => getEntityId(p.userId as EntityRef) === user?._id);
              const isOwner = currentParticipant?.roomRole === 'owner';
              const otherParticipants = room?.participants.filter((p) => getEntityId(p.userId as EntityRef) !== user?._id) || [];
              if (isOwner && otherParticipants.length > 0) {
                setShowLeaveConfirmModal(true);
              } else {
                leaveMutation.mutate(undefined);
              }
            }}
            disabled={leaveMutation.isPending}
          >
            <i className="bi bi-box-arrow-right me-1"></i> {t('leaveRoom')}
          </Button>
        </div>
      </div>

      <Row className="g-4">
        <Col xl={8}>
          <Card>
            <Card.Body>
              <Card.Title>{t('participants')}</Card.Title>
              <Table responsive hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('name')}</th>
                    <th>{t('role')}</th>
                    <th>{t('team')}</th>
                    <th>{t('slot')}</th>
                    <th>{t('locked')}</th>
                  </tr>
                </thead>
                <tbody>
                  {room.participants.map((participant) => {
                    const participantId = getEntityId(participant.userId as EntityRef);
                    const isRoomCreator = participantId === createdById;
                    const lockable = isLockable(participant);
                    return (
                      <tr key={participantId}>
                        <td>
                          {participant.username}
                          {isRoomCreator && (
                            <Badge bg="warning" text="dark" className="ms-2" pill>
                              {t('owner')}
                            </Badge>
                          )}
                        </td>
                        <td>{getDisplayRole(participant)}</td>
                        <td>{participant.team || '-'}</td>
                        <td>{participant.speakerSlot || '-'}</td>
                        <td>
                          {canManageLocks && lockable ? (
                            <Button
                              size="sm"
                              variant={participant.positionLocked ? 'success' : 'outline-secondary'}
                              onClick={() =>
                                toggleLockMutation.mutate({
                                  userId: participantId,
                                  locked: !participant.positionLocked,
                                })
                              }
                              disabled={toggleLockMutation.isPending}
                              title={participant.positionLocked ? t('clickToUnlock') : t('clickToLock')}
                            >
                              <i
                                className={`bi ${
                                  participant.positionLocked ? 'bi-lock-fill' : 'bi-unlock'
                                } ${
                                  lockFeedback?.userId === participantId
                                    ? lockFeedback.locked
                                      ? 'lock-icon-flash-lock'
                                      : 'lock-icon-flash-unlock'
                                    : ''
                                } me-1`}
                              />
                              {participant.positionLocked ? t('unlock') : t('lock')}
                            </Button>
                          ) : (
                            getLockState(participant, t)
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
                <Card.Title>{t('debateTopic')}</Card.Title>
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
                  {t('saveTopic')}
                </Button>
              </Card.Body>
            </Card>
          )}

          {isOwner && (
            <Card className="mb-3">
              <Card.Body>
                <Card.Title>{t('assignParticipant')}</Card.Title>
                <div className="text-muted small mb-2">
                  <i className="bi bi-info-circle me-1" />
                  {(() => {
                    const hostLabel = room.hostType === 'human' ? t('withHost') : t('noHost');
                    const judgeLabel = room.judgeType === 'ai'
                      ? t('aiJudgeAuto')
                      : (room.judgeCount === 3 ? t('humanJudges3') : t('humanJudges1'));
                    return `${hostLabel} • ${judgeLabel}`;
                  })()}
                </div>
                <Form.Group className="mb-3">
                  <Form.Label>User</Form.Label>
                  <Form.Select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                    <option value="">{t('selectUser')}</option>
                    {room.participants.map((participant) => {
                      const participantId = getEntityId(participant.userId as EntityRef);
                      return (
                        <option key={participantId} value={participantId}>
                          {participant.username} ({getDisplayRole(participant)})
                        </option>
                      );
                    })}
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>{t('role')}</Form.Label>
                  <Form.Select
                    value={assignRole}
                    onChange={(event) => setAssignRole(event.target.value as AssignableRole)}
                  >
                    <option value="debater">Debater</option>
                    {/* Host is only available if room is configured with a Human Host. */}
                    {room.hostType === 'human' && <option value="host">Host</option>}
                    {/* Judge options are only available if room is configured with Human Judges.
                        AI Judge is auto-generated by the system — players cannot be assigned as Judge. */}
                    {room.judgeType === 'human' && (
                      <>
                        <option value="judge">Judge{room.judgeCount === 3 ? '' : ' 1'}</option>
                        {room.judgeCount === 3 && <option value="judge">Judge 2</option>}
                        {room.judgeCount === 3 && <option value="judge">Judge 3</option>}
                      </>
                    )}
                    <option value="viewer">Viewer</option>
                  </Form.Select>
                </Form.Group>
                {assignRole === 'debater' && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('team')}</Form.Label>
                      <ButtonGroup className="w-100">
                        {(['proposition', 'opposition'] as Team[]).map((item) => (
                          <Button
                            key={item}
                            type="button"
                            variant={assignTeam === item ? 'primary' : 'outline-primary'}
                            onClick={() => setAssignTeam(item)}
                          >
                            {item === 'proposition' ? t('teamPro') : t('teamOpp')}
                          </Button>
                        ))}
                      </ButtonGroup>
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>{t('speaker')}</Form.Label>
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
                  {t('saveAssignment')}
                </Button>
              </Card.Body>
            </Card>
          )}

          <Card className="mb-3">
            <Card.Body>
              <Card.Title>{t('myDebaterPosition')}</Card.Title>
              {!isAssignedDebater && (
                <Alert variant="info">{t('waitForOwnerAssign')}</Alert>
              )}
              {currentParticipant?.positionLocked && (
                <Alert variant="success">{t('positionLocked')}</Alert>
              )}
              <Form.Group className="mb-3">
                <Form.Label>{t('team')}</Form.Label>
                <ButtonGroup className="w-100">
                  {(['proposition', 'opposition'] as Team[]).map((item) => (
                    <Button
                      key={item}
                      type="button"
                      variant={team === item ? 'primary' : 'outline-primary'}
                      onClick={() => setTeam(item)}
                      disabled={!isAssignedDebater || currentParticipant?.positionLocked}
                    >
                      {item === 'proposition' ? t('teamPro') : t('teamOpp')}
                    </Button>
                  ))}
                </ButtonGroup>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>{t('speaker')}</Form.Label>
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
                {t('saveMyPosition')}
              </Button>
            </Card.Body>
          </Card>

          {canManageLocks && (
            <Card>
              <Card.Body>
                <Card.Title>{t('roomSetup')}</Card.Title>
                <div className="d-grid gap-2">
                  <div className="d-flex align-items-center justify-content-between rounded border border-info px-3 py-2">
                    <span>{t('viewerChat')}</span>
                    <Badge bg={viewerChatEnabled ? 'success' : 'secondary'}>
                      {viewerChatEnabled ? t('on') : t('off')}
                    </Badge>
                  </div>
                  <Button
                    variant={viewerChatEnabled ? 'outline-warning' : 'outline-info'}
                    onClick={() => viewerChatMutation.mutate()}
                    disabled={viewerChatMutation.isPending}
                  >
                    <i className={`bi ${viewerChatEnabled ? 'bi-chat-square-x' : 'bi-chat-square-text'} me-2`} />
                    {viewerChatEnabled ? t('disableViewerChat') : t('enableViewerChat')}
                  </Button>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      className="flex-fill"
                      onClick={() => lockMutation.mutate()}
                      disabled={lockMutation.isPending}
                    >
                      <i className="bi bi-lock me-2" />
                      {t('lockAll')}
                    </Button>
                    <Button
                      variant="outline-success"
                      className="flex-fill"
                      onClick={() => unlockMutation.mutate()}
                      disabled={unlockMutation.isPending}
                    >
                      <i className="bi bi-unlock me-2" />
                      {t('unlockAll')}
                    </Button>
                  </div>
                  {canStartDebate && (
                    <div className="d-grid gap-2">
                      <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending || startReadiness?.ready === false}>
                        <i className="bi bi-play-fill me-2" />
                        {t('startDebate')}
                      </Button>
                      {startReadiness?.ready === false && startReadiness?.reason && (
                        <Alert variant="warning" className="small mb-0 py-2">
                          <i className="bi bi-exclamation-triangle me-1" />
                          {startReadiness.reason}
                        </Alert>
                      )}
                      {startReadiness?.ready && (
                        <div className="text-success small">
                          <i className="bi bi-check-circle me-1" />
                          All Main Participants are present.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          )}

          {!isOwner && canStartDebate && (
            <Card className="mb-3 border-success border-opacity-30">
              <Card.Body className="d-grid gap-2">
                <Card.Title className="text-success font-monospace" style={{ fontSize: '14px' }}>
                  {t('actionRequired')}
                </Card.Title>
                <p className="text-secondary small mb-2">
                  {room?.hostType !== 'human' && room?.judgeType === 'ai'
                    ? t('s1MustStart')
                    : t('judgeS1Responsible')}
                </p>
                <Button
                  variant="success"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || startReadiness?.ready === false}
                >
                  <i className="bi bi-play-fill me-2" />
                  {t('startDebate')}
                </Button>
                {startReadiness?.ready === false && startReadiness?.reason && (
                  <Alert variant="warning" className="small mb-0 py-2">
                    <i className="bi bi-exclamation-triangle me-1" />
                    {startReadiness.reason}
                  </Alert>
                )}
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
            {t('leaveDebateRoom')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px' }}>
          <p className="mb-3">
            {t('ownerLeaveWarning')}
          </p>
          
          {room?.participants && room.participants.filter((p) => getEntityId(p.userId as EntityRef) !== user?._id).length > 0 ? (
            <>
              <p className="text-secondary small mb-3">
                {t('ownerLeaveWarning2')}
              </p>
              <div className="list-group list-group-flush mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {room.participants
                  .filter((p) => getEntityId(p.userId as EntityRef) !== user?._id)
                  .map((p) => (
                    <button
                      key={getEntityId(p.userId as EntityRef)}
                      className="list-group-item list-group-item-action bg-dark text-white border-secondary border-opacity-20 d-flex align-items-center justify-content-between py-2 px-3"
                      onClick={() => {
                        setShowLeaveConfirmModal(false);
                        leaveMutation.mutate(getEntityId(p.userId as EntityRef));
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
              {t('onlyOneInRoom')}
            </p>
          )}

          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-light" size="sm" onClick={() => setShowLeaveConfirmModal(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowLeaveConfirmModal(false);
                leaveMutation.mutate(undefined);
              }}
            >
              {t('leaveDirectly')}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

    </Container>
  );
}
