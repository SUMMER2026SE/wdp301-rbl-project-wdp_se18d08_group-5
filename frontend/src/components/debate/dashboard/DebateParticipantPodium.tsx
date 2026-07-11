import type { RoomParticipant, SpeakerSlot, SpeakerTurn } from '@/types';
import { DebateParticipantCard } from './DebateParticipantCard';

interface DebateParticipantPodiumProps {
  participants: RoomParticipant[];
  format: '1v1' | '3v3';
  currentSpeaker: SpeakerTurn | string | null;
  localUserId?: string;
  localStream?: MediaStream | null;
  localCameraActive?: boolean;
  remoteStreamsByUserId?: Map<string, MediaStream>;
}

function effectiveRole(participant: RoomParticipant) {
  return participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
}

function participantForSlot(
  participants: RoomParticipant[],
  team: 'proposition' | 'opposition',
  slot: SpeakerSlot,
) {
  return participants.find((participant) => (
    effectiveRole(participant) === 'debater'
      && participant.team === team
      && participant.speakerSlot === slot
  ));
}

function resolveParticipantId(value: unknown) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const candidate = value as { _id?: unknown; id?: unknown };
  if (typeof candidate._id === 'string') return candidate._id;
  if (typeof candidate.id === 'string') return candidate.id;
  return '';
}

function hasLiveVideoTrack(stream?: MediaStream | null) {
  return Boolean(stream?.getVideoTracks().some((track) => track.readyState === 'live' && track.enabled));
}

export function DebateParticipantPodium({
  participants,
  format,
  currentSpeaker,
  localUserId,
  localStream,
  localCameraActive = false,
  remoteStreamsByUserId,
}: DebateParticipantPodiumProps) {
  const slots: SpeakerSlot[] = format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3'];
  const showLocalVideo = localCameraActive || hasLiveVideoTrack(localStream);
  const getParticipantStream = (participant?: RoomParticipant) => {
    const participantId = resolveParticipantId(participant?.userId);
    const isLocalParticipant = participantId === localUserId;
    const stream = isLocalParticipant ? localStream : remoteStreamsByUserId?.get(participantId) || null;

    return {
      isLocalParticipant,
      stream,
      showStream: isLocalParticipant ? showLocalVideo : hasLiveVideoTrack(stream),
    };
  };
  const officials = participants.filter((participant) => {
    const role = effectiveRole(participant);
    return role === 'host' || role === 'judge';
  });

  return (
    <section className="debate-podium" aria-label="Debate participants">
      <div className="debate-podium-team debate-podium-proposition">
        <header>
          <div>
            <span>Proposition</span>
            <small>Affirmative team</small>
          </div>
          <span className="debate-podium-team-badge">PRO</span>
        </header>
        <div className="debate-podium-member-list">
          {slots.map((slot) => {
            const participant = participantForSlot(participants, 'proposition', slot);
            const camera = getParticipantStream(participant);
            return (
              <DebateParticipantCard
                key={`proposition-${slot}`}
                participant={participant}
                tone="proposition"
                slotLabel={slot}
                isCurrentSpeaker={currentSpeaker === `PRO_${slot}`}
                mediaStream={camera.stream}
                showCameraStream={camera.showStream}
                isLocalCamera={camera.isLocalParticipant}
              />
            );
          })}
        </div>
      </div>

      <div className="debate-podium-team debate-podium-officials">
        <header>
          <div>
            <span>Host &amp; Judges</span>
            <small>Room officials</small>
          </div>
          <span className="debate-podium-team-badge">LIVE</span>
        </header>
        <div className="debate-podium-official-grid">
          {officials.length > 0 ? officials.slice(0, 4).map((participant, index) => {
            const camera = getParticipantStream(participant);
            return (
              <DebateParticipantCard
                key={resolveParticipantId(participant.userId) || participant.username}
                participant={participant}
                tone="official"
                slotLabel={effectiveRole(participant) === 'host' ? 'HOST' : `J${index + 1}`}
                compact
                mediaStream={camera.stream}
                showCameraStream={camera.showStream}
                isLocalCamera={camera.isLocalParticipant}
              />
            );
          }) : (
            <DebateParticipantCard
              tone="official"
              slotLabel="OFFICIAL"
              compact
            />
          )}
        </div>
      </div>

      <div className="debate-podium-team debate-podium-opposition">
        <header>
          <div>
            <span>Opposition</span>
            <small>Negative team</small>
          </div>
          <span className="debate-podium-team-badge">OPP</span>
        </header>
        <div className="debate-podium-member-list">
          {slots.map((slot) => {
            const participant = participantForSlot(participants, 'opposition', slot);
            const camera = getParticipantStream(participant);
            return (
              <DebateParticipantCard
                key={`opposition-${slot}`}
                participant={participant}
                tone="opposition"
                slotLabel={slot}
                isCurrentSpeaker={currentSpeaker === `OPP_${slot}`}
                mediaStream={camera.stream}
                showCameraStream={camera.showStream}
                isLocalCamera={camera.isLocalParticipant}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
