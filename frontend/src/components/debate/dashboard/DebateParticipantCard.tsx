import { useEffect, useRef } from 'react';
import type { RoomParticipant } from '@/types';
import type { TeamTone } from './types';

interface DebateParticipantCardProps {
  participant?: RoomParticipant;
  tone: TeamTone;
  slotLabel: string;
  isCurrentSpeaker?: boolean;
  compact?: boolean;
  mediaStream?: MediaStream | null;
  showCameraStream?: boolean;
  isLocalCamera?: boolean;
}

function getEffectiveRole(participant?: RoomParticipant) {
  if (!participant) return null;
  return participant.roomRole === 'owner' ? participant.primaryRole || 'owner' : participant.roomRole;
}

function getRoleLabel(participant: RoomParticipant | undefined, slotLabel: string) {
  if (!participant) return slotLabel;
  const role = getEffectiveRole(participant);
  if (role === 'host') return 'HOST';
  if (role === 'judge') return 'JUDGE';
  if (role === 'viewer') return 'VIEWER';
  if (participant.team === 'proposition') return `PRO ${participant.speakerSlot || slotLabel}`;
  if (participant.team === 'opposition') return `OPP ${participant.speakerSlot || slotLabel}`;
  return String(role || slotLabel).toUpperCase();
}

function StatusIcon({ enabled, onIcon, offIcon, label }: {
  enabled: boolean;
  onIcon: string;
  offIcon: string;
  label: string;
}) {
  return (
    <span
      className={`debate-participant-status ${enabled ? 'is-enabled' : 'is-disabled'}`}
      title={`${label}: ${enabled ? 'on' : 'off'}`}
      aria-label={`${label}: ${enabled ? 'on' : 'off'}`}
    >
      <i className={`bi ${enabled ? onIcon : offIcon}`} aria-hidden="true" />
    </span>
  );
}

export function DebateParticipantCard({
  participant,
  tone,
  slotLabel,
  isCurrentSpeaker = false,
  compact = false,
  mediaStream = null,
  showCameraStream = false,
  isLocalCamera = false,
}: DebateParticipantCardProps) {
  const roleLabel = getRoleLabel(participant, slotLabel);
  const name = participant?.username || 'Open position';
  const avatar = participant?.avatar;
  const cameraEnabled = Boolean(participant && !participant.cameraMuted);
  const microphoneEnabled = Boolean(participant && !participant.muted);
  const chatEnabled = Boolean(participant && !participant.chatMuted);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shouldShowVideo = Boolean(participant && mediaStream && showCameraStream);
  const videoKey = shouldShowVideo && mediaStream ? `on-${mediaStream.id}` : 'off';

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldShowVideo && mediaStream) {
      if (video.srcObject !== mediaStream) {
        video.srcObject = mediaStream;
      }
      video.play().catch(() => undefined);
    }
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [mediaStream, shouldShowVideo, videoKey]);

  return (
    <article
      className={`debate-participant-card tone-${tone} ${isCurrentSpeaker ? 'is-speaking' : ''} ${compact ? 'is-compact' : ''} ${participant ? '' : 'is-empty'}`}
      aria-label={`${name}, ${roleLabel}`}
    >
      <div className="debate-participant-card-topline">
        <span className="debate-participant-slot">{slotLabel}</span>
        <span className="debate-participant-role">{roleLabel}</span>
      </div>

      <div className="debate-participant-avatar-wrap">
        <div className="debate-participant-avatar">
          {shouldShowVideo ? (
            <video
              key={videoKey}
              ref={videoRef}
              className="debate-participant-local-video"
              autoPlay
              playsInline
              muted={isLocalCamera}
              aria-label={isLocalCamera ? 'Your camera preview' : `${name} camera preview`}
            />
          ) : avatar ? (
            <img src={avatar} alt={`${name} avatar`} />
          ) : (
            <i className="bi bi-person-fill" aria-hidden="true" />
          )}
          {isCurrentSpeaker && <span className="debate-participant-speaking-ring" aria-hidden="true" />}
        </div>
        <span className={`debate-participant-presence ${participant ? 'is-online' : ''}`} aria-hidden="true" />
      </div>

      <div className="debate-participant-copy">
        <strong title={name}>{name}</strong>
        <span>
          {isCurrentSpeaker
            ? 'Speaking now'
            : participant
              ? participant.positionLocked
                ? 'Position locked'
                : 'Ready'
              : 'Waiting for participant'}
        </span>
      </div>

      <div className="debate-participant-statuses">
        <StatusIcon
          enabled={cameraEnabled}
          onIcon="bi-camera-video-fill"
          offIcon="bi-camera-video-off-fill"
          label="Camera"
        />
        <StatusIcon
          enabled={microphoneEnabled}
          onIcon="bi-mic-fill"
          offIcon="bi-mic-mute-fill"
          label="Microphone"
        />
        <StatusIcon
          enabled={chatEnabled}
          onIcon="bi-chat-fill"
          offIcon="bi-chat-left-dots"
          label="Chat"
        />
      </div>
    </article>
  );
}
