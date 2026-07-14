import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Alert, Badge, Button as RBButton, Form, ListGroup, Nav, Spinner } from 'react-bootstrap';
const Button = RBButton as any;
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';
import { usePrivateRoomSocket, type PrivateRoomTeam } from '@hooks/usePrivateRoomSocket';
import { usePrivateRoomVoice } from '@hooks/usePrivateRoomVoice';
import { usePrivateRoomVideo } from '@hooks/usePrivateRoomVideo';
import { debateWorkflow, isWorkflowStepActive } from '@utils/debateWorkflow';
import { CameraGrid } from '@components/debate/CameraGrid';
import { roomService } from '@services/roomService';
import type { ChatMessage, RoomParticipant } from '@/types';
import { hasHostControl } from '../../utils/roomPermissions';

const TEAM_LABELS: Record<PrivateRoomTeam, string> = {
  proposition: 'Proposition',
  opposition: 'Opposition',
  judge: 'Judges',
};

const TEAM_ICONS: Record<PrivateRoomTeam, string> = {
  proposition: 'bi-arrow-up-circle text-info',
  opposition: 'bi-arrow-down-circle text-danger',
  judge: 'bi-star text-warning',
};

function formatTime(timestamp: string | Date) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function PrivateRoomPage() {
  const { roomId = '', team: teamParam = '' } = useParams<{ roomId: string; team: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const storeRoom = useDebateStore((s) => s.room);
  const participants = useDebateStore((s) => s.participants);
  const currentPhase = useDebateStore((s) => s.currentPhase);
  const currentSpeaker = useDebateStore((s) => s.currentSpeaker);
  const timeRemaining = useDebateStore((s) => s.timeRemaining);
  const isPaused = useDebateStore((s) => s.isPaused);

  // If the room is not yet in the store (e.g. user opened the private room
  // URL directly without first visiting the debate room), fetch it.
  const roomQuery = useQuery({
    queryKey: ['room', roomId, 'private-room'],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId) && !storeRoom,
    refetchOnMount: false,
  });
  const room = storeRoom ?? roomQuery.data;

  const team: PrivateRoomTeam | null = useMemo(() => {
    if (teamParam === 'proposition' || teamParam === 'opposition' || teamParam === 'judge') {
      return teamParam;
    }
    return null;
  }, [teamParam]);

  const myParticipant = useMemo<RoomParticipant | undefined>(
    () => participants.find((p) => p.userId === user?._id) ?? (room as any)?.participants?.find((p: any) => p.userId === user?._id),
    [participants, user?._id, room],
  );

  const effectiveRole = useMemo(() => {
    return myParticipant
      ? myParticipant.roomRole === 'owner'
        ? myParticipant.primaryRole
        : myParticipant.roomRole
      : null;
  }, [myParticipant]);

  const isHost = useMemo(() => {
    const isCreator = Boolean(user?._id && (room as any)?.createdBy && (room as any).createdBy === user._id);
    return isCreator || hasHostControl(room, user?._id);
  }, [user?._id, room]);

  const allowedTeams = useMemo<PrivateRoomTeam[]>(() => {
    if (isHost) return ['proposition', 'opposition', 'judge'];
    if (effectiveRole === 'judge') return ['judge'];
    if (effectiveRole === 'debater' && myParticipant?.team) {
      return [myParticipant.team as PrivateRoomTeam];
    }
    return [];
  }, [isHost, effectiveRole, myParticipant?.team]);

  const hasAccess = team !== null && allowedTeams.includes(team);

  const {
    joined,
    participantCount,
    participantUserIds,
    messages,
    error,
    sendMessage,
  } = usePrivateRoomSocket(hasAccess ? roomId : undefined, hasAccess ? team : null);

  const { micActive, peers: voicePeers, startMic, stopMic } = usePrivateRoomVoice({
    roomId,
    team: team ?? 'proposition',
    enabled: hasAccess,
  });

  const { cameraActive, peers: videoPeers, startCamera, stopCamera, localStream } =
    usePrivateRoomVideo({
      roomId,
      team: team ?? 'proposition',
      enabled: hasAccess,
    });

  const [chatInput, setChatInput] = useState('');

  // Playback safety: if autoplay is blocked, a single click resumes it.
  useEffect(() => {
    const resume = () => {
      document.querySelectorAll<HTMLAudioElement>('audio[data-private-voice="1"]').forEach((el) => {
        el.play().catch(() => undefined);
      });
    };
    document.addEventListener('click', resume, { once: true });
    return () => document.removeEventListener('click', resume);
  }, []);

  const presentParticipants = useMemo<RoomParticipant[]>(() => {
    return participants.filter((p) => participantUserIds.includes(p.userId));
  }, [participants, participantUserIds]);

  if (!team) {
    return (
      <div className="container py-5 text-center text-light">
        <h4>Invalid private room</h4>
        <Button variant="primary" onClick={() => navigate(`/debate/${roomId}`)}>
          Back to debate
        </Button>
      </div>
    );
  }

  // Show a spinner while room data is loading. Without this, hasAccess would
  // race against the freshly-fetched room and incorrectly render the "No
  // access" screen, blocking the user from entering the private room.
  if (roomQuery.isLoading || (!storeRoom && !room)) {
    return (
      <div className="container py-5 text-center text-light">
        <Spinner animation="border" role="status" />
        <div className="mt-3">Loading private room…</div>
      </div>
    );
  }

  if (roomQuery.isError) {
    return (
      <div className="container py-5">
        <Alert variant="danger" className="text-center">
          <Alert.Heading>
            <i className="bi bi-exclamation-triangle me-2" />
            Room not found
          </Alert.Heading>
          Unable to load the room. The debate may have ended.
          <div className="mt-3">
            <Button variant="primary" onClick={() => navigate('/lobby')}>
              Back to lobby
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container py-5">
        <Alert variant="warning" className="text-center">
          <Alert.Heading>
            <i className="bi bi-shield-lock me-2" />
            No access
          </Alert.Heading>
          You don&apos;t have permission to enter the {TEAM_LABELS[team]} private room.
          <div className="mt-3">
            <Button variant="primary" onClick={() => navigate(`/debate/${roomId}`)}>
              Back to debate
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(chatInput);
    setChatInput('');
  };

  const handleSwitchTeam = (next: PrivateRoomTeam) => {
    navigate(`/debate/${roomId}/private/${next}`);
  };

  return (
    <div
      className="d-flex flex-column"
      style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3' }}
    >
      {/* Top bar */}
      <header
        className="d-flex align-items-center justify-content-between px-3 py-2"
        style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}
      >
        <div className="d-flex align-items-center gap-3">
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => navigate(`/debate/${roomId}`)}
            title="Back to debate"
          >
            <i className="bi bi-arrow-left me-1" />
            Back
          </Button>
          <div>
            <div className="fw-semibold">
              <i className={`bi ${TEAM_ICONS[team]} me-2`} />
              {TEAM_LABELS[team]} Private Room
            </div>
            <small className="text-muted">
              {room?.motion || 'No motion set'} · {room?.title}
            </small>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          {isHost && (
            <Nav variant="pills" activeKey={team}>
              {(['proposition', 'opposition', 'judge'] as PrivateRoomTeam[]).map((t) => (
                <Nav.Item key={t}>
                  <Nav.Link eventKey={t} onClick={() => handleSwitchTeam(t)}>
                    {TEAM_LABELS[t]}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          )}
          <Badge bg="dark" pill>
            <i className="bi bi-people-fill me-1" />
            {participantCount}
          </Badge>
        </div>
      </header>

      {error && (
        <Alert variant="danger" className="m-3 mb-0" dismissible>
          {error}
        </Alert>
      )}

      <div className="d-flex flex-grow-1" style={{ overflow: 'hidden' }}>
        {/* Left sidebar — participants + workflow */}
        <aside
          className="p-3 overflow-auto"
          style={{ width: 280, background: '#161b22', borderRight: '1px solid #30363d' }}
        >
          <h6 className="text-uppercase small text-muted mb-2">In this room</h6>
          <ListGroup variant="flush" className="mb-3">
            {presentParticipants.map((p) => {
              const isMe = p.userId === user?._id;
              const isCameraOn = isMe
                ? cameraActive
                : videoPeers.some((vp) => vp.userId === p.userId && vp.stream);
              const isMicOn = isMe
                ? micActive
                : voicePeers.some((vp) => vp.userId === p.userId && vp.stream);

              return (
                <ListGroup.Item
                  key={p.userId}
                  style={{ background: 'transparent', color: '#e6edf3', borderColor: '#30363d' }}
                  className="d-flex align-items-center gap-2"
                >
                  <img
                    src={p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.username)}`}
                    alt={p.username}
                    className="rounded-circle"
                    width={28}
                    height={28}
                  />
                  <div className="flex-grow-1">
                    <div className="small fw-semibold">
                      {p.username}
                      {isMe && <span className="text-muted ms-1">(you)</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                      {p.speakerSlot ? `${p.team?.toUpperCase()} ${p.speakerSlot}` : (p.roomRole === 'owner' ? p.primaryRole : p.roomRole)}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {isMicOn ? (
                      <i className="bi bi-mic-fill text-success" title="Microphone Active" />
                    ) : (
                      <i className="bi bi-mic-mute-fill text-danger" title="Microphone Muted" />
                    )}
                    {isCameraOn ? (
                      <i className="bi bi-camera-video-fill text-success" title="Camera Active" />
                    ) : (
                      <i className="bi bi-camera-video-off-fill text-danger" title="Camera Off" />
                    )}
                  </div>
                </ListGroup.Item>
              );
            })}
            {presentParticipants.length === 0 && (
              <div className="text-muted small fst-italic">No one is here yet</div>
            )}
          </ListGroup>

          <h6 className="text-uppercase small text-muted mb-2">Workflow</h6>
          <ListGroup variant="flush">
            {debateWorkflow.map((step) => {
              const isActive = isWorkflowStepActive(step, currentPhase, currentSpeaker);
              return (
                <ListGroup.Item
                  key={`${step.speaker}-${step.phase}`}
                  style={{
                    background: 'transparent',
                    color: isActive ? '#58a6ff' : '#8b949e',
                    borderColor: '#30363d',
                    fontSize: '0.8rem',
                  }}
                  className="d-flex align-items-center gap-2"
                >
                  {isActive ? (
                    <Spinner animation="border" size="sm" style={{ width: 10, height: 10 }} />
                  ) : (
                    <i className="bi bi-circle" style={{ fontSize: 8 }} />
                  )}
                  <div className="flex-grow-1">
                    <div className={isActive ? 'fw-semibold' : ''}>{step.label}</div>
                    <div className="text-muted" style={{ fontSize: '0.65rem' }}>
                      {step.detail}
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        </aside>

        {/* Center — camera grid */}
        <main className="flex-grow-1 p-3 d-flex flex-column" style={{ overflow: 'auto' }}>
          <div className="mb-3">
            <CameraGrid
              peers={videoPeers}
              participants={presentParticipants}
              localUserId={user?._id}
              localUsername={user?.username || 'You'}
              localStream={localStream}
              localMuted={!micActive}
              resolveUserId={(peer) => peer.userId}
            />
          </div>

          {/* Live status strip */}
          <div
            className="rounded-3 p-2 px-3 d-flex align-items-center justify-content-between"
            style={{ background: '#161b22', border: '1px solid #30363d' }}
          >
            <div className="d-flex align-items-center gap-3">
              <Badge bg={isPaused ? 'warning' : 'success'} className="text-uppercase">
                {isPaused ? 'Paused' : 'Live'}
              </Badge>
              <span className="small">
                <i className="bi bi-clock me-1" />
                {Math.floor(timeRemaining / 60)}:
                {String(timeRemaining % 60).padStart(2, '0')}
              </span>
              <span className="small text-muted">
                Phase: <span className="text-light">{currentPhase || '—'}</span>
              </span>
              {currentSpeaker && (
                <span className="small text-muted">
                  Speaker: <span className="text-light">{currentSpeaker}</span>
                </span>
              )}
            </div>
          </div>
        </main>

        {/* Right — chat */}
        <aside
          className="d-flex flex-column"
          style={{ width: 340, background: '#161b22', borderLeft: '1px solid #30363d' }}
        >
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #30363d' }}>
            <h6 className="mb-0">
              <i className="bi bi-chat-dots me-2" />
              {TEAM_LABELS[team]} Chat
            </h6>
          </div>
          <div className="flex-grow-1 overflow-auto p-3" style={{ minHeight: 0 }}>
            {!joined && (
              <div className="text-center text-muted small py-3">
                <Spinner animation="border" size="sm" /> Joining…
              </div>
            )}
            {joined && messages.length === 0 && (
              <div className="text-center text-muted small py-3 fst-italic">
                No messages yet. Be the first to speak.
              </div>
            )}
            {messages.map((msg: ChatMessage) => {
              const isOwn = msg.senderId === user?._id;
              const isSystem = msg.senderId === 'system';
              if (isSystem) {
                return (
                  <div
                    key={msg._id}
                    className="small fst-italic text-center text-muted py-1"
                  >
                    {msg.content}
                  </div>
                );
              }
              return (
                <div
                  key={msg._id}
                  className="mb-2"
                  style={{
                    textAlign: isOwn ? 'right' : 'left',
                  }}
                >
                  <div
                    className="d-inline-block px-3 py-2 rounded-3"
                    style={{
                      maxWidth: '85%',
                      background: isOwn ? '#1f6feb' : '#21262d',
                      color: '#e6edf3',
                    }}
                  >
                    <div className="d-flex align-items-baseline gap-2">
                      <strong className="small">{msg.senderName}</strong>
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="small">{msg.content}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <Form
            onSubmit={handleSend}
            className="d-flex gap-2 p-2"
            style={{ borderTop: '1px solid #30363d' }}
          >
            <Form.Control
              type="text"
              size="sm"
              placeholder="Message your team…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              style={{ background: '#0d1117', color: '#e6edf3', border: '1px solid #30363d' }}
              disabled={!joined}
            />
            <Button type="submit" size="sm" disabled={!chatInput.trim() || !joined}>
              <i className="bi bi-send" />
            </Button>
          </Form>
        </aside>
      </div>

      {/* Bottom control bar */}
      <footer
        className="d-flex align-items-center justify-content-center gap-3 py-3"
        style={{ background: '#161b22', borderTop: '1px solid #30363d' }}
      >
        {micActive ? (
          <Button variant="danger" onClick={stopMic}>
            <i className="bi bi-mic-mute-fill me-2" />
            Mute
          </Button>
        ) : (
          <Button variant="success" onClick={startMic}>
            <i className="bi bi-mic-fill me-2" />
            Unmute
          </Button>
        )}
        {cameraActive ? (
          <Button variant="danger" onClick={stopCamera}>
            <i className="bi bi-camera-video-off-fill me-2" />
            Camera off
          </Button>
        ) : (
          <Button variant="info" onClick={startCamera}>
            <i className="bi bi-camera-video-fill me-2" />
            Camera on
          </Button>
        )}
        <Button variant="outline-light" onClick={() => navigate(`/debate/${roomId}`)}>
          <i className="bi bi-box-arrow-left me-2" />
          Leave room
        </Button>
      </footer>
    </div>
  );
}
