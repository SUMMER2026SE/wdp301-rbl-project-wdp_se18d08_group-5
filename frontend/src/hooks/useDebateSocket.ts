import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from './useSocket';
import { useDebateStore } from '@stores/debateStore';
import type { ChatMessage, DebatePhase, RoomParticipant, SpeakerTurn } from '@/types';

/**
 * Listen to debate-specific socket events and update store.
 */
export function useDebateSocket(roomId: string | undefined) {
  const { t } = useTranslation('errors');
  const {
    setPhase,
    setSpeaker,
    setTimeRemaining,
    setPaused,
    setCEState,
    addMessage,
    setParticipants,
    setScore,
  } = useDebateStore();

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) return;

    // Phase change
    socket.on('debate:phase-change', (data: { phase: DebatePhase }) => {
      setPhase(data.phase);
    });

    // Turn change
    socket.on('debate:turn-change', (data: { speaker: SpeakerTurn }) => {
      setSpeaker(data.speaker);
    });

    // Timer update (every second)
    socket.on('debate:timer-update', (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
    });

    // Pause/Resume
    socket.on('debate:paused', () => setPaused(true));
    socket.on('debate:resumed', () => setPaused(false));

    // Cross Examination
    socket.on('cross-exam:update', (data: Partial<ReturnType<typeof useDebateStore.getState>['ceState']>) => {
      setCEState(data);
    });

    // Chat
    socket.on('chat:message', (message: ChatMessage) => {
      addMessage(message);
    });

    // Participants
    socket.on('room:participant-update', (data: { participants: RoomParticipant[] }) => {
      setParticipants(data.participants);
    });

    // Score
    socket.on('score:updated', (data: { speaker: string; score: ReturnType<typeof useDebateStore.getState>['scores'][string] }) => {
      setScore(data.speaker, data.score);
    });

    // Card issued
    socket.on('debate:card-issued', (data: { type: string; userId: string; reason: string }) => {
      const cardLabel = data.type === 'yellow' ? t('yellowCard') : t('redCard');

      addMessage({
        _id: Date.now().toString(),
        roomId,
        senderId: 'system',
        senderName: t('system'),
        senderRole: 'host',
        content: `⚠️ ${cardLabel}: ${data.reason}`,
        type: 'system',
        isToxic: false,
        timestamp: new Date().toISOString(),
      });
    });

    return () => {
      socket.off('debate:phase-change');
      socket.off('debate:turn-change');
      socket.off('debate:timer-update');
      socket.off('debate:paused');
      socket.off('debate:resumed');
      socket.off('cross-exam:update');
      socket.off('chat:message');
      socket.off('room:participant-update');
      socket.off('score:updated');
      socket.off('debate:card-issued');
    };
  }, [addMessage, roomId, setCEState, setParticipants, setPaused, setPhase, setScore, setSpeaker, setTimeRemaining, t]);
}
