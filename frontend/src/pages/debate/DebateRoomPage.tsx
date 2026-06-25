import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  ListGroup,
  ProgressBar,
  Row,
  Spinner,
  Modal,
} from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { debateService } from '@services/debateService';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';
import { useDebateSocket } from '@hooks/useDebateSocket';
import { useSocket } from '@hooks/useSocket';
import { CountdownTimer } from '@components/debate/CountdownTimer';
import { CrossExamPanel } from '@components/debate/CrossExamPanel';
import { MicToggle } from '@components/debate/MicToggle';
import { LiveTranslationCaptions, type CaptionMode } from '@components/debate/LiveTranslationCaptions';
import { PrivateRoomPanel } from '@components/debate/PrivateRoomPanel';
import { MainRoomChat } from '@components/chat/MainRoomChat';
import { ViewerChat } from '@components/chat/ViewerChat';
import { ReconnectOverlay } from '@components/common/ReconnectOverlay';
import { PauseOverlay } from '@components/debate/PauseOverlay';
import type {
  RoomParticipant,
  ScoreBreakdown,
  SpeakerTurn,
  SpeakerSlot,
  Team,
} from '@/types';


const scoreFields: Array<{ key: keyof Omit<ScoreBreakdown, 'overall'>; max: number }> = [
  { key: 'logic', max: 30 },
  { key: 'rebuttal', max: 20 },
  { key: 'evidence', max: 15 },
  { key: 'crossExam', max: 15 },
  { key: 'strategy', max: 10 },
  { key: 'communication', max: 10 },
];

const speakerTurns: SpeakerTurn[] = [
  'PRO_S1', 'OPP_S1', 'PRO_S2', 'OPP_S2', 'PRO_S3', 'OPP_S3',
];

type DebateWorkflowStep = {
  speaker: string;
  phase: string;
  label: string;
  detail: string;
};

const debateWorkflow: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Host announces the topic' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Pro S1', detail: 'Opening constructive speech' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp S1', detail: 'Opening opposition speech' },
  { speaker: 'PRO_CE_1', phase: 'cross_exam', label: 'Pro CE 1', detail: 'Proposition questions opposition' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Pro S2', detail: 'Extension and rebuttal' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp S2', detail: 'Extension and rebuttal' },
  { speaker: 'OPP_CE_1', phase: 'cross_exam', label: 'Opp CE 1', detail: 'Opposition questions proposition' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Pro S3', detail: 'Final speaker summary' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp S3', detail: 'Final speaker summary' },
  { speaker: 'PRO_CE_2', phase: 'cross_exam', label: 'Pro CE 2', detail: 'Final cross-exam exchange' },
  { speaker: 'JUDGES', phase: 'judge_feedback', label: 'Judge Feedback', detail: 'Judges review key clashes' },
  { speaker: 'BOTH_TEAMS', phase: 'prep_1', label: 'Final Prep', detail: 'Teams prepare closing' },
  { speaker: 'PRO_CLOSE', phase: 'closing', label: 'Pro Closing', detail: 'Proposition closing statement' },
  { speaker: 'OPP_CLOSE', phase: 'closing', label: 'Opp Closing', detail: 'Opposition closing statement' },
  { speaker: 'JUDGES', phase: 'final_judging', label: 'Final Judging', detail: 'Judges submit final decision' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Result is announced' },
];

