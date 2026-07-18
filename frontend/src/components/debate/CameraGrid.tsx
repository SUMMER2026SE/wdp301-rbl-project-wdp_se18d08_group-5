import { useEffect, useMemo, useRef } from 'react';
import { Badge } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useDebateStore } from '@stores/debateStore';
import type { RoomParticipant } from '@/types';

export interface CameraTilePeer {
  socketId: string;
  userId: string;
  stream: MediaStream | null;
}

interface VideoTileProps {
  peer: CameraTilePeer | null;
  participant?: RoomParticipant;
  label: string;
  muted?: boolean;
  isLocal?: boolean;
  localStream?: MediaStream | null;
  fallbackName: string;
  isSpeaking?: boolean;
  isCameraActive?: boolean;
}

const pulseStyles = `
  @keyframes pulse-pro {
    0% { box-shadow: 0 0 0 0px rgba(0, 245, 255, 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(0, 245, 255, 0); }
    100% { box-shadow: 0 0 0 0px rgba(0, 245, 255, 0); }
  }
  @keyframes pulse-opp {
    0% { box-shadow: 0 0 0 0px rgba(255, 75, 75, 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(255, 75, 75, 0); }
    100% { box-shadow: 0 0 0 0px rgba(255, 75, 75, 0); }
  }
  @keyframes pulse-admin {
    0% { box-shadow: 0 0 0 0px rgba(255, 193, 7, 0.7); }
    70% { box-shadow: 0 0 0 6px rgba(255, 193, 7, 0); }
    100% { box-shadow: 0 0 0 0px rgba(255, 193, 7, 0); }
  }
  .speaker-pro {
    border: 2px solid #00f5ff !important;
    animation: pulse-pro 1.5s infinite;
  }
  .speaker-opp {
    border: 2px solid #ff4b4b !important;
    animation: pulse-opp 1.5s infinite;
  }
  .speaker-admin {
    border: 2px solid #ffc107 !important;
    animation: pulse-admin 1.5s infinite;
  }
`;

function isParticipantSpeaking(p?: RoomParticipant, currentSpeaker?: string | null) {
  if (!p || !currentSpeaker) return false;
  const teamPrefix = p.team === 'proposition' ? 'PRO_' : p.team === 'opposition' ? 'OPP_' : '';
  if (!teamPrefix || !p.speakerSlot) return false;
  return `${teamPrefix}${p.speakerSlot}` === currentSpeaker;
}

