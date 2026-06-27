import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';
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
  pauseType?: 'host' | 'proposition' | 'opposition' | null;
  pausesUsed?: {
    proposition: number;
    opposition: number;
  };
  messages: ChatMessage[];
  finalScores: FinalScores | null;
  viewerChatEnabled: boolean;
  prepConsensusReadyUserIds?: string[];
  prepConsensusTotalDebaters?: number;
}

/**
 * Listen to debate-specific socket events and update store.
 * Does NOT manage loading state — each consumer manages that independently.
 */
export function useDebateSocket(roomId: string | undefined) {
  const { t } = useTranslation('errors');
  const user = useAuthStore((s) => s.user);
  const {
    setRoom,
    setPhase,
    setSpeaker,
    setTimeRemaining,
    setTotalTime,
    setPaused,
    setPauseType,
    setPausesUsed,
    setCEState,
    addMessage,
    setMessages,
    setViewerChatEnabled,
    addViewerChatMessage,
    setParticipants,
    setHost,
    setScore,
    setAIAnalysis,
    setFinalScores,
    setWinnerResult,
    addPrivateRoomMessage,
    setTransitionState,
    setTurnStatus,
    setSpeakingAllowed,
    setTransitionAnnouncement,
    setPrepConsensus,
    setPrepConsensusByTeam,
    setJudgeNextPhaseVotes,
    setNoHostS1Ready,
    setAIFeedback,
    setAIFinalVerdict,
    setCurrentPrivateRoom,
    addDisconnectedMember,
    removeDisconnectedMember,
    setDisconnectTimerActive,
    setForfeitTeam,
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
      if (data.pauseType !== undefined) {
        setPauseType(data.pauseType);
      }
      if (data.pausesUsed !== undefined) {
        setPausesUsed(data.pausesUsed);
      }
      setMessages(data.messages);
      setViewerChatEnabled(data.viewerChatEnabled);
      if (data.prepConsensusReadyUserIds !== undefined) {
        setPrepConsensus(data.prepConsensusReadyUserIds, data.prepConsensusTotalDebaters || 2);
      }

      if (data.currentTurn?.speaker) {
        setSpeaker(data.currentTurn.speaker);
      }
      setFinalScores(data.finalScores || null);

      if (data.room?.status === 'completed' || data.room?.status === 'cancelled') {
        clearDebateRoomFromStorage();
      }

      // Sync turnStatus
      if (data.currentTurn?.status) {
        setTurnStatus(data.currentTurn.status as any);
      } else {
        setTurnStatus('active');
      }

      // Sync speakingAllowed
      const me = data.participants.find((p) => p.userId === user?._id);
      setSpeakingAllowed(Boolean(me?.speakingAllowed));
    };

    // Core room state events
    socket.on('room:joined', restoreState);
    socket.on('room:state-restore', restoreState);
    socket.on('chat:history', (messages: ChatMessage[]) => {
      setMessages(messages);
    });

    // Auto Mute Transition Countdown Overlay
    socket.on('debate:transition-start', (data: { duration: number; announcement?: string }) => {
      setTransitionState(true, data.duration);
      if (data.announcement) setTransitionAnnouncement(data.announcement);
      window.dispatchEvent(new CustomEvent('debate:force-mute'));
      let remaining = data.duration;
      const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(interval);
          setTransitionState(false, 0);
        } else {
          setTransitionState(true, remaining);
        }
      }, 1000);
    });

    // Phase Started from Waiting state
    socket.on('debate:phase-started', (data: { phase: DebatePhase; speaker: SpeakerTurn; timeLimit: number }) => {
      setTurnStatus('active');
      setPhase(data.phase);
      setSpeaker(data.speaker);
      setTimeRemaining(data.timeLimit);
      setTotalTime(data.timeLimit);
    });

    // Judge Reactions
    socket.on('judge:reaction', (data: { username: string; type: 'agree' | 'disagree' }) => {
      toast(`${data.username} reacted: ${data.type === 'agree' ? 'Agree' : 'Disagree'}`, {
        icon: data.type === 'agree' ? '👍' : '👎',
      });
      const event = new CustomEvent('judge:reaction-received', { detail: data });
      window.dispatchEvent(event);
    });

    // Prep Phase Consensus
    socket.on('debate:prep-consensus-update', (data: { 
      readyUserIds?: string[]; 
      totalDebaters?: number;
      readyCount?: number;
      propositionReady?: boolean;
      oppositionReady?: boolean;
      propositionVotes?: number;
      oppositionVotes?: number;
      propositionTotal?: number;
      oppositionTotal?: number;
    }) => {
      // Handle both 1v1 and 3v3 consensus updates
      if (data.propositionVotes !== undefined && data.oppositionVotes !== undefined) {
        // 3v3 format - per-team consensus
        if (data.propositionTotal !== undefined) {
          setPrepConsensusByTeam('proposition', data.propositionVotes, data.propositionTotal);
        }
        if (data.oppositionTotal !== undefined) {
          setPrepConsensusByTeam('opposition', data.oppositionVotes || 0, data.oppositionTotal || 0);
        }
      } else {
        // 1v1 format - simple consensus
        setPrepConsensus(data.readyUserIds || [], data.totalDebaters || 0);
      }
    });

    // Judge Next Phase Vote Update (for no-host mode)
    socket.on('judge:next-phase-vote-update', (data: { 
      votedUserIds: string[];
      votedCount: number;
      totalJudges: number;
      allVoted: boolean;
    }) => {
      setJudgeNextPhaseVotes(data.votedUserIds, data.totalJudges);
      toast(`Judge votes: ${data.votedCount}/${data.totalJudges}`, {
        icon: '📋',
        duration: 2000,
      });
    });

    // Phase change with announcement text
    socket.on('debate:phase-change', (data: { phase: DebatePhase; announcement?: string; waitingForHost?: boolean; waitingForJudge?: boolean }) => {
      setPhase(data.phase);
      if (data.announcement) {
        setTransitionAnnouncement(data.announcement);
      }
    });

    socket.on('debate:match-ready-to-end', (data: { announcement?: string }) => {
      if (data.announcement) {
        setTransitionAnnouncement(data.announcement);
      }
    });

    // No-host S1 consensus update
    socket.on('debate:s1-start-update', (data: { readyUserIds: string[]; totalS1: number }) => {
      setNoHostS1Ready(data.readyUserIds);
    });

    // AI feedback received during judge feedback phase
    socket.on('debate:ai-feedback', (data: { speaker: string; feedback: AIAnalysis }) => {
      setAIFeedback({ speaker: data.speaker, feedback: data.feedback });
      toast(`AI Feedback for ${data.speaker}`, { icon: '🤖', duration: 5000 });
    });

    // AI feedback display ready (after AI processed)
    socket.on('debate:ai-feedback-received', () => {
      toast('AI feedback is ready!', { icon: '🤖', duration: 3000 });
    });

    // No-host debate ended (auto or manual)
    socket.on('debate:ended', (data: { roomId: string; isAuto?: boolean; verdict?: { winner: string; summary: string } }) => {
      if (data.verdict) {
        setAIFinalVerdict(data.verdict as any);
      }
    });

    // Turn status change
    socket.on('debate:turn-status-change', (data: { turnStatus: string }) => {
      if (data.turnStatus === 'idle') {
        setTurnStatus('waiting_to_start');
      } else if (data.turnStatus === 'active') {
        setTurnStatus('active');
      } else if (data.turnStatus === 'paused') {
        setTurnStatus('paused');
      }
    });

    // Turn change
    socket.on('debate:turn-change', (data: { speaker: SpeakerTurn }) => {
      setSpeaker(data.speaker);
    });

    // Timer update (every second)
    socket.on('debate:timer-update', (data: { timeRemaining: number; totalTime?: number }) => {
      setTimeRemaining(data.timeRemaining);
      if (data.totalTime !== undefined) {
        setTotalTime(data.totalTime);
      }
    });

    // Pause/Resume
    socket.on('debate:paused', (payload?: { pauseType?: 'host' | 'proposition' | 'opposition' | null; pausesUsed?: { proposition: number; opposition: number } }) => {
      setPaused(true);
      if (payload?.pauseType !== undefined) {
        setPauseType(payload.pauseType);
      }
      if (payload?.pausesUsed !== undefined) {
        setPausesUsed(payload.pausesUsed);
      }
    });
    socket.on('debate:resumed', () => {
      setPaused(false);
      setPauseType(null);
    });

    // Cross Examination — shared timer, both teams tick
    socket.on(
      'cross-exam:update',
      (data: {
        sharedRemaining: number;
        totalSeconds: number;
        questionsPro: number;
        questionsOpp: number;
        quotaPerTeam: number;
        isPaused: boolean;
      }) => {
        setCEState(data);
      },
    );

    // Main debate chat
    socket.on('chat:message', (message: ChatMessage) => {
      addMessage(message);
    });

    socket.on('chat:viewer-chat-updated', (data: { viewerChatEnabled: boolean }) => {
      setViewerChatEnabled(data.viewerChatEnabled);
    });

    // Viewer chat (separate channel)
    socket.on('viewer-chat:message', (message: ChatMessage) => {
      addViewerChatMessage(message);
    });

    socket.on('room:viewer-chat-toggled', (data: { enabled: boolean }) => {
      setViewerChatEnabled(data.enabled);
    });

    // Participants
    socket.on(
      'room:participant-update',
      (data: { participants?: RoomParticipant[]; userId?: string; type?: string }) => {
        if (!data?.participants) return;
        setParticipants(data.participants);
      },
    );

    socket.on(
      'room:host-transferred',
      (data: { hostId: string; participants: RoomParticipant[] }) => {
        setHost(data.hostId, data.participants);
      },
    );

    // Score
    socket.on(
      'score:updated',
      (data: { speaker: string; score: ReturnType<typeof useDebateStore.getState>['scores'][string] }) => {
        setScore(data.speaker, data.score);
      },
    );

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

    // Debate ended
    socket.on('debate:ended', (data: { roomId: string; result?: WinnerResult }) => {
      if (data.result) setWinnerResult(data.result);
      clearDebateRoomFromStorage();
    });

    // Timer events
    socket.on('debate:timer-complete', (_data: { phase: string }) => {
      setTimeRemaining(0);
    });
    socket.on('debate:timer-warning', (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
    });

    // Cross-exam ended
    socket.on('cross-exam:ended', (data: { scoresAdjustment: Record<string, unknown> }) => {
      console.log('Cross-exam ended:', data);
    });

    // Private room events
    socket.on(
      'private-chat:message',
      (message: ChatMessage & { team?: string }) => {
        if (message.team) {
          const key = `${message.roomId}::${message.team}`;
          addPrivateRoomMessage(key, message);
        } else {
          addMessage({ ...message, _id: `priv-${message._id}` });
        }
      },
    );
    socket.on(
      'private-room:participant-update',
      (data: { team: string; type: string; userId: string; participantCount?: number }) => {
        console.log(`Private room ${data.team} update: ${data.type} - ${data.userId}`);
      },
    );
    socket.on(
      'private-room:joined',
      (data: { roomId: string; team: string; participantCount: number; messageHistory?: ChatMessage[] }) => {
        console.log('Joined private room:', data);
        // Set current private room
        setCurrentPrivateRoom(data.team as 'proposition' | 'opposition' | 'judge');
        // Load message history if available
        if (data.messageHistory && Array.isArray(data.messageHistory)) {
          const key = `${data.roomId}::${data.team}`;
          data.messageHistory.forEach((msg) => {
            addPrivateRoomMessage(key, { ...msg, team: data.team } as ChatMessage & { team?: string });
          });
        }
      },
    );
    socket.on(
      'private-room:left',
      (data: { roomId: string; team: string }) => {
        console.log('Left private room:', data);
        setCurrentPrivateRoom(null);
      },
    );
    socket.on(
      'private-room:error',
      (data: { message: string }) => {
        console.error('Private room error:', data.message);
        toast.error(data.message);
      },
    );

    // Join the room channel
    socket.emit('join-room', { roomId });

    // Re-join whenever the socket reconnects
    const handleConnect = () => {
      socket.emit('join-room', { roomId });
    };
    socket.on('connect', handleConnect);

    return () => {
      socket.emit('leave-room', { roomId });
      socket.off('connect', handleConnect);
      socket.off('room:joined');
      socket.off('room:state-restore');
      socket.off('chat:history');
      socket.off('debate:transition-start');
      socket.off('debate:phase-started');
      socket.off('judge:reaction');
      socket.off('debate:prep-consensus-update');
      socket.off('debate:phase-change');
      socket.off('debate:turn-status-change');
      socket.off('debate:turn-change');
      socket.off('debate:timer-update');
      socket.off('debate:timer-complete');
      socket.off('debate:timer-warning');
      socket.off('debate:paused');
      socket.off('debate:resumed');
      socket.off('cross-exam:update');
      socket.off('cross-exam:ended');
      socket.off('chat:message');
      socket.off('chat:viewer-chat-updated');
      socket.off('viewer-chat:message');
      socket.off('room:viewer-chat-toggled');
      socket.off('room:participant-update');
      socket.off('room:host-transferred');
      socket.off('score:updated');
      socket.off('ai:turn-judged');
      socket.off('score:aggregate-updated');
      socket.off('score:winner-determined');
      socket.off('debate:card-issued');
      socket.off('debate:ended');
      socket.off('debate:participant-disconnected');
      socket.off('debate:participant-reconnected');
      socket.off('debate:disconnect-timer-start');
      socket.off('debate:disconnect-timer-cancelled');
      socket.off('debate:team-forfeited');
      socket.off('private-chat:message');
      socket.off('private-room:participant-update');
      socket.off('private-room:joined');
      socket.off('private-room:left');
      socket.off('private-room:error');
    };
  }, [
    roomId,
    addMessage,
    addPrivateRoomMessage,
    addViewerChatMessage,
    setAIAnalysis,
    setCEState,
    setCurrentPrivateRoom,
    setFinalScores,
    setHost,
    setMessages,
    setParticipants,
    setPaused,
    setPhase,
    setRoom,
    setScore,
    setSpeaker,
    setTimeRemaining,
    setTotalTime,
    setViewerChatEnabled,
    setWinnerResult,
    setTransitionAnnouncement,
    setPrepConsensus,
    setPrepConsensusByTeam,
    setJudgeNextPhaseVotes,
    t,
    addDisconnectedMember,
    removeDisconnectedMember,
    setDisconnectTimerActive,
    setForfeitTeam,
  ]);
}