export default function DebateRoomPage() {
  const { roomId = '' } = useParams();
  const { t } = useTranslation('common');
  useSocket();
  useDebateSocket(roomId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [scoreSpeaker, setScoreSpeaker] = useState<SpeakerTurn>('PRO_S1');
  const [scoreWinner, setScoreWinner] = useState<Team | 'draw'>('proposition');
  const [notes, setNotes] = useState('');
  const [turnTranscript, setTurnTranscript] = useState('');
  const [captionMode, setCaptionMode] = useState<CaptionMode>(() => {
    const saved = window.localStorage.getItem('debate-caption-mode');
    return saved === 'translate' ? 'translate' : 'original';
  });
  const lastNotifiedDrawRequestRef = useRef<string | null>(null);

  const [activeReactions, setActiveReactions] = useState<Array<{ id: number; username: string; type: 'agree' | 'disagree' }>>([]);
  useEffect(() => {
    window.localStorage.setItem('debate-caption-mode', captionMode);
  }, [captionMode]);

  useEffect(() => {
    const handleReaction = (e: Event) => {
      const data = (e as CustomEvent).detail;
      const reactionId = Date.now() + Math.random();
      setActiveReactions((prev) => [...prev, { id: reactionId, username: data.username, type: data.type }]);
      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== reactionId));
      }, 3000);
    };
    window.addEventListener('judge:reaction-received', handleReaction);
    return () => window.removeEventListener('judge:reaction-received', handleReaction);
  }, []);

  // Snapshot the time remaining at the moment the host pauses the debate.
  // We capture it locally so the pause overlay shows a frozen clock that
  // matches the value held by the server-authoritative timer.
  const [pausedAtRemaining, setPausedAtRemaining] = useState<number | undefined>(undefined);
  useEffect(() => {
    // Lazy import to avoid pulling socket into the SSR bundle.
    import('@hooks/useSocket').then(({ getSocket: gs }) => {
      const socket = gs();
      if (!socket) return;
      const onPaused = (data: { timeRemaining?: number }) => {
        if (typeof data?.timeRemaining === 'number') {
          setPausedAtRemaining(data.timeRemaining);
        } else {
          // Fallback: snapshot the current live value.
          const current = useDebateStore.getState().timeRemaining;
          setPausedAtRemaining(current);
        }
      };
      const onResumed = () => {
        setPausedAtRemaining(undefined);
      };
      socket.on('debate:paused', onPaused);
      socket.on('debate:resumed', onResumed);
      return () => {
        socket.off('debate:paused', onPaused);
        socket.off('debate:resumed', onResumed);
      };
    }).catch(() => {
      /* noop — overlay simply won't show in the unlikely case this fails */
    });
  }, [roomId]);

  const [showRules, setShowRules] = useState(false);

  // Track when socket has sent us authoritative room state.
  // We DON'T rely on registering a listener here (race condition: the
  // 'room:joined' event may have already fired before this effect ran).
  // Instead, we check directly from the store — `useDebateSocket` populates
  // `room` as soon as the server sends state. Reset on roomId change so
  // navigating between debates shows the loading state again.
  const roomFromStore = useDebateStore((s) => s.room);
  const socketReady = Boolean(roomFromStore && roomFromStore._id === roomId);

  // When the user navigates to a different room (roomId changes), reset stale
  // store state so the loading spinner shows again and the new socket can
  // populate fresh data. Skip the very first mount so we don't wipe the
  // store before the initial socket fetch lands.
  const resetStore = useDebateStore((s) => s.reset);
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    // roomId changed — wipe stale data
    resetStore();
  }, [roomId, resetStore]);

  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(scoreFields.map((f) => [f.key, Math.round(f.max * 0.7)])),
  );

  // Smooth local countdown: every second, decrement the store time so the
  // timer on the host's screen never freezes between server broadcasts. The
  // server-authoritative `debate:timer-update` will re-sync the value if it
  // drifts. We pause locally when the debate is paused.
  const timeRemaining = useDebateStore((s) => s.timeRemaining);
  const isPausedStore = useDebateStore((s) => s.isPaused);
  const setTimeRemainingStore = useDebateStore((s) => s.setTimeRemaining);
  useEffect(() => {
    if (isPausedStore) return;
    if (!timeRemaining || timeRemaining <= 0) return;
    const id = window.setInterval(() => {
      const current = useDebateStore.getState().timeRemaining;
      if (current > 0) {
        setTimeRemainingStore(current - 1);
      } else {
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPausedStore, timeRemaining > 0, setTimeRemainingStore]);

  // Store state
  const currentPhase = useDebateStore((s) => s.currentPhase);
  const currentSpeaker = useDebateStore((s) => s.currentSpeaker);
  const totalTime = useDebateStore((s) => s.totalTime);
  const isPaused = useDebateStore((s) => s.isPaused);
  const messages = useDebateStore((s) => s.messages);
  const isTransitioning = useDebateStore((s) => s.isTransitioning);
  const transitionTime = useDebateStore((s) => s.transitionTime);
  const turnStatus = useDebateStore((s) => s.turnStatus);
  const speakingAllowed = useDebateStore((s) => s.speakingAllowed);
  const prepConsensusReadyUserIds = useDebateStore((s) => s.prepConsensusReadyUserIds);
  const prepConsensusTotalDebaters = useDebateStore((s) => s.prepConsensusTotalDebaters);

  // Local loading state (not used — socketReady is derived from store above)
  // Kept for backwards compatibility; intentionally unused now.

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 8000,
  });

  const sessionQuery = useQuery({
    queryKey: ['debate-session', roomId],
    queryFn: async () => (await debateService.getSession(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 5000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['room', roomId] });
    queryClient.invalidateQueries({ queryKey: ['debate-session', roomId] });
  };

  const controlMutation = useMutation({
    mutationFn: (action: 'next' | 'finish' | 'passCe' | 'finishCe' | 'pause' | 'resume' | 'end') => {
      if (action === 'next') return roomService.nextTurnWithTranscript(roomId, { transcript: turnTranscript });
      if (action === 'finish') return debateService.finishPhase(roomId, turnTranscript);
      if (action === 'passCe') return roomService.passCrossExamWithTranscript(roomId, { transcript: turnTranscript });
      if (action === 'finishCe') return debateService.finishCe(roomId, turnTranscript);
      if (action === 'pause') return debateService.pause(roomId);
      if (action === 'resume') return debateService.resume(roomId);
      return debateService.end(roomId);
    },
    onSuccess: () => {
      toast.success('Debate updated');
      setTurnTranscript('');
      invalidate();
    },
    onError: () => toast.error('Action failed'),
  });

  const startPhaseMutation = useMutation({
    mutationFn: () => roomService.startPhase(roomId),
    onSuccess: () => {
      toast.success('Phase started');
      invalidate();
    },
    onError: () => toast.error('Could not start phase'),
  });

  const grantSpeakingMutation = useMutation({
    mutationFn: (userId: string) => roomService.grantSpeaking(roomId, userId),
    onSuccess: () => {
      toast.success('Granted speaking permission');
      invalidate();
    },
    onError: () => toast.error('Failed to grant permission'),
  });

  const revokeSpeakingMutation = useMutation({
    mutationFn: (userId: string) => roomService.revokeSpeaking(roomId, userId),
    onSuccess: () => {
      toast.success('Revoked speaking permission');
      invalidate();
    },
    onError: () => toast.error('Failed to revoke permission'),
  });

  const toggleMicMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'mute' | 'unmute' }) =>
      roomService.muteParticipant(roomId, userId, action),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'mute' ? 'Microphone muted' : 'Microphone unmuted');
      invalidate();
    },
    onError: () => toast.error('Failed to change microphone state'),
  });

  const toggleChatMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'mute' | 'unmute' }) =>
      roomService.muteChat(roomId, userId, action),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'mute' ? 'Chat banned' : 'Chat allowed');
      invalidate();
    },
    onError: () => toast.error('Failed to change chat state'),
  });

  const scoreMutation = useMutation({
    mutationFn: () =>
      roomService.submitJudgeScore(roomId, {
        speaker: scoreSpeaker,
        logic: scores.logic,
        rebuttal: scores.rebuttal,
        evidence: scores.evidence,
        crossExam: scores.crossExam,
        strategy: scores.strategy,
        communication: scores.communication,
        winner: scoreWinner,
        notes,
      }),
    onSuccess: () => {
      toast.success('Score submitted');
      setNotes('');
      invalidate();
    },
    onError: () => toast.error('Could not submit score'),
  });

  const playerActionMutation = useMutation({
    mutationFn: (action: 'surrender' | 'draw') => {
      if (action === 'surrender') return debateService.surrender(roomId);
      return debateService.requestDraw(roomId);
    },
    onSuccess: (_response, action) => {
      toast.success(action === 'surrender' ? 'Surrender submitted' : 'Draw request sent');
      invalidate();
    },
    onError: () => toast.error('Action failed'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => roomService.leave(roomId),
    onSuccess: () => {
      toast.success('Left debate room');
      navigate('/matches');
    },
    onError: () => navigate('/matches'),
  });



  const aggregateMutation = useMutation({
    mutationFn: () => roomService.aggregateScores(roomId),
    onSuccess: () => {
      toast.success('Scores aggregated');
      invalidate();
    },
    onError: () => toast.error('Could not aggregate scores'),
  });

  const winnerMutation = useMutation({
    mutationFn: () => roomService.determineWinner(roomId),
    onSuccess: () => {
      toast.success('Winner determined');
      invalidate();
    },
    onError: () => toast.error('Could not determine winner'),
  });

  const room = roomQuery.data;
  const session = sessionQuery.data;

  const isParticipant = useMemo(() => {
    return Boolean(room?.participants.some((p) => p.userId === user?._id));
  }, [room?.participants, user?._id]);

  useEffect(() => {
    if (!room || !user || isParticipant || isJoining) return;

    if (room.isPrivate) {
      setShowPasswordPrompt(true);
    } else {
      setIsJoining(true);
      const loadId = toast.loading('Joining debate as spectator...');
      roomService.join(room._id)
        .then(() => {
          toast.success('Joined as spectator', { id: loadId });
          invalidate();
        })
        .catch(() => {
          toast.error('Could not join debate room', { id: loadId });
        })
        .finally(() => {
          setIsJoining(false);
        });
    }
  }, [room, user, isParticipant, isJoining, roomId]);

  const handlePrivateJoin = (e: FormEvent) => {
    e.preventDefault();
    if (!roomId) return;
    setIsJoining(true);
    const loadId = toast.loading('Verifying password...');
    roomService.join(roomId, joinPassword)
      .then(() => {
        toast.success('Joined as spectator', { id: loadId });
        setShowPasswordPrompt(false);
        invalidate();
      })
      .catch(() => {
        toast.error('Incorrect password', { id: loadId });
      })
      .finally(() => {
        setIsJoining(false);
      });
  };

  const isController = Boolean(user && room?.hostId === user._id);

  const currentParticipant = room?.participants.find((p) => p.userId === user?._id);
  const canUseDebaterActions =
    currentParticipant?.roomRole === 'debater' && ['active', 'paused'].includes(room?.status || '');
  const isJudge = currentParticipant?.roomRole === 'judge';
  const isViewer = currentParticipant?.roomRole === 'viewer' || !isParticipant;
  const debaters: RoomParticipant[] = room?.participants.filter((p) => p.roomRole === 'debater') || [];
  const judges: RoomParticipant[] = room?.participants.filter((p) => p.roomRole === 'judge') || [];
  const selectedParticipant = room?.participants.find((p) => p.userId === selectedUserId);
  const canManageScores = Boolean(isController || isJudge);

  const pendingDrawRequest = session?.finalScores?.drawRequests?.find((r) => r.status === 'pending');
  const ownTeamPendingDraw = Boolean(
    pendingDrawRequest &&
      currentParticipant?.team &&
      pendingDrawRequest.team === currentParticipant.team,
  );
  const opponentPendingDraw = Boolean(
    pendingDrawRequest &&
      currentParticipant?.team &&
      pendingDrawRequest.team !== currentParticipant.team,
  );

  // Private rooms accessible to all roles (debater, judge, host/owner)
  const myRole = currentParticipant?.roomRole;
  const canAccessPrivateRooms = Boolean(myRole && ['debater', 'judge', 'host', 'owner'].includes(myRole));


  // Speech phase: mic enabled for current speaker
  const currentSpeakerTeam = currentSpeaker?.startsWith('PRO_') ? 'proposition' : 'opposition';
  const isMyTurnToSpeak =
    currentParticipant?.roomRole === 'debater' &&
    currentParticipant?.team === currentSpeakerTeam &&
    currentPhase === 'speech';
  const canUseMicrophone = Boolean(
    currentParticipant &&
      (
        isController ||
        isMyTurnToSpeak ||
        currentParticipant.roomRole === 'debater' ||
        (isViewer && (speakingAllowed || currentParticipant.speakingAllowed))
      ),
  );

  // Gemini's input transcript replaces the browser-only speech recognition
  // as the transcript that is persisted for the active speaker's turn.
  const handleOwnSourceTranscript = useCallback((text: string) => {
    if (isMyTurnToSpeak) setTurnTranscript(text);
  }, [isMyTurnToSpeak]);

  const progress = useMemo(() => {
    if (!totalTime) return 0;
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  }, [timeRemaining, totalTime]);

  useEffect(() => {
    if (!opponentPendingDraw || !pendingDrawRequest) return;
    const requestKey = `${pendingDrawRequest.team}:${pendingDrawRequest.requestedAt}`;
    if (lastNotifiedDrawRequestRef.current === requestKey) return;
    lastNotifiedDrawRequestRef.current = requestKey;
    toast(`${pendingDrawRequest.requestedByName || 'Opponent'} requested a draw`);
  }, [opponentPendingDraw, pendingDrawRequest]);
  
  // Sidebar Tab State
  const [sidebarTab, setSidebarTab] = useState<'scoring' | 'ai' | 'private' | 'viewer-chat'>('scoring');

  useEffect(() => {
    if (isViewer) {
      setSidebarTab('viewer-chat');
    }
  }, [isViewer]);

  // Derived speaker and slot structures
  const speakerLabel = currentSpeaker || session?.currentTurn?.speaker || '—';
  const serverTime = session?.currentTurn?.timeRemaining ?? 0;
  const serverTotal = session?.currentTurn?.timeLimit ?? 0;
  const displayTime = timeRemaining || serverTime;
  const displayTotal = totalTime || serverTotal;

  const currentWorkflowIndex = useMemo(() => {
    const phase = currentPhase || session?.currentTurn?.phase;
    const speaker = currentSpeaker || session?.currentTurn?.speaker;
    if (!phase && !speaker) return -1;

    const exactIndex = debateWorkflow.findIndex(
      (step) => step.speaker === speaker && step.phase === phase,
    );
    if (exactIndex >= 0) return exactIndex;

    const phaseIndex = debateWorkflow.findIndex((step) => step.phase === phase);
    return phaseIndex >= 0 ? phaseIndex : 0;
  }, [currentPhase, currentSpeaker, session?.currentTurn?.phase, session?.currentTurn?.speaker]);

  const currentWorkflowStep = currentWorkflowIndex >= 0 ? debateWorkflow[currentWorkflowIndex] : null;
  const nextWorkflowStep = currentWorkflowIndex >= 0 ? debateWorkflow[currentWorkflowIndex + 1] : debateWorkflow[0];



  const activeSpeakerParticipant = useMemo(() => {
    if (!currentSpeaker || !room) return null;
    const side = currentSpeaker.startsWith('PRO_') ? 'proposition' : 'opposition';
    const slot = currentSpeaker.split('_')[1];
    return room.participants.find((p) => p.team === side && p.speakerSlot === slot);
  }, [currentSpeaker, room]);

  const activeSpeakerName = activeSpeakerParticipant?.username || speakerLabel;

  const slots = useMemo(() => (room?.format === '1v1' ? ['S1'] : ['S1', 'S2', 'S3']) as SpeakerSlot[], [room?.format]);

  // Unified announcements log
  const announcements = useMemo(() => {
    const list: string[] = [];

    // 1. System messages
    messages.forEach((msg) => {
      if (msg.type === 'system' || msg.senderId === 'system') {
        list.push(msg.content);
      }
    });

    // 2. Judge verdicts
    const verdicts = session?.finalScores?.judgeVerdicts || [];
    verdicts.forEach((v) => {
      list.push(`Judge ${v.judgeName || 'assigned'} voted for ${v.winner || 'Draw'} - Note: "${v.notes || 'No comments'}"`);
    });

    // 3. Match completed
    if (session?.finalScores?.winner) {
      list.push(`Debate concluded! Winner: ${session.finalScores.winner.toUpperCase()}`);
    }

    return list;
  }, [messages, session]);

  // Show loading spinner until we have BOTH REST data AND socket state, or if we are actively joining
  const isLoading =
    roomQuery.isLoading ||
    sessionQuery.isLoading ||
    (isParticipant && !socketReady) ||
    isJoining;

  if (isLoading) {
    return (
      <Container fluid className="py-4 text-center">
        <Spinner animation="border" />
        <div className="mt-2 text-muted small">Connecting to debate...</div>
      </Container>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="vh-100 w-100 d-flex flex-column align-items-center justify-content-center text-white" style={{ background: '#0a0a0f', fontFamily: 'Rajdhani, sans-serif' }}>
        <Card style={{ width: '400px', background: 'rgba(15, 15, 25, 0.65)', border: '1px solid rgba(0, 245, 255, 0.25)', boxShadow: '0 0 40px rgba(0,245,255,0.1)', backdropFilter: 'blur(10px)' }} className="p-4 rounded-4 text-center">
          <h3 className="mb-3 text-neon-cyan" style={{ fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>
            <i className="bi bi-shield-lock me-2"></i>
            PRIVATE ARENA
          </h3>
          <p className="text-muted small mb-4">This debate is private. Please enter the password to watch as a spectator.</p>
          <Form onSubmit={handlePrivateJoin}>
            <Form.Group className="mb-3">
              <Form.Control
                type="password"
                placeholder="Enter password..."
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                required
                autoFocus
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}
              />
            </Form.Group>
            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={isJoining || !joinPassword.trim()}>
                {isJoining ? 'Connecting...' : 'Enter Arena'}
              </Button>
              <Button variant="outline-light" onClick={() => navigate('/matches')} disabled={isJoining}>
                Back to Matches
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    );
  }

  if (!room || !session) {
    return (
      <Container className="py-4">
        <Alert variant="warning">Debate session is not available yet.</Alert>
      </Container>
    );
  }

  const phaseLabel = t(`debate.phases.${currentPhase || session.currentTurn?.phase}`, {
    defaultValue: currentPhase || session.currentTurn?.phase || '',
  });

  return (
    <>
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          15% {
            transform: translateY(-20px) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(-120px) scale(0.9);
            opacity: 0;
          }
        }
      `}</style>
      <ReconnectOverlay />
      <PauseOverlay isPaused={isPaused} pausedAtRemaining={pausedAtRemaining} />

      {isTransitioning && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white animate-fade-in"
          style={{
            zIndex: 9999,
            background: 'rgba(5, 5, 10, 0.95)',
            fontFamily: 'Orbitron, sans-serif',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="text-center p-5 rounded-4 border border-info border-opacity-25" style={{ background: 'rgba(15, 15, 25, 0.65)', boxShadow: '0 0 40px rgba(0,245,255,0.1)' }}>
            <h2 className="text-neon-pink mb-3 speaking-pulse" style={{ letterSpacing: '0.1em' }}>AUTO MUTE TRANSITION</h2>
            <div className="fs-1 fw-bold text-neon-cyan mb-2" style={{ textShadow: '0 0 10px #00f5ff' }}>{transitionTime}s</div>
            <div className="text-muted small text-uppercase" style={{ letterSpacing: '0.1em' }}>Muting microphones & locking chat</div>
          </div>
        </div>
      )}

      {/* Floating Judge Reactions */}
      <div className="position-absolute" style={{ bottom: '80px', right: '340px', zIndex: 1050, pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeReactions.map((react) => (
          <div
            key={react.id}
            className="d-flex align-items-center gap-2 p-2 px-3 rounded-pill text-white shadow-lg"
            style={{
              background: 'rgba(10, 10, 20, 0.85)',
              border: react.type === 'agree' ? '1px solid #00f5ff' : '1px solid #ff006e',
              boxShadow: react.type === 'agree' ? '0 0 10px rgba(0, 245, 255, 0.3)' : '0 0 10px rgba(255, 0, 110, 0.3)',
              backdropFilter: 'blur(5px)',
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{react.type === 'agree' ? '👍' : '👎'}</span>
            <span className="small fw-bold">{react.username}</span>
          </div>
        ))}
      </div>

      <div className="vh-100 d-flex flex-column text-white" style={{ background: '#0a0a0f', fontFamily: 'Rajdhani, sans-serif', overflow: 'hidden' }}>
        
        {/* === HEADER PROGRESS LINE === */}
        <div className="flex-shrink-0" style={{ height: '4px', background: 'rgba(255, 255, 255, 0.05)' }}>
          <div
            className="h-100"
            style={{
              width: `${progress}%`,
              background: progress < 20 ? '#ff006e' : progress < 40 ? '#ffd60a' : '#00f5ff',
              boxShadow: progress < 20 ? '0 0 8px #ff006e' : progress < 40 ? '0 0 8px #ffd60a' : '0 0 8px #00f5ff',
              transition: 'width 0.4s linear',
            }}
          />
        </div>

        {/* === MAIN WORKSPACE === */}
        <div className="flex-grow-1 d-flex flex-row overflow-hidden relative">
          
          {/* Main Arena Floor */}
          <div className="flex-grow-1 d-flex flex-column overflow-hidden p-3 gap-3" style={{ minHeight: 0 }}>
            
            {/* Draw request alerts */}
            {opponentPendingDraw && (
              <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 px-3 mb-0 small flex-shrink-0">
                <div>
                  <strong>{pendingDrawRequest?.requestedByName || 'Opponent'}</strong> requested a draw.
                  Accepting will end this debate as a draw.
                </div>
                {canUseDebaterActions && (
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => playerActionMutation.mutate('draw')}
                    disabled={playerActionMutation.isPending}
                    style={{ fontSize: '11px' }}
                  >
                    Accept Draw
                  </Button>
                )}
              </Alert>
            )}

            <LiveTranslationCaptions
              roomId={roomId}
              captionMode={captionMode}
              onCaptionModeChange={setCaptionMode}
              onOwnSourceTranscript={handleOwnSourceTranscript}
            />
            {ownTeamPendingDraw && <Alert variant="info" className="py-2 px-3 mb-0 small flex-shrink-0">Draw request sent. Waiting for opposing team to accept.</Alert>}

            {/* Row 1: Mirrored Teams & Motion/Timer */}
            <div className="flex-shrink-0">
              <Row className="g-3 align-items-stretch">
                
                {/* Left side: Proposition speakers list */}
                <Col xl={3} md={4} className="d-flex flex-column">
                  <div className="text-neon-cyan mb-2" style={{ fontFamily: 'Orbitron', fontSize: '12px', letterSpacing: '0.05em' }}>
                    <i className="bi bi-people-fill text-neon-cyan me-1"></i> PROPOSITION
                  </div>
                  <div className="d-flex flex-column gap-2 flex-grow-1 justify-content-around">
                    {slots.map((slot) => {
                      const participant = debaters.find((p) => p.team === 'proposition' && p.speakerSlot === slot);
                      const expected = `PRO_${slot}`;
                      const isCurrent = speakerLabel === expected;
                      
                      return (
                        <div
                          key={slot}
                          className={`p-2 px-3 rounded-3 d-flex align-items-center gap-3 position-relative ${
                            isCurrent ? 'glass-card border-neon' : 'bg-secondary bg-opacity-10 border border-secondary border-opacity-25'
                          }`}
                          style={{
                            borderTop: isCurrent ? '2px solid #00f5ff' : undefined,
                            boxShadow: isCurrent ? '0 0 20px rgba(0, 245, 255, 0.15)' : undefined,
                            opacity: isCurrent ? 1 : 0.65,
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle border"
                            style={{
                              width: '32px',
                              height: '32px',
                              background: isCurrent ? 'rgba(0, 245, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              borderColor: isCurrent ? 'rgba(0, 245, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <i className={`bi bi-person-fill ${isCurrent ? 'text-neon-cyan' : 'text-muted'}`} style={{ fontSize: '1rem' }}></i>
                          </div>
                          <div>
                            <p className="font-weight-bold mb-0 text-white" style={{ fontSize: '13px' }}>
                              {participant ? participant.username : `Vacant (${slot})`}
                            </p>
                            <p className="mb-0 text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.05em', color: isCurrent ? '#00f5ff' : 'var(--text-muted)' }}>
                              {isCurrent ? 'SPEAKING' : participant ? 'WAITING' : 'VACANT'}
                            </p>
                          </div>
                          {isCurrent && (
                            <div className="position-absolute" style={{ right: '12px', top: '12px' }}>
                              <i className="bi bi-mic-fill text-neon-cyan speaking-pulse"></i>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Col>

                {/* Center: Motion & Time countdown header */}
                <Col xl={6} md={4} className="d-flex flex-column justify-content-between align-items-stretch text-center px-4 bg-secondary bg-opacity-5 rounded-3 border border-secondary border-opacity-10 py-2">
                  <div className="w-100 d-flex justify-content-between align-items-start gap-2">
                    <h2 className="m-0 text-muted text-start" style={{ fontFamily: 'Orbitron', fontSize: '13px', lineHeight: '1.4' }}>
                      &ldquo;{room.motion}&rdquo;
                    </h2>
                    <div className="d-flex align-items-center gap-1.5 flex-shrink-0">
                      {canAccessPrivateRooms && (
                        <Button
                          size="sm"
                          variant="outline-warning"
                          onClick={() => setSidebarTab('private')}
                          style={{ fontSize: '10px', fontFamily: 'Orbitron', padding: '0.15rem 0.4rem' }}
                        >
                          Private Prep
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline-info"
                        onClick={() => setShowRules(true)}
                        style={{ fontSize: '10px', fontFamily: 'Orbitron', padding: '0.15rem 0.4rem' }}
                      >
                        Rules
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-2 w-100 d-flex align-items-center justify-content-between border-top border-secondary border-opacity-20 pt-2">
                    <div className="text-start">
                      <div className="d-flex align-items-center gap-2">
                        <span className="text-neon-cyan text-uppercase fw-bold d-block" style={{ fontSize: '10px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                          {phaseLabel}
                        </span>
                        {isViewer && (
                          <Badge bg="info" className="px-2 py-0.5 text-uppercase" style={{ fontSize: '9px', fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>
                            <i className="bi bi-eye-fill me-1"></i> Spectator View
                          </Badge>
                        )}
                      </div>
                      <span className="text-white small" style={{ fontSize: '11px' }}>
                        Active: {activeSpeakerName} ({speakerLabel})
                      </span>
                    </div>
                    
                    <div className="d-flex align-items-center gap-3">
                      {canUseMicrophone && (
                        <div className="d-flex align-items-center gap-1">
                          <MicToggle
                            roomId={roomId}
                            disabled={isTransitioning || turnStatus === 'waiting_to_start'}
                          />
                        </div>
                      )}
                      <div className="d-flex align-items-center gap-1.5 text-muted px-2 py-1 rounded bg-dark bg-opacity-35 border border-secondary border-opacity-15 me-2" title="Viewer Count" style={{ height: 'fit-content' }}>
                        <i className="bi bi-eye-fill text-neon-cyan"></i>
                        <span className="small fw-bold text-white" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                          {(room?.participants || []).filter((p: any) => p.roomRole === 'viewer').length}
                        </span>
                      </div>
                      <div className="text-white text-end font-weight-bold" style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.8rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                        <CountdownTimer
                          timeRemaining={displayTime}
                          totalTime={displayTotal}
                          isPaused={isPaused}
                        />
                      </div>
                    </div>
                  </div>
                </Col>

                {/* Right side: Opposition speakers list */}
                <Col xl={3} md={4} className="d-flex flex-column text-end">
                  <div className="text-neon-pink mb-2" style={{ fontFamily: 'Orbitron', fontSize: '12px', letterSpacing: '0.05em' }}>
                    OPPOSITION <i className="bi bi-people-fill text-neon-pink ms-1"></i>
                  </div>
                  <div className="d-flex flex-column gap-2 flex-grow-1 justify-content-around">
                    {slots.map((slot) => {
                      const participant = debaters.find((p) => p.team === 'opposition' && p.speakerSlot === slot);
                      const expected = `OPP_${slot}`;
                      const isCurrent = speakerLabel === expected;
                      
                      return (
                        <div
                          key={slot}
                          className={`p-2 px-3 rounded-3 d-flex align-items-center gap-3 justify-content-end text-end position-relative ${
                            isCurrent ? 'glass-card' : 'bg-secondary bg-opacity-10 border border-secondary border-opacity-25'
                          }`}
                          style={{
                            borderTop: isCurrent ? '2px solid #ff006e' : undefined,
                            boxShadow: isCurrent ? '0 0 20px rgba(255, 0, 110, 0.15)' : undefined,
                            borderColor: isCurrent ? '#ff006e' : undefined,
                            opacity: isCurrent ? 1 : 0.65,
                          }}
                        >
                          <div>
                            <p className="font-weight-bold mb-0 text-white" style={{ fontSize: '13px' }}>
                              {participant ? participant.username : `Vacant (${slot})`}
                            </p>
                            <p className="mb-0 text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.05em', color: isCurrent ? '#ff006e' : 'var(--text-muted)' }}>
                              {isCurrent ? 'SPEAKING' : participant ? 'WAITING' : 'VACANT'}
                            </p>
                          </div>
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle border"
                            style={{
                              width: '32px',
                              height: '32px',
                              background: isCurrent ? 'rgba(255, 0, 110, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              borderColor: isCurrent ? 'rgba(255, 0, 110, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <i className={`bi bi-person-fill ${isCurrent ? 'text-neon-pink' : 'text-muted'}`} style={{ fontSize: '1rem' }}></i>
                          </div>
                          {isCurrent && (
                            <div className="position-absolute" style={{ left: '12px', top: '12px' }}>
                              <i className="bi bi-mic-fill text-neon-pink speaking-pulse"></i>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Col>

              </Row>
            </div>

            {/* Row 2: Debate workflow + Host/Judge announcements */}
            <Row className="g-3 flex-shrink-0 overflow-hidden" style={{ height: 'clamp(260px, 34vh, 340px)', minHeight: 0 }}>
              <Col xs={6} className="d-flex h-100 overflow-hidden" style={{ minHeight: 0 }}>
                <div className="flex-grow-1 h-100 d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-3 border border-secondary border-opacity-10 p-3" style={{ minHeight: 0 }}>
                  <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                    <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.08em', fontFamily: 'Orbitron' }}>
                      <i className="bi bi-diagram-3-fill me-1"></i> Debate Workflow
                    </span>
                    <Badge bg="secondary" className="small" style={{ fontSize: '9px' }}>
                      {currentWorkflowIndex >= 0 ? `${currentWorkflowIndex + 1}/${debateWorkflow.length}` : 'Pending'}
                    </Badge>
                  </div>

                  <div className="d-flex gap-2 mb-2 flex-shrink-0">
                    <div className="flex-grow-1 rounded-2 border border-info border-opacity-25 bg-info bg-opacity-10 p-2">
                      <div className="text-neon-cyan text-uppercase fw-bold mb-1" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>Now</div>
                      <div className="fw-bold text-white" style={{ fontSize: '13px' }}>{currentWorkflowStep?.label || phaseLabel || 'Waiting'}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{activeSpeakerName}</div>
                    </div>
                    <div className="flex-grow-1 rounded-2 border border-warning border-opacity-25 bg-warning bg-opacity-10 p-2">
                      <div className="text-neon-yellow text-uppercase fw-bold mb-1" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>Next</div>
                      <div className="fw-bold text-white" style={{ fontSize: '13px' }}>{nextWorkflowStep?.label || 'Result'}</div>
                      <div className="text-muted" style={{ fontSize: '11px' }}>{nextWorkflowStep?.detail || 'Debate complete'}</div>
                    </div>
                  </div>

                  <div
                    className="flex-grow-1 pe-2"
                    style={{
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      overscrollBehavior: 'contain',
                      pointerEvents: 'auto',
                      touchAction: 'pan-y',
                      scrollbarColor: 'rgba(0, 245, 255, 0.65) rgba(255, 255, 255, 0.08)',
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {debateWorkflow.map((step, idx) => {
                      const isDone = currentWorkflowIndex > idx;
                      const isActive = currentWorkflowIndex === idx;
                      const isNext = currentWorkflowIndex + 1 === idx;

                      return (
                        <div key={`${step.speaker}-${step.phase}-${idx}`} className="d-flex gap-2 pb-2">
                          <div className="d-flex flex-column align-items-center flex-shrink-0" style={{ width: '18px' }}>
                            <div
                              className="d-flex align-items-center justify-content-center rounded-circle border"
                              style={{
                                width: '18px',
                                height: '18px',
                                fontSize: '9px',
                                background: isActive ? '#00f5ff' : isDone ? '#198754' : isNext ? 'rgba(255, 214, 10, 0.2)' : 'rgba(255,255,255,0.04)',
                                borderColor: isActive ? '#00f5ff' : isDone ? '#198754' : isNext ? '#ffd60a' : 'rgba(255,255,255,0.18)',
                                color: isActive ? '#050812' : '#ffffff',
                                boxShadow: isActive ? '0 0 10px rgba(0,245,255,0.55)' : 'none',
                              }}
                            >
                              {isDone ? <i className="bi bi-check" /> : idx + 1}
                            </div>
                            {idx < debateWorkflow.length - 1 && (
                              <div
                                className="flex-grow-1"
                                style={{
                                  width: '1px',
                                  minHeight: '12px',
                                  background: isDone ? 'rgba(25,135,84,0.65)' : 'rgba(255,255,255,0.12)',
                                }}
                              />
                            )}
                          </div>
                          <div
                            className="flex-grow-1 rounded-2 border px-2 py-1"
                            style={{
                              background: isActive
                                ? 'rgba(0, 245, 255, 0.12)'
                                : isNext
                                  ? 'rgba(255, 214, 10, 0.08)'
                                  : 'rgba(255,255,255,0.03)',
                              borderColor: isActive
                                ? 'rgba(0,245,255,0.4)'
                                : isNext
                                  ? 'rgba(255,214,10,0.28)'
                                  : 'rgba(255,255,255,0.1)',
                              opacity: isDone ? 0.68 : 1,
                            }}
                          >
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <span className={isActive ? 'text-neon-cyan fw-bold' : 'text-white fw-semibold'} style={{ fontSize: '12px' }}>
                                {step.label}
                              </span>
                              <Badge bg={isActive ? 'info' : isNext ? 'warning' : isDone ? 'success' : 'secondary'} text={isNext ? 'dark' : undefined} style={{ fontSize: '8px' }}>
                                {isActive ? 'Current' : isNext ? 'Next' : isDone ? 'Done' : step.phase}
                              </Badge>
                            </div>
                            <div className="text-muted" style={{ fontSize: '10px' }}>{step.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Col>

              <Col xs={6} className="d-flex h-100 overflow-hidden" style={{ minHeight: 0 }}>
                <div className="flex-grow-1 h-100 d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-3 border border-secondary border-opacity-10 p-3" style={{ minHeight: 0 }}>
                  <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                    <span className="text-neon-yellow text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.08em', fontFamily: 'Orbitron' }}>
                      <i className="bi bi-bell-fill me-1"></i> Host & Judge Feed
                    </span>
                    <Badge bg="secondary" className="small" style={{ fontSize: '9px' }}>Announcements</Badge>
                  </div>

                  <div
                    className="flex-grow-1 space-y-2 pe-2"
                    style={{
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      overscrollBehavior: 'contain',
                      pointerEvents: 'auto',
                      touchAction: 'pan-y',
                      scrollbarColor: 'rgba(255, 214, 10, 0.65) rgba(255, 255, 255, 0.08)',
                      scrollbarWidth: 'thin',
                    }}
                  >
                    {announcements.length === 0 ? (
                      <p className="text-muted small italic text-center py-3">No system notifications yet.</p>
                    ) : (
                      announcements.map((ann, idx) => (
                        <div key={idx} className="p-2 mb-1 bg-secondary bg-opacity-10 border border-secondary border-opacity-25 rounded small text-white" style={{ fontSize: '12px' }}>
                          <i className="bi bi-info-circle text-neon-yellow me-2"></i>
                          {ann}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Col>
            </Row>

            {/* Row 3: Inside Match Chat Box */}
            <div className="flex-grow-1 d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-3 border border-secondary border-opacity-10 p-3" style={{ minHeight: '180px' }}>
              <div className="d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
                <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.08em', fontFamily: 'Orbitron' }}>
                  <i className="bi bi-chat-dots-fill me-1"></i> Match Chat
                </span>
              </div>
              <div className="flex-grow-1 overflow-hidden" style={{ minHeight: 0 }}>
                <MainRoomChat roomId={roomId} />
              </div>
            </div>

            {/* Inline Cross Exam details below the chat if CE matches */}
            {currentPhase === 'cross_exam' && (
              <div className="flex-shrink-0">
                <CrossExamPanel roomId={roomId} />
              </div>
            )}

            {/* Row 4: Assigned Judges Badge List */}
            <div className="flex-shrink-0 bg-secondary bg-opacity-5 rounded-3 border border-secondary border-opacity-10 px-3 py-2">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                  Assigned Judges
                </span>
                <div className="d-flex gap-2">
                  {judges.length ? (
                    judges.map((j) => (
                      <Badge key={j.userId} bg="dark" className="border border-secondary border-opacity-25 text-white py-1 px-2" style={{ fontSize: '10px' }}>
                        <i className="bi bi-patch-check-fill text-neon-yellow me-1"></i>
                        {j.username}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted small">No judges assigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom: Dedicated Host Controls Bar */}
            {isController && (
              <div className="flex-shrink-0 bg-dark bg-opacity-50 border border-neon border-opacity-50 rounded-3 p-2.5 mt-1">
                <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                    <span className="text-neon-purple font-weight-bold me-2" style={{ fontSize: '11px', fontFamily: 'Orbitron' }}>HOST ACTIONS:</span>
                    {turnStatus === 'waiting_to_start' ? (
                      <Button
                        size="sm"
                        className="py-1 px-3 me-2"
                        style={{
                          background: '#00ff66',
                          color: '#000',
                          border: 'none',
                          boxShadow: '0 0 12px #00ff66',
                          fontWeight: 'bold',
                          fontSize: '11px',
                        }}
                        onClick={() => startPhaseMutation.mutate()}
                        disabled={startPhaseMutation.isPending}
                      >
                        Start Phase
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline-primary" className="py-1 px-3 me-2" onClick={() => controlMutation.mutate('finish')} disabled={controlMutation.isPending} style={{ fontSize: '11px' }}>
                        Finish Phase
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline-warning"
                      className="py-1 px-2"
                      onClick={() => controlMutation.mutate(room.status === 'paused' ? 'resume' : 'pause')}
                      disabled={controlMutation.isPending}
                      style={{ fontSize: '11px' }}
                    >
                      {room.status === 'paused' ? 'Resume' : 'Pause'}
                    </Button>
                    <Button size="sm" variant="outline-danger" className="py-1 px-2" onClick={() => controlMutation.mutate('end')} disabled={controlMutation.isPending} style={{ fontSize: '11px' }}>
                      End Match
                    </Button>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <Form.Select size="sm" style={{ width: '130px', fontSize: '11px', padding: '0.25rem 0.5rem' }} value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                      <option value="">Select User...</option>
                      {room.participants.map((p) => (
                        <option key={p.userId} value={p.userId}>{p.username} ({p.roomRole})</option>
                      ))}
                    </Form.Select>
                    {selectedParticipant && (
                      <>
                        <Button
                          size="sm"
                          variant={selectedParticipant.chatMuted ? 'success' : 'outline-danger'}
                          className="py-1 px-2 text-nowrap"
                          style={{ fontSize: '10px' }}
                          disabled={toggleChatMutation.isPending}
                          onClick={() => toggleChatMutation.mutate({
                            userId: selectedUserId,
                            action: selectedParticipant.chatMuted ? 'unmute' : 'mute',
                          })}
                        >
                          {selectedParticipant.chatMuted ? 'Allow Chat' : 'Ban Chat'}
                        </Button>
                        <Button
                          size="sm"
                          variant={selectedParticipant.muted ? 'success' : 'outline-danger'}
                          className="py-1 px-2 text-nowrap"
                          style={{ fontSize: '10px' }}
                          disabled={toggleMicMutation.isPending}
                          onClick={() => toggleMicMutation.mutate({
                            userId: selectedUserId,
                            action: selectedParticipant.muted ? 'unmute' : 'mute',
                          })}
                        >
                          {selectedParticipant.muted ? 'Unmute Mic' : 'Mute Mic'}
                        </Button>
                        {selectedParticipant.roomRole === 'viewer' && (
                          selectedParticipant.speakingAllowed ? (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              className="py-1 px-2 text-nowrap"
                              style={{ fontSize: '10px' }}
                              onClick={() => revokeSpeakingMutation.mutate(selectedUserId)}
                              disabled={revokeSpeakingMutation.isPending}
                            >
                              Mute Viewer
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline-success"
                              className="py-1 px-2 text-nowrap"
                              style={{ fontSize: '10px' }}
                              onClick={() => grantSpeakingMutation.mutate(selectedUserId)}
                              disabled={grantSpeakingMutation.isPending}
                            >
                              Allow Speak
                            </Button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom: Dedicated Debater quick-actions bar */}
            {canUseDebaterActions && (
              <div className="flex-shrink-0 bg-dark bg-opacity-30 border border-secondary border-opacity-20 rounded-3 p-2 mt-1 text-center">
                <span className="text-muted small me-2" style={{ fontFamily: 'Orbitron', fontSize: '11px' }}>MATCH ACTIONS:</span>
                
                {currentPhase === 'prep_7' && (
                  <Button
                    size="sm"
                    variant="success"
                    className="py-1 px-3 me-2"
                    style={{ fontSize: '11px', boxShadow: '0 0 8px rgba(40, 167, 69, 0.4)' }}
                    onClick={() => {
                      import('@hooks/useSocket').then(({ getSocket }) => {
                        getSocket()?.emit('debate:end-prep-early', { roomId });
                      });
                    }}
                    disabled={prepConsensusReadyUserIds.includes(user?._id || '')}
                  >
                    {prepConsensusReadyUserIds.includes(user?._id || '') 
                      ? `Ready (${prepConsensusReadyUserIds.length}/${prepConsensusTotalDebaters || debaters.length})`
                      : `End Prep early (${prepConsensusReadyUserIds.length}/${prepConsensusTotalDebaters || debaters.length})`}
                  </Button>
                )}

                {turnStatus === 'active' && currentPhase === 'speech' && isMyTurnToSpeak && (
                  <Button
                    size="sm"
                    variant="neon-pink"
                    className="py-1 px-3 me-2"
                    style={{ fontSize: '11px', background: '#ff006e', color: '#fff', border: 'none', boxShadow: '0 0 10px #ff006e' }}
                    onClick={() => controlMutation.mutate('finish')}
                    disabled={controlMutation.isPending || isTransitioning}
                  >
                    End Phase
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline-danger"
                  className="py-1 px-3 me-2"
                  onClick={() => { if (window.confirm('Surrender this debate?')) playerActionMutation.mutate('surrender'); }}
                  disabled={playerActionMutation.isPending}
                  style={{ fontSize: '11px' }}
                >
                  Surrender
                </Button>
                <Button
                  size="sm"
                  variant="outline-info"
                  className="py-1 px-3"
                  onClick={() => playerActionMutation.mutate('draw')}
                  disabled={playerActionMutation.isPending}
                  style={{ fontSize: '11px' }}
                >
                  Offer Draw
                </Button>
              </div>
            )}

            {/* Bottom: Dedicated Viewer/Leave Quick actions */}
            {(room.status === 'completed' || isViewer || isJudge) && (
              <div className="flex-shrink-0 text-center mt-1">
                <Button
                  size="sm"
                  variant="outline-light"
                  onClick={() => leaveMutation.mutate()}
                  disabled={leaveMutation.isPending}
                  style={{ fontSize: '11px', padding: '0.25rem 1rem' }}
                >
                  Leave Arena
                </Button>
              </div>
            )}

          </div>

          {/* === RIGHT SIDEBAR (Control Panel - "bảng điều khiển") === */}
          <aside className="d-flex flex-column border-start flex-shrink-0 h-100 overflow-hidden" style={{ width: '320px', minWidth: '320px', background: 'rgba(18, 18, 31, 0.65)', backdropFilter: 'blur(10px)' }}>
            
            {/* Tabs Trigger Navigation */}
            <div className="d-flex border-bottom bg-black bg-opacity-20 flex-shrink-0">
              <button
                className={`flex-1 py-2.5 text-center border-0 text-uppercase ${sidebarTab === 'scoring' ? 'text-neon-cyan font-weight-bold' : 'text-muted'}`}
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.05em',
                  fontFamily: 'Orbitron',
                  background: sidebarTab === 'scoring' ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                  borderBottom: sidebarTab === 'scoring' ? '2px solid #00f5ff' : 'none',
                }}
                onClick={() => setSidebarTab('scoring')}
              >
                Scoring
              </button>
              <button
                className={`flex-1 py-2.5 text-center border-0 text-uppercase ${sidebarTab === 'ai' ? 'text-neon-cyan font-weight-bold' : 'text-muted'}`}
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.05em',
                  fontFamily: 'Orbitron',
                  background: sidebarTab === 'ai' ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                  borderBottom: sidebarTab === 'ai' ? '2px solid #00f5ff' : 'none',
                }}
                onClick={() => setSidebarTab('ai')}
              >
                AI Feed
              </button>
              {canAccessPrivateRooms && (
                <button
                  className={`flex-1 py-2.5 text-center border-0 text-uppercase ${sidebarTab === 'private' ? 'text-neon-cyan font-weight-bold' : 'text-muted'}`}
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    fontFamily: 'Orbitron',
                    background: sidebarTab === 'private' ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                    borderBottom: sidebarTab === 'private' ? '2px solid #00f5ff' : 'none',
                  }}
                  onClick={() => setSidebarTab('private')}
                >
                  Private Prep
                </button>
              )}
              {(isViewer || myRole === 'host' || myRole === 'owner') && (
                <button
                  className={`flex-1 py-2.5 text-center border-0 text-uppercase ${sidebarTab === 'viewer-chat' ? 'text-neon-cyan font-weight-bold' : 'text-muted'}`}
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    fontFamily: 'Orbitron',
                    background: sidebarTab === 'viewer-chat' ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                    borderBottom: sidebarTab === 'viewer-chat' ? '2px solid #00f5ff' : 'none',
                  }}
                  onClick={() => setSidebarTab('viewer-chat')}
                >
                  Viewer Chat
                </button>
              )}
            </div>

            {/* Tab Contents */}
            <div className="flex-grow-1 overflow-y-auto" style={{ minHeight: 0 }}>
              
              {/* SCORING TAB PANEL */}
              {sidebarTab === 'scoring' && (
                <div className="p-3 d-flex flex-column gap-3">
                  
                  {/* Standings breakdown */}
                  <div>
                    <h6 className="text-uppercase text-muted mb-3" style={{ fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '0.05em' }}>
                      Current Standings
                    </h6>
                    <ScoreBreakdown finalScores={session.finalScores} />
                    {canManageScores && (
                      <div className="d-grid gap-2 mt-3">
                        <Button size="sm" variant="outline-primary" onClick={() => aggregateMutation.mutate()} disabled={aggregateMutation.isPending}>
                          Aggregate Scores
                        </Button>
                        <Button size="sm" variant="outline-success" onClick={() => winnerMutation.mutate()} disabled={winnerMutation.isPending}>
                          Determine Winner
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* List of Judges */}
                  <div className="border-top border-secondary border-opacity-20 pt-3">
                    <div className="text-muted small mb-2" style={{ fontFamily: 'Orbitron', fontSize: '11px' }}>JUDGES</div>
                    <ListGroup>
                      {judges.length ? (
                        judges.map((j) => (
                          <ListGroup.Item key={j.userId} className="bg-transparent text-white border-secondary border-opacity-25 py-2 px-3 small">
                            {j.username}
                          </ListGroup.Item>
                        ))
                      ) : (
                        <ListGroup.Item className="bg-transparent text-muted border-secondary border-opacity-25 py-2 px-3 small text-center">
                          No judges assigned
                        </ListGroup.Item>
                      )}
                    </ListGroup>
                  </div>

                  {/* Judge Rating Form */}
                  {isJudge && (
                    <div className="border-top border-secondary border-opacity-20 pt-3">
                      <h6 className="text-neon-yellow font-weight-bold mb-3" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                        Quick Reactions
                      </h6>
                      <div className="d-flex gap-2 mb-4">
                        <Button
                          size="sm"
                          variant="outline-info"
                          className="flex-fill d-flex align-items-center justify-content-center gap-1"
                          style={{ borderColor: 'rgba(0, 245, 255, 0.4)', color: '#00f5ff' }}
                          onClick={() => {
                            import('@hooks/useSocket').then(({ getSocket }) => {
                              getSocket()?.emit('judge:reaction', { roomId, type: 'agree' });
                            });
                          }}
                        >
                          👍 Agree
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="flex-fill d-flex align-items-center justify-content-center gap-1"
                          style={{ borderColor: 'rgba(255, 0, 110, 0.4)', color: '#ff006e' }}
                          onClick={() => {
                            import('@hooks/useSocket').then(({ getSocket }) => {
                              getSocket()?.emit('judge:reaction', { roomId, type: 'disagree' });
                            });
                          }}
                        >
                          👎 Disagree
                        </Button>
                      </div>

                      <h6 className="text-neon-yellow font-weight-bold mb-3" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                        Submit Ratings
                      </h6>
                      <Form.Group className="mb-2">
                        <Form.Label className="small text-muted mb-1">Speaker Slot</Form.Label>
                        <Form.Select size="sm" className="mb-2" value={scoreSpeaker} onChange={(e) => setScoreSpeaker(e.target.value as SpeakerTurn)}>
                          {speakerTurns
                            .filter((s) => room.format === '3v3' || s.endsWith('_S1'))
                            .map((s) => <option key={s} value={s}>{s}</option>)}
                        </Form.Select>
                      </Form.Group>
                      <Form.Group className="mb-2">
                        <Form.Label className="small text-muted mb-1">Winner Vote</Form.Label>
                        <Form.Select size="sm" className="mb-3" value={scoreWinner} onChange={(e) => setScoreWinner(e.target.value as Team | 'draw')}>
                          <option value="proposition">Proposition</option>
                          <option value="opposition">Opposition</option>
                          <option value="draw">Draw</option>
                        </Form.Select>
                      </Form.Group>
                      {scoreFields.map(({ key, max }) => (
                        <Form.Group className="mb-2" key={key}>
                          <Form.Label className="text-capitalize small text-white mb-1">{key}: {scores[key]}/{max}</Form.Label>
                          <Form.Range
                            min={0}
                            max={max}
                            value={scores[key]}
                            onChange={(e) => setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          />
                        </Form.Group>
                      ))}
                      <Form.Group className="mb-3">
                        <Form.Label className="small text-muted mb-1">Notes</Form.Label>
                        <Form.Control as="textarea" rows={2} placeholder="Type notes here..." className="small" value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </Form.Group>
                      <Button size="sm" className="w-100 btn-primary" onClick={() => scoreMutation.mutate()} disabled={scoreMutation.isPending}>
                        Submit Rating
                      </Button>
                    </div>
                  )}

                </div>
              )}

              {/* AI FEED TAB PANEL */}
              {sidebarTab === 'ai' && (
                <div className="p-3 d-flex flex-column gap-3">
                  <h6 className="mb-0 text-uppercase text-muted" style={{ fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '0.05em' }}>
                    Debate Feed & Analyses
                  </h6>
                  <div className="d-flex flex-column gap-3">
                    {(!session?.turnHistory || session.turnHistory.length === 0) ? (
                      <p className="text-muted small text-center py-4">No AI analyses recorded yet.</p>
                    ) : (
                      session.turnHistory.map((turn, idx) => {
                        const analysis = turn.aiAnalysis;
                        return (
                          <div key={idx} className="p-3 bg-secondary bg-opacity-5 border border-secondary border-opacity-25 rounded-3">
                            <div className="d-flex align-items-center justify-content-between mb-2 border-bottom border-secondary border-opacity-10 pb-1">
                              <span className="text-neon-cyan font-weight-bold" style={{ fontSize: '11px', fontFamily: 'Orbitron' }}>
                                {turn.speaker}
                              </span>
                              {analysis?.score?.overall !== undefined && (
                                <Badge bg="primary" style={{ fontSize: '10px' }}>
                                  Score: {analysis.score.overall}
                                </Badge>
                              )}
                            </div>
                            {analysis?.summary ? (
                              <p className="text-white small mb-2" style={{ lineHeight: '1.4' }}>{analysis.summary}</p>
                            ) : (
                              <p className="text-muted small mb-2 italic">Speech recorded. Assessment pending...</p>
                            )}
                            {analysis?.strengths && analysis.strengths.length > 0 && (
                              <div className="mb-2">
                                <span className="text-neon-cyan font-weight-bold d-block" style={{ fontSize: '10px' }}>Strengths:</span>
                                <ul className="pl-3 mb-1 text-muted" style={{ fontSize: '11px', paddingLeft: '14px' }}>
                                  {analysis.strengths.slice(0, 2).map((s, sIdx) => <li key={sIdx}>{s}</li>)}
                                </ul>
                              </div>
                            )}
                            {analysis?.weaknesses && analysis.weaknesses.length > 0 && (
                              <div>
                                <span className="text-neon-pink font-weight-bold d-block" style={{ fontSize: '10px' }}>Weaknesses:</span>
                                <ul className="pl-3 mb-0 text-muted" style={{ fontSize: '11px', paddingLeft: '14px' }}>
                                  {analysis.weaknesses.slice(0, 2).map((w, wIdx) => <li key={wIdx}>{w}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* PRIVATE PREP ROOM TAB PANEL */}
              {sidebarTab === 'private' && canAccessPrivateRooms && (
                <div className="p-3">
                  <PrivateRoomPanel roomId={roomId} />
                </div>
              )}

              {/* VIEWER CHAT TAB PANEL */}
              {sidebarTab === 'viewer-chat' && (isViewer || myRole === 'host' || myRole === 'owner') && (
                <div className="p-3">
                  <ViewerChat roomId={roomId} />
                </div>
              )}

            </div>

          </aside>

        </div>

      </div>

      {/* === RULES OVERLAY MODAL === */}
      <Modal show={showRules} onHide={() => setShowRules(false)} size="lg" centered className="dark-theme-modal">
        <Modal.Header closeButton className="border-neon bg-dark text-white border-opacity-20">
          <Modal.Title style={{ fontFamily: 'Orbitron', fontSize: '16px' }}>Debate Arena Rules</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px' }}>
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>General Structure</h5>
          <p className="text-muted mb-3">This debate follows a formal turn-based structure with continuous live assessment:</p>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>Motion Topic:</strong> Announced by the host or preset when matchmaking.</li>
            <li className="mb-2"><strong>Preparation (7 mins):</strong> Teams discuss arguments privately in team rooms.</li>
            <li className="mb-2"><strong>Speech (4 mins):</strong> Alternating speakers deliver their constructive arguments.</li>
            <li className="mb-2"><strong>Cross Examination (3 mins):</strong> Quick question-and-answer exchanges between teams.</li>
            <li className="mb-2"><strong>Judge Feedback:</strong> Judges review the performances and submit ratings.</li>
          </ul>

          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>Speaker Slots</h5>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>S1 (Speaker 1):</strong> Focuses on construction and first lines of argument.</li>
            <li className="mb-2"><strong>S2 (Speaker 2):</strong> Extends case points and refutes opposing arguments.</li>
            <li className="mb-2"><strong>S3 (Speaker 3 - Closing):</strong> Summarizes the debate. No Cross Examination happens after S3.</li>
          </ul>

          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>Scoring Criteria</h5>
          <p className="text-muted mb-3">Judges assign ratings (out of maximum points) across 6 categories:</p>
          <ul className="mb-0" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>Logic (Max 30):</strong> Coherence and clarity of the argument flow.</li>
            <li className="mb-2"><strong>Rebuttal (Max 20):</strong> Effectiveness of countering opposing claims.</li>
            <li className="mb-2"><strong>Evidence (Max 15):</strong> Usage of concrete data and logical proof.</li>
            <li className="mb-2"><strong>Cross Examination (Max 15):</strong> Skill in questioning and defending during cross-ex.</li>
            <li className="mb-2"><strong>Strategy (Max 10):</strong> Structuring and prioritizing points.</li>
            <li className="mb-2"><strong>Communication (Max 10):</strong> Delivery, clarity, and voice regulation.</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="border-neon bg-dark border-opacity-20">
          <Button size="sm" variant="outline-primary" onClick={() => setShowRules(false)}>
            Close Rules
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function ScoreBreakdown({ finalScores }: { finalScores: any }) {
  const pro = finalScores?.teamProposition?.total || 0;
  const opp = finalScores?.teamOpposition?.total || 0;
  const total = Math.max(pro + opp, 1);

  return (
    <>
      <div className="mb-2 text-muted small">Proposition</div>
      <ProgressBar now={(pro / total) * 100} label={String(Math.round(pro))} className="mb-3" />
      <div className="mb-2 text-muted small">Opposition</div>
      <ProgressBar now={(opp / total) * 100} label={String(Math.round(opp))} variant="danger" className="mb-3" />
      <Alert variant={finalScores?.winner ? 'success' : 'secondary'} className="mb-0 py-2 px-3 small border-secondary border-opacity-20 bg-dark text-white">
        Winner: <span className="text-capitalize text-neon-cyan font-weight-bold">{finalScores?.winner || 'Pending'}</span>
      </Alert>
    </>
  );
}
