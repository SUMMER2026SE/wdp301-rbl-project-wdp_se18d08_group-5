import { Button as RBButton } from 'react-bootstrap';
const Button = RBButton as any;
import type { RoomParticipant, Team } from '@/types';

type PrivateRoomTeam = Team | 'judge';
type ModerationAction = 'mute' | 'unmute';

interface DebateHostControlPanelProps {
  phaseLabel: string;
  roomStatus: string;
  participants: RoomParticipant[];
  roomId: string;
  startDisabled: boolean;
  skipDisabled: boolean;
  controlsPending: boolean;
  cameraPending: boolean;
  micPending: boolean;
  chatPending: boolean;
  onStart: () => void;
  onSkip: () => void;
  onPauseOrResume: () => void;
  onEnd: () => void;
  onToggleCamera: (userId: string, action: ModerationAction) => void;
  onToggleMic: (userId: string, action: ModerationAction) => void;
  onToggleChat: (userId: string, action: ModerationAction) => void;
  onJoinPrivateRoom?: (team: PrivateRoomTeam) => void;
}

interface MiniParticipantProps {
  participant: RoomParticipant;
  cameraPending: boolean;
  micPending: boolean;
  chatPending: boolean;
  onToggleCamera: (userId: string, action: ModerationAction) => void;
  onToggleMic: (userId: string, action: ModerationAction) => void;
  onToggleChat: (userId: string, action: ModerationAction) => void;
}

function MiniParticipant({
  participant,
  cameraPending,
  micPending,
  chatPending,
  onToggleCamera,
  onToggleMic,
  onToggleChat,
}: MiniParticipantProps) {
  const role = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  const isViewer = role === 'viewer';
  const roleLabel = role === 'debater'
    ? `${participant.team === 'proposition' ? 'PRO' : 'OPP'} ${participant.speakerSlot || ''}`
    : String(role || 'viewer').toUpperCase();

  return (
    <li>
      <span className="debate-host-mini-avatar">
        {participant.avatar ? <img src={participant.avatar} alt="" /> : participant.username.charAt(0).toUpperCase()}
      </span>
      <strong title={participant.username}>{participant.username}</strong>
      <small className={`role-${role}`}>{roleLabel}</small>
      <span className="debate-host-mini-statuses" aria-label={`Moderation controls for ${participant.username}`}>
        <button
          type="button"
          disabled={isViewer || cameraPending}
          className={participant.cameraMuted ? 'is-restricted' : ''}
          onClick={() => onToggleCamera(participant.userId, participant.cameraMuted ? 'unmute' : 'mute')}
          title={`${participant.cameraMuted ? 'Enable' : 'Disable'} camera`}
          aria-label={`${participant.cameraMuted ? 'Enable' : 'Disable'} camera for ${participant.username}`}
        >
          <i className={`bi ${participant.cameraMuted ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={isViewer || micPending}
          className={participant.muted ? 'is-restricted' : ''}
          onClick={() => onToggleMic(participant.userId, participant.muted ? 'unmute' : 'mute')}
          title={`${participant.muted ? 'Enable' : 'Disable'} microphone`}
          aria-label={`${participant.muted ? 'Enable' : 'Disable'} microphone for ${participant.username}`}
        >
          <i className={`bi ${participant.muted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          disabled={chatPending}
          className={participant.chatMuted ? 'is-restricted' : ''}
          onClick={() => onToggleChat(participant.userId, participant.chatMuted ? 'unmute' : 'mute')}
          title={`${participant.chatMuted ? 'Enable' : 'Disable'} chat`}
          aria-label={`${participant.chatMuted ? 'Enable' : 'Disable'} chat for ${participant.username}`}
        >
          <i className={`bi ${participant.chatMuted ? 'bi-chat-left-dots' : 'bi-chat-fill'}`} aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}

export function DebateHostControlPanel({
  phaseLabel,
  roomStatus,
  participants,
  roomId,
  startDisabled,
  skipDisabled,
  controlsPending,
  cameraPending,
  micPending,
  chatPending,
  onStart,
  onSkip,
  onPauseOrResume,
  onEnd,
  onToggleCamera,
  onToggleMic,
  onToggleChat,
  onJoinPrivateRoom,
}: DebateHostControlPanelProps) {
  const isPaused = roomStatus === 'paused';
  const privateRooms: Array<{ team: PrivateRoomTeam; label: string; icon: string; tone: string }> = [
    { team: 'proposition', label: 'Proposition', icon: 'bi-arrow-up-circle-fill', tone: 'proposition' },
    { team: 'opposition', label: 'Opposition', icon: 'bi-arrow-down-circle-fill', tone: 'opposition' },
    { team: 'judge', label: 'Judges', icon: 'bi-award-fill', tone: 'judge' },
  ];

  return (
    <aside className="debate-host-control-panel" aria-label="Host control panel">
      <header>
        <span>Host control panel</span>
        <small>{phaseLabel || 'Waiting'}</small>
      </header>
      <div className="debate-host-control-grid">
        <Button className="host-action-start" onClick={onStart} disabled={startDisabled}>
          <i className="bi bi-play-fill" aria-hidden="true" /><span>Start</span>
        </Button>
        <Button className="host-action-skip" onClick={onSkip} disabled={skipDisabled || controlsPending}>
          <i className="bi bi-skip-forward-fill" aria-hidden="true" /><span>Skip</span>
        </Button>
        <Button className="host-action-pause" onClick={onPauseOrResume} disabled={controlsPending}>
          <i className={`bi ${isPaused ? 'bi-play-circle-fill' : 'bi-pause-fill'}`} aria-hidden="true" />
          <span>{isPaused ? 'Resume' : 'Pause'}</span>
        </Button>
        <Button className="host-action-end" onClick={onEnd} disabled={controlsPending}>
          <i className="bi bi-stop-fill" aria-hidden="true" /><span>End</span>
        </Button>
      </div>
      {onJoinPrivateRoom && (
        <section className="debate-host-private-room-picker" aria-label="Private room shortcuts">
          <div>
            <span>Private rooms</span>
            <small>Room #{roomId.slice(-6).toUpperCase()}</small>
          </div>
          <div className="debate-host-private-room-grid">
            {privateRooms.map((room) => (
              <button
                key={room.team}
                type="button"
                className={`tone-${room.tone}`}
                onClick={() => onJoinPrivateRoom(room.team)}
              >
                <i className={`bi ${room.icon}`} aria-hidden="true" />
                <span>{room.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="debate-host-participant-preview">
        <div><span>Participant controls</span><small>{participants.length} total</small></div>
        <ul>
          {participants.map((participant) => (
            <MiniParticipant
              key={participant.userId}
              participant={participant}
              cameraPending={cameraPending}
              micPending={micPending}
              chatPending={chatPending}
              onToggleCamera={onToggleCamera}
              onToggleMic={onToggleMic}
              onToggleChat={onToggleChat}
            />
          ))}
        </ul>
      </section>
    </aside>
  );
}
