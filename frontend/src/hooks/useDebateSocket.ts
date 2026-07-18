import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSocket, useSocket } from './useSocket';
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

interface RoomJoinAck {
  success: boolean;
  message?: string;
  data?: RoomStateRestore;
}

export type DebateSyncStatus = 'idle' | 'connecting' | 'ready' | 'error';

/**
 * Listen to debate-specific socket events and update store.
 * Does NOT manage loading state — each consumer manages that independently.
 */
export function useDebateSocket(roomId: string | undefined) {
  const { t } = useTranslation('errors');
  const userId = useAuthStore((s) => s.user?._id);
  // Use the hook so we re-run listeners when the singleton socket becomes
  // available. Previously we called `getSocket()` once and returned early if
  // it was null — that permanently skipped listener registration when the
  // socket was still mid-connect at mount time.
  const { socket: socketFromHook } = useSocket();
  const [syncStatus, setSyncStatus] = useState<DebateSyncStatus>(roomId ? 'connecting' : 'idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  // Guard the transition interval so duplicate `debate:transition-start`
  // events can't leak running intervals. Must be a top-level hook call —
  // calling useRef inside useEffect violates the Rules of Hooks and causes
  // React to throw "Invalid hook call" on mount, blanking the page.
  const transitionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

    setAIFeedback,
    setAIFinalVerdict,
    setCurrentPrivateRoom,
    addDisconnectedMember,
    removeDisconnectedMember,
    setDisconnectTimerActive,
    setForfeitTeam,
  } = useDebateStore();

  useEffect(() => {
    if (!roomId) {
      setSyncStatus('idle');
      setSyncError(null);
      return;
    }

    // Prefer the socket from the hook so this effect re-runs whenever the
    // singleton becomes available or reconnects. Falls back to getSocket()
    // for environments where the hook hasn't been wired up yet.
    const socket = socketFromHook ?? getSocket();
    if (!socket) {
      setSyncStatus('connecting');
      return;
    }

    let disposed = false;
    let retryCount = 0;
    let retryTimer: number | null = null;
    const registeredListeners: Array<{
      event: string;
      listener: (...args: any[]) => void;
    }> = [];
    const onSocketEvent = (event: string, listener: (...args: any[]) => void) => {
      socket.on(event, listener);
      registeredListeners.push({ event, listener });
    };

    setSyncStatus('connecting');
    setSyncError(null);

    const restoreState = (data: RoomStateRestore) => {
      if (!data?.room || data.room._id !== roomId) return;

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
      const me = data.participants.find((p) => p.userId === userId);
      setSpeakingAllowed(Boolean(me?.speakingAllowed));
      setSyncStatus('ready');
      setSyncError(null);
    };

    const handleRoomError = (data?: { message?: string }) => {
      if (useDebateStore.getState().room?._id === roomId) return;
      setSyncStatus('error');
      setSyncError(data?.message || 'Unable to sync live debate state');
    };

    const handleConnectError = (error: Error) => {
      if (useDebateStore.getState().room?._id === roomId) return;
      setSyncStatus('error');
      setSyncError(error.message || 'Unable to connect to the live debate server');
    };

    // Core room state events
    onSocketEvent('room:joined', restoreState);
    onSocketEvent('room:state-restore', restoreState);
    onSocketEvent('room:error', handleRoomError);
    onSocketEvent('connect_error', handleConnectError);
    onSocketEvent('chat:history', (messages: ChatMessage[]) => {
      setMessages(messages);
    });

    // Auto Mute Transition Countdown Overlay
    // Guard: store the interval ID in a ref so duplicate events can't leak intervals
    onSocketEvent('debate:transition-start', (data: { duration: number; announcement?: string }) => {
      // Clear any stale interval from a previous transition event
      if (transitionIntervalRef.current !== null) {
        clearInterval(transitionIntervalRef.current);
        transitionIntervalRef.current = null;
      }
      // Freeze the displayed timer at 00:00 immediately — matches the rule
      // "Timer reset về 00:00" that happens the moment the popup appears.
      // The server already emits a debate:timer-update with timeRemaining: 0
      // before this event, but we set it explicitly here too so the local
      // ticker can't race and decrement past 0 during the popup.
      setTimeRemaining(0);
      setTransitionState(true, data.duration);
      if (data.announcement) setTransitionAnnouncement(data.announcement);
      window.dispatchEvent(new CustomEvent('debate:force-mute'));
      let remaining = data.duration;
      transitionIntervalRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          if (transitionIntervalRef.current !== null) {
            clearInterval(transitionIntervalRef.current);
            transitionIntervalRef.current = null;
          }
          setTransitionState(false, 0);
        } else {
          setTransitionState(true, remaining);
        }
      }, 1000);
    });

    // Phase Started from Waiting state
    onSocketEvent('debate:phase-started', (data: { phase: DebatePhase; speaker: SpeakerTurn; timeLimit: number }) => {
      setTurnStatus('active');
      setPhase(data.phase);
      setSpeaker(data.speaker);
      setTimeRemaining(data.timeLimit);
      setTotalTime(data.timeLimit);
    });

    // Judge Reactions
    onSocketEvent('judge:reaction', (data: { username: string; type: 'agree' | 'disagree' }) => {
      toast(`${data.username} reacted: ${data.type === 'agree' ? 'Agree' : 'Disagree'}`, {
        icon: data.type === 'agree' ? '👍' : '👎',
      });
      const event = new CustomEvent('judge:reaction-received', { detail: data });
      window.dispatchEvent(event);
    });

    // Prep Phase Consensus
    onSocketEvent('debate:prep-consensus-update', (data: {
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
    onSocketEvent('judge:next-phase-vote-update', (data: {
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
    onSocketEvent('debate:phase-change', (data: { phase: DebatePhase; speaker?: SpeakerTurn; announcement?: string; waitingForHost?: boolean; waitingForJudge?: boolean; phaseStatus?: string }) => {
      setPhase(data.phase);
      if (data.speaker) {
        setSpeaker(data.speaker);
      }
      if (data.announcement) {
        setTransitionAnnouncement(data.announcement);
      }
      // always reset the timer when transitioning into a free / waiting /
      // completed phase — these have no running countdown.
      if (['waiting_s1', 'judge_feedback', 'completed'].includes(data.phase)) {
        setTimeRemaining(0);
        setTotalTime(0);
      }
      // When the new phase arrives while a transition popup is still on
      // screen (e.g. countdown finished), close the popup so the user sees
      // the new phase immediately.
      if (data.phaseStatus === 'active' || data.phaseStatus === 'idle') {
        setTransitionState(false, 0);
      }
    });

    onSocketEvent('debate:match-ready-to-end', (data: { announcement?: string }) => {
      if (data.announcement) {
        setTransitionAnnouncement(data.announcement);
      }
    });


    // AI feedback received during judge feedback phase
    onSocketEvent('debate:ai-feedback', (data: { speaker: string; feedback: AIAnalysis }) => {
      setAIFeedback({ speaker: data.speaker, feedback: data.feedback });
      toast(`AI Feedback for ${data.speaker}`, { icon: '🤖', duration: 5000 });
    });

    // AI feedback display ready (after AI processed)
    onSocketEvent('debate:ai-feedback-received', () => {
      toast('AI feedback is ready!', { icon: '🤖', duration: 3000 });
    });

    // No-host debate ended (auto or manual)
    onSocketEvent('debate:ended', (data: { roomId: string; isAuto?: boolean; verdict?: { winner: string; summary: string } }) => {
      if (data.verdict) {
        setAIFinalVerdict(data.verdict as any);
      }
    });

    // Turn status change
    onSocketEvent('debate:turn-status-change', (data: { turnStatus: string }) => {
      if (data.turnStatus === 'idle') {
        setTurnStatus('waiting_to_start');
      } else if (data.turnStatus === 'active') {
        setTurnStatus('active');
      } else if (data.turnStatus === 'paused') {
        setTurnStatus('paused');
      }
    });

    // Turn change
    onSocketEvent('debate:turn-change', (data: { speaker: SpeakerTurn }) => {
      setSpeaker(data.speaker);
    });

    // Timer update (every second)
    onSocketEvent('debate:timer-update', (data: { timeRemaining: number; totalTime?: number }) => {
      setTimeRemaining(data.timeRemaining);
      if (data.totalTime !== undefined) {
        setTotalTime(data.totalTime);
      }
    });

    // Pause/Resume
    onSocketEvent('debate:paused', (payload?: { pauseType?: 'host' | 'proposition' | 'opposition' | null; pausesUsed?: { proposition: number; opposition: number } }) => {
      setPaused(true);
      if (payload?.pauseType !== undefined) {
        setPauseType(payload.pauseType);
      }
      if (payload?.pausesUsed !== undefined) {
        setPausesUsed(payload.pausesUsed);
      }
    });
    onSocketEvent('debate:resumed', () => {
      setPaused(false);
      setPauseType(null);
    });

    // Cross Examination — shared timer, both teams tick
    onSocketEvent(
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
    onSocketEvent('chat:message', (message: ChatMessage) => {
      addMessage(message);
    });

    onSocketEvent('chat:viewer-chat-updated', (data: { viewerChatEnabled: boolean }) => {
      setViewerChatEnabled(data.viewerChatEnabled);
    });

    // Viewer chat (separate channel)
    onSocketEvent('viewer-chat:message', (message: ChatMessage) => {
      addViewerChatMessage(message);
    });

    onSocketEvent('room:viewer-chat-toggled', (data: { enabled: boolean }) => {
      setViewerChatEnabled(data.enabled);
    });

    // Participants
    onSocketEvent(
      'room:participant-update',
      (data: { participants?: RoomParticipant[]; userId?: string; type?: string }) => {
        if (!data?.participants) return;
        setParticipants(data.participants);
      },
    );

    onSocketEvent(
      'room:host-transferred',
      (data: { hostId: string; participants: RoomParticipant[] }) => {
        setHost(data.hostId, data.participants);
      },
    );

    // Score
    onSocketEvent(
      'score:updated',
      (data: { speaker: string; score: ReturnType<typeof useDebateStore.getState>['scores'][string] }) => {
        setScore(data.speaker, data.score);
      },
    );

    onSocketEvent('ai:turn-judged', (data: { speaker: string; analysis: AIAnalysis }) => {
      setAIAnalysis(data.speaker, data.analysis);
    });

    onSocketEvent('score:aggregate-updated', (data: { finalScores: FinalScores }) => {
      setFinalScores(data.finalScores);
    });

    onSocketEvent('score:winner-determined', (data: WinnerResult) => {
      setWinnerResult(data);
    });

    // Card issued
    onSocketEvent('debate:card-issued', (data: { type: string; userId: string; reason: string }) => {
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
    onSocketEvent('debate:ended', (data: { roomId: string; result?: WinnerResult }) => {
      if (data.result) setWinnerResult(data.result);
      clearDebateRoomFromStorage();
    });

    // Timer events
    onSocketEvent('debate:timer-complete', (_data: { phase: string }) => {
      setTimeRemaining(0);
    });
    onSocketEvent('debate:timer-warning', (data: { timeRemaining: number }) => {
      setTimeRemaining(data.timeRemaining);
    });

    // Cross-exam ended
    onSocketEvent('cross-exam:ended', (data: { scoresAdjustment: Record<string, unknown> }) => {
      console.log('Cross-exam ended:', data);
    });

    // Private room events
    onSocketEvent(
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
    onSocketEvent(
      'private-room:participant-update',
      (data: { team: string; type: string; userId: string; participantCount?: number }) => {
        console.log(`Private room ${data.team} update: ${data.type} - ${data.userId}`);
      },
    );
    onSocketEvent(
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
    onSocketEvent(
      'private-room:left',
      (data: { roomId: string; team: string }) => {
        console.log('Left private room:', data);
        setCurrentPrivateRoom(null);
      },
    );
    onSocketEvent(
      'private-room:error',
      (data: { message: string }) => {
        console.error('Private room error:', data.message);
        toast.error(data.message);
      },
    );

    // Join the room channel — guard against emitting before the socket is
    // connected. If we're mid-reconnect, queue the join on the next
    // 'connect' event so the server is actually subscribed before
    // `room:joined` arrives.
    const emitJoin = () => {
      if (disposed) return;

      setSyncStatus('connecting');
      setSyncError(null);
      socket.timeout(5000).emit(
        'join-room',
        { roomId },
        (timeoutError: Error | null, response?: RoomJoinAck) => {
          if (disposed || useDebateStore.getState().room?._id === roomId) return;

          if (!timeoutError && response?.success) {
            if (response.data) restoreState(response.data);
            return;
          }

          const message = response?.message
            || timeoutError?.message
            || 'Unable to sync live debate state';

          if (retryCount < 2 && socket.connected) {
            retryCount += 1;
            retryTimer = window.setTimeout(emitJoin, retryCount * 1000);
            return;
          }

          setSyncStatus('error');
          setSyncError(message);
        },
      );
    };

    // Re-join whenever the socket connects or reconnects.
    const handleConnect = () => {
      retryCount = 0;
      emitJoin();
    };
    onSocketEvent('connect', handleConnect);

    if (socket.connected) {
      emitJoin();
    }

    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      if (transitionIntervalRef.current !== null) {
        clearInterval(transitionIntervalRef.current);
        transitionIntervalRef.current = null;
      }
      if (socket.connected) {
        socket.emit('leave-room', { roomId });
      }
      registeredListeners.forEach(({ event, listener }) => {
        socket.off(event, listener);
      });
    };
  }, [
    roomId,
    socketFromHook,
    syncAttempt,
    userId,
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
    setPauseType,
    setPausesUsed,
    setPhase,
    setRoom,
    setScore,
    setSpeaker,
    setSpeakingAllowed,
    setTimeRemaining,
    setTotalTime,
    setViewerChatEnabled,
    setWinnerResult,
    setTransitionAnnouncement,
    setTransitionState,
    setTurnStatus,
    setPrepConsensus,
    setPrepConsensusByTeam,
    setJudgeNextPhaseVotes,
    t,
    addDisconnectedMember,
    removeDisconnectedMember,
    setDisconnectTimerActive,
    setForfeitTeam,
    setAIFeedback,
    setAIFinalVerdict,
  ]);

  const retrySync = () => {
    setSyncStatus(roomId ? 'connecting' : 'idle');
    setSyncError(null);
    setSyncAttempt((attempt) => attempt + 1);
  };

  return { syncStatus, syncError, retrySync };
}
