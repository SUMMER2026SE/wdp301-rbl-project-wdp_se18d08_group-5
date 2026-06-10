import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSocket } from './useSocket';
import { useDebateStore } from '@stores/debateStore';
import type {
  AIAnalysis,
  ChatMessage,
  DebatePhase,
  DebateRoom,
  DebateSession,
  FinalScores,
  RoomParticipant,
  SpeakerTurn,
  WinnerResult,
} from '@/types';

interface RoomStateRestore {
  room: DebateRoom;
  session: DebateSession | null;
  participants: RoomParticipant[];
  currentPhase: DebatePhase;
  currentTurn: DebateSession['currentTurn'] | null;
  timeRemaining: number;
  isPaused: boolean;
  messages: ChatMessage[];
  finalScores: FinalScores | null;
  viewerChatEnabled: boolean;
}

/**
 * Listen to debate-specific socket events and update store.
 */
export function useDebateSocket(roomId: string | undefined) {
  const { t } = useTranslation('errors');
  const {
    setRoom,
    setPhase,
    setSpeaker,
    setTimeRemaining,
    setPaused,
    setCEState,
    addMessage,
    setMessages,
    setViewerChatEnabled,
    setParticipants,
    setHost,
    setScore,
    setAIAnalysis,
    setFinalScores,
    setWinnerResult,
  } = useDebateStore();

  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    if (!socket) return;

    const restoreState = (data: RoomStateRestore) => {
      setRoom(data.room);
      setParticipants(data.participants);
      setPhase(data.currentPhase);
      setTimeRemaining(data.timeRemaining);
      setPaused(data.isPaused);
      setMessages(data.messages);
      setViewerChatEnabled(data.viewerChatEnabled);

      if (data.currentTurn?.speaker) {
        setSpeaker(data.currentTurn.speaker);
      }
      if (data.finalScores) {
        setFinalScores(data.finalScores);
      }
    };

    socket.on('room:joined', restoreState);
    socket.on('room:state-restore', restoreState);
    socket.on('chat:history', (messages: ChatMessage[]) => {
      setMessages(messages);
    });

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

    socket.on('chat:viewer-chat-updated', (data: { viewerChatEnabled: boolean }) => {
      setViewerChatEnabled(data.viewerChatEnabled);
    });

    // Participants
    socket.on('room:participant-update', (data: { participants: RoomParticipant[] }) => {
      setParticipants(data.participants);
    });

    socket.on(
      'room:host-transferred',
      (data: { hostId: string; participants: RoomParticipant[] }) => {
        setHost(data.hostId, data.participants);
      },
    );

    // Score
    socket.on('score:updated', (data: { speaker: string; score: ReturnType<typeof useDebateStore.getState>['scores'][string] }) => {
      setScore(data.speaker, data.score);
    });

    socket.on('ai:turn-judged', (data: { speaker: string; analysis: AIAnalysis }) => {
      setAIAnalysis(data.speaker, data.analysis);
    });

    socket.on('score:aggregate-updated', (data: { finalScores: FinalScores }) => {
      setFinalScores(data.finalScores);
    });

    socket.on('score:winner-determined', (data: WinnerResult) => {
      setWinnerResult(data);
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

    socket.emit('join-room', { roomId });

    return () => {
      socket.emit('leave-room', { roomId });
      socket.off('room:joined');
      socket.off('room:state-restore');
      socket.off('chat:history');
      socket.off('debate:phase-change');
      socket.off('debate:turn-change');
      socket.off('debate:timer-update');
      socket.off('debate:paused');
      socket.off('debate:resumed');
      socket.off('cross-exam:update');
      socket.off('chat:message');
      socket.off('chat:viewer-chat-updated');
      socket.off('room:participant-update');
      socket.off('room:host-transferred');
      socket.off('score:updated');
      socket.off('ai:turn-judged');
      socket.off('score:aggregate-updated');
      socket.off('score:winner-determined');
      socket.off('debate:card-issued');
    };
  }, [addMessage, roomId, setAIAnalysis, setCEState, setFinalScores, setHost, setMessages, setParticipants, setPaused, setPhase, setRoom, setScore, setSpeaker, setTimeRemaining, setViewerChatEnabled, setWinnerResult, t]);
}
