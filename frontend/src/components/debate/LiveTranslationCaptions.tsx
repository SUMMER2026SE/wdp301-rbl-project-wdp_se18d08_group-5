import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ButtonGroup, Card } from 'react-bootstrap';
import { getSocket } from '@hooks/useSocket';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';
import type { RoomParticipant } from '@/types';

export type CaptionMode = 'original' | 'translate';
type CaptionKind = 'source' | 'translation';

type CaptionPayload = {
  roomId: string;
  senderId: string;
  senderName: string;
  kind: CaptionKind;
  language: string;
  text: string;
  timestamp: string;
};

type LiveCaption = CaptionPayload & { id: string };

interface LiveTranslationCaptionsProps {
  roomId: string;
  captionMode: CaptionMode;
  onCaptionModeChange: (mode: CaptionMode) => void;
  onOwnSourceTranscript?: (text: string) => void;
}

function languageLabel(language: string) {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('vi')) return 'Vietnamese';
  if (normalized.startsWith('en')) return 'English';
  return language.toUpperCase() || 'Detected language';
}

function participantLabel(participant?: RoomParticipant) {
  if (!participant) return 'Participant';
  if (participant.roomRole === 'host' || participant.roomRole === 'owner') return 'Host';
  if (participant.roomRole === 'judge') return 'Judge';
  if (participant.team === 'proposition') return participant.speakerSlot ? `Proposition ${participant.speakerSlot}` : 'Proposition';
  if (participant.team === 'opposition') return participant.speakerSlot ? `Opposition ${participant.speakerSlot}` : 'Opposition';
  return participant.roomRole;
}

function mergeCaptionText(previous: string | undefined, incoming: string) {
  const next = incoming.trim();
  const current = previous?.trim();
  if (!current) return next;
  if (!next) return current;
  if (next.startsWith(current) || current.includes(next)) return next.startsWith(current) ? next : current;
  return `${current} ${next}`.slice(-1400);
}

/** Shared speech-chat panel. Speakers broadcast both original and translated text; each browser chooses what to show. */
export function LiveTranslationCaptions({
  roomId,
  captionMode,
  onCaptionModeChange,
  onOwnSourceTranscript,
}: LiveTranslationCaptionsProps) {
  const userId = useAuthStore((state) => state.user?._id);
  const participants = useDebateStore((state) => state.participants);
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const ownSourceTranscriptRef = useRef('');

  useEffect(() => {
    ownSourceTranscriptRef.current = '';
    setCaptions([]);
  }, [roomId]);

  useEffect(() => {
    let retryTimer: number | null = null;
    let socket = getSocket();

    const handleCaption = (payload: CaptionPayload) => {
      if (payload.roomId !== roomId || !payload.text?.trim()) return;

      const trimmedText = payload.text.trim();
      const id = `${payload.senderId}:${payload.kind}:${payload.language || 'und'}`;

      if (payload.senderId === userId && payload.kind === 'source') {
        ownSourceTranscriptRef.current = mergeCaptionText(ownSourceTranscriptRef.current, trimmedText);
        onOwnSourceTranscript?.(ownSourceTranscriptRef.current);
      }

      setCaptions((current) => {
        const existing = current.find((item) => item.id === id);
        const nextCaption: LiveCaption = {
          ...payload,
          id,
          text: mergeCaptionText(existing?.text, trimmedText),
          timestamp: payload.timestamp || new Date().toISOString(),
        };
        const withoutCurrent = current.filter((item) => item.id !== id);
        return [nextCaption, ...withoutCurrent].slice(0, 12);
      });
    };

    const attach = () => {
      socket = getSocket();
      if (!socket) {
        retryTimer = window.setTimeout(attach, 300);
        return;
      }
      socket.on('translation:caption', handleCaption);
    };

    attach();
    return () => {
      if (retryTimer) window.clearTimeout(retryTimer);
      socket?.off('translation:caption', handleCaption);
    };
  }, [onOwnSourceTranscript, roomId, userId]);

  const displayedCaptions = useMemo(
    () =>
      captions
        .filter((caption) => caption.senderId !== userId)
        .filter((caption) => (captionMode === 'original' ? caption.kind === 'source' : caption.kind === 'translation'))
        .slice(0, 8),
    [captionMode, captions, userId],
  );

  const hasOtherSpeech = captions.some((caption) => caption.senderId !== userId);
  const modeDescription =
    captionMode === 'original'
      ? 'Original mode: Vietnamese stays Vietnamese, English stays English.'
      : 'Translate mode: Vietnamese becomes English, English becomes Vietnamese.';

  return (
    <Card className="flex-shrink-0 mb-3 border-info border-opacity-25" style={{ background: 'rgba(7, 20, 30, 0.88)' }}>
      <Card.Body className="py-2 px-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-chat-square-quote text-neon-cyan" />
            <span className="small fw-bold text-uppercase" style={{ fontFamily: 'Orbitron', fontSize: '10px', letterSpacing: '0.07em' }}>
              Speech chat / live captions
            </span>
          </div>
          <ButtonGroup size="sm">
            <Button
              variant={captionMode === 'original' ? 'info' : 'outline-info'}
              onClick={() => onCaptionModeChange('original')}
              style={{ fontFamily: 'Orbitron', fontSize: '9px' }}
            >
              Original
            </Button>
            <Button
              variant={captionMode === 'translate' ? 'info' : 'outline-info'}
              onClick={() => onCaptionModeChange('translate')}
              style={{ fontFamily: 'Orbitron', fontSize: '9px' }}
            >
              Translate VI &lt;-&gt; EN
            </Button>
          </ButtonGroup>
        </div>

        <div className="text-muted mb-2" style={{ fontSize: '11px' }}>
          {modeDescription}
        </div>

        {displayedCaptions.length ? (
          <div className="d-grid gap-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
            {displayedCaptions.map((caption) => {
              const participant = participants.find((item) => item.userId === caption.senderId);
              const isOwn = caption.senderId === userId;

              return (
                <div
                  key={caption.id}
                  className="small border-start border-2 border-info border-opacity-50 ps-2 py-1"
                  style={{ background: isOwn ? 'rgba(0, 245, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)' }}
                >
                  <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <strong>{isOwn ? 'You' : caption.senderName}</strong>
                    <Badge bg={isOwn ? 'primary' : 'dark'}>{participantLabel(participant)}</Badge>
                    <Badge bg={caption.kind === 'translation' ? 'secondary' : 'info'}>
                      {caption.kind === 'translation' ? 'TRANSLATION' : 'ORIGINAL'} - {languageLabel(caption.language)}
                    </Badge>
                  </div>
                  <div className="text-white">{caption.text}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="small text-muted">
            {hasOtherSpeech && captionMode === 'translate'
              ? 'Original speech was detected. Waiting for Gemini to return the translated line...'
              : 'When another host, debater, judge, or allowed speaker talks, their speech text will appear here.'}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