function VideoTile({
  peer,
  participant,
  label,
  muted = false,
  isLocal = false,
  localStream = null,
  fallbackName,
  isSpeaking = false,
  isCameraActive = false,
}: VideoTileProps) {
  const { t } = useTranslation('common');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const baseStream = isLocal ? localStream : peer?.stream ?? null;
  const stream = isCameraActive ? baseStream : null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
    } else {
      // Explicitly clear to release frozen frame
      video.srcObject = null;
    }
  }, [stream]);

  const avatar = participant?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=0d1117&color=e6edf3`;

  const getSpeakerClass = () => {
    if (!isSpeaking) return '';
    if (participant?.team === 'proposition') return 'speaker-pro';
    if (participant?.team === 'opposition') return 'speaker-opp';
    return 'speaker-admin';
  };

  const roleLabel = (() => {
    if (!participant) return null;
    const role = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
    if (role === 'host') return 'Host';
    if (role === 'judge') return 'Judge';
    if (participant.speakerSlot) {
      return `${participant.team === 'proposition' ? 'PRO' : 'OPP'} ${participant.speakerSlot}`;
    }
    return null;
  })();

  return (
    <div
      className={`position-relative rounded-3 overflow-hidden ${getSpeakerClass()}`}
      style={{
        background: '#0d1117',
        border: isSpeaking ? 'none' : '1px solid #30363d',
        minHeight: 120,
        aspectRatio: '16 / 9',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}
    >
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
        />
      ) : (
        <div className="d-flex flex-column align-items-center justify-content-center h-100">
          <img
            src={avatar}
            alt={fallbackName}
            className="rounded-circle mb-2"
            width={48}
            height={48}
          />
          <div className="small text-muted" style={{ fontSize: '0.75rem' }}>
            <i className="bi bi-camera-video-off me-1" />
            Camera off
          </div>
        </div>
      )}

      {/* Label and Muted Indicator */}
      <div
        className="position-absolute d-flex align-items-center gap-1.5 px-2 py-0.5"
        style={{ left: 8, bottom: 8, background: 'rgba(0,0,0,0.65)', borderRadius: 6, zIndex: 2 }}
      >
        <span className="text-light" style={{ fontSize: '0.7rem' }}>{label}</span>
        {muted && <Badge bg="danger" pill className="ms-1" style={{ fontSize: '0.5rem', padding: '0.15em 0.4em' }}>{t('components.cameraGrid.muted')}</Badge>}
        {isLocal && <Badge bg="primary" pill className="ms-1" style={{ fontSize: '0.5rem', padding: '0.15em 0.4em' }}>{t('components.cameraGrid.you')}</Badge>}
      </div>

      {/* Role Badge */}
      {roleLabel && (
        <div
          className="position-absolute px-1.5 py-0.5 rounded-2 font-monospace text-uppercase"
          style={{
            right: 8,
            top: 8,
            background: 'rgba(0,0,0,0.65)',
            color: participant?.team === 'proposition' ? '#00f5ff' : participant?.team === 'opposition' ? '#ff4b4b' : '#ffc107',
            fontSize: '0.55rem',
            border: `1px solid ${participant?.team === 'proposition' ? 'rgba(0,245,255,0.3)' : participant?.team === 'opposition' ? 'rgba(255,75,75,0.3)' : 'rgba(255,193,7,0.3)'}`,
            letterSpacing: '0.05em',
            zIndex: 2,
          }}
        >
          {roleLabel}
        </div>
      )}
    </div>
  );
}

interface CameraGridProps {
  peers: CameraTilePeer[];
  participants: RoomParticipant[];
  localUserId?: string;
  localUsername?: string;
  localStream: MediaStream | null;
  localMuted?: boolean;
  resolveUserId: (peer: CameraTilePeer) => string;
}

export function CameraGrid({
  peers,
  participants,
  localUserId,
  localStream,
  localMuted = false,
  resolveUserId,
}: CameraGridProps) {
  const { t } = useTranslation('common');
  const currentSpeaker = useDebateStore((s) => s.currentSpeaker);
  const cameraActiveMap = useDebateStore((s) => s.cameraActive);

  const gridParticipants = useMemo(() => {
    return participants.filter((p) => {
      const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
      return role !== 'viewer';
    });
  }, [participants]);

  const hasProposition = useMemo(() => gridParticipants.some((p) => p.team === 'proposition'), [gridParticipants]);
  const hasOpposition = useMemo(() => gridParticipants.some((p) => p.team === 'opposition'), [gridParticipants]);
  const hasMultipleTeams = hasProposition && hasOpposition;

  const renderTile = (p: RoomParticipant) => {
    const isMe = p.userId === localUserId;
    const peer = isMe ? null : peers.find((pr) => resolveUserId(pr) === p.userId) || null;
    const isMuted = isMe ? localMuted : p.muted;
    const isSpeaking = isParticipantSpeaking(p, currentSpeaker);
    const isCameraActive = Boolean(cameraActiveMap[p.userId]);

    return (
      <VideoTile
        key={p.userId}
        peer={peer}
        participant={p}
        label={p.username}
        muted={isMuted}
        isLocal={isMe}
        localStream={localStream}
        fallbackName={p.username}
        isSpeaking={isSpeaking}
        isCameraActive={isCameraActive}
      />
    );
  };

  if (!hasMultipleTeams) {
    // Single room view (e.g. private room) — render standard fluid grid
    return (
      <>
        <style>{pulseStyles}</style>
        <div className="row g-2">
          {gridParticipants.map((p) => (
            <div key={p.userId} className="col-12 col-sm-6 col-md-4 col-lg-3">
              {renderTile(p)}
            </div>
          ))}
        </div>
      </>
    );
  }

  // 3-Column Split Layout (Proposition | Admin/Host/Judges | Opposition)
  const proParticipants = gridParticipants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'debater' && p.team === 'proposition';
  });
  const oppParticipants = gridParticipants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'debater' && p.team === 'opposition';
  });
  const adminParticipants = gridParticipants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'host' || role === 'judge';
  });

  return (
    <>
      <style>{pulseStyles}</style>
      <div className="row g-3">
        {/* Proposition Section */}
        <div className="col-12 col-md-4">
          <div
            className="p-2.5 rounded-3 h-100"
            style={{
              background: 'rgba(0, 245, 255, 0.015)',
              border: '1px solid rgba(0, 245, 255, 0.08)',
            }}
          >
            <h6
              className="text-center mb-2.5 small text-uppercase fw-semibold"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
                color: '#00f5ff',
                textShadow: '0 0 6px rgba(0, 245, 255, 0.25)',
              }}
            >
              <i className="bi bi-arrow-up-circle me-1.5" />
              Proposition
            </h6>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {proParticipants.map((p) => (
                <div key={p.userId} style={{ flex: '1 1 180px', maxWidth: '280px' }}>
                  {renderTile(p)}
                </div>
              ))}
              {proParticipants.length === 0 && (
                <div className="text-muted small fst-italic py-3">{t('common:components.cameraGrid.noProposition')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Host & Judges Section */}
        <div className="col-12 col-md-4">
          <div
            className="p-2.5 rounded-3 h-100"
            style={{
              background: 'rgba(255, 193, 7, 0.015)',
              border: '1px solid rgba(255, 193, 7, 0.08)',
            }}
          >
            <h6
              className="text-center mb-2.5 small text-uppercase fw-semibold"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
                color: '#ffc107',
                textShadow: '0 0 6px rgba(255, 193, 7, 0.25)',
              }}
            >
              <i className="bi bi-shield-shaded me-1.5" />
              Host & Judges
            </h6>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {adminParticipants.map((p) => (
                <div key={p.userId} style={{ flex: '1 1 180px', maxWidth: '280px' }}>
                  {renderTile(p)}
                </div>
              ))}
              {adminParticipants.length === 0 && (
                <div className="text-muted small fst-italic py-3">{t('common:components.cameraGrid.noHostOrJudges')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Opposition Section */}
        <div className="col-12 col-md-4">
          <div
            className="p-2.5 rounded-3 h-100"
            style={{
              background: 'rgba(255, 75, 75, 0.015)',
              border: '1px solid rgba(255, 75, 75, 0.08)',
            }}
          >
            <h6
              className="text-center mb-2.5 small text-uppercase fw-semibold"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: '0.1em',
                color: '#ff4b4b',
                textShadow: '0 0 6px rgba(255, 75, 75, 0.25)',
              }}
            >
              <i className="bi bi-arrow-down-circle me-1.5" />
              Opposition
            </h6>
            <div className="d-flex flex-wrap gap-2 justify-content-center">
              {oppParticipants.map((p) => (
                <div key={p.userId} style={{ flex: '1 1 180px', maxWidth: '280px' }}>
                  {renderTile(p)}
                </div>
              ))}
              {oppParticipants.length === 0 && (
                <div className="text-muted small fst-italic py-3">{t('common:components.cameraGrid.noOpposition')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
