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
import { useSocket, getSocket } from '@hooks/useSocket';
import { useDebateVideo } from '@hooks/useDebateVideo';
import { useDebateRoomTracker, clearDebateRoomFromStorage } from '@components/common/ReturnToDebateBanner';
import { CameraGrid } from '@components/debate/CameraGrid';
import { CountdownTimer } from '@components/debate/CountdownTimer';
import { CrossExamPanel } from '@components/debate/CrossExamPanel';
import { MicToggle } from '@components/debate/MicToggle';
import { LiveTranslationCaptions, type CaptionMode } from '@components/debate/LiveTranslationCaptions';
import { PrivateRoomPanel } from '@components/debate/PrivateRoomPanel';
import { MainRoomChat } from '@components/chat/MainRoomChat';
import { ViewerChat } from '@components/chat/ViewerChat';
import { ReconnectOverlay } from '@components/common/ReconnectOverlay';
import { PauseOverlay } from '@components/debate/PauseOverlay';
import { DisconnectTimer } from '@components/debate/DisconnectTimer';
import { TransitionPopup } from '@components/debate/TransitionPopup';
import { ResultBanner } from '@components/debate/ResultBanner';
import { AIFeedbackPopup } from '@components/debate/AIFeedbackPopup';
import { RoundJudgeForm } from '@components/debate/RoundJudgeForm';
import type {
  RoomParticipant,
  ScoreBreakdown,
  SpeakerTurn,
  SpeakerSlot,
} from '@/types';




type DebateWorkflowStep = {
  speaker: string;
  phase: string;
  label: string;
  detail: string;
  formats?: Array<'1v1' | '3v3'>;
};

/**
 * Human Host 3v3 workflow — mirrors backend DEBATE_FLOW_HOST_3V3.
 * Rule order: R1(Prop→Opp→CE), R2(Prop→Opp→CE), R3(Opp→Prop,no CE)
 * R2: "(Luồng giống Round 1)" → PRO_S2 first, OPP_S2 second
 * R3: Opposition FIRST per rule (all 4 docs): Opp→Prop → JUDGES_FB_3 → FINAL_JUDGING
 */
const debateWorkflow3v3: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Prop 1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp 1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Prop 2', detail: 'Extension (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp 2', detail: 'Extension (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Free discussion' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp 3', detail: 'Closing (3 min)' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Prop 3', detail: 'Closing (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge FB 3', detail: 'Free discussion' },
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', label: 'Final Judging', detail: 'Match result' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * Human Host 1v1 workflow — mirrors backend DEBATE_FLOW_HOST_1V1.
 * R2: OPP→PRO (per "Luồng giống Round 1"), R3: Opp→Prop → JUDGES_FB_3 → FINAL_JUDGING
 */
const debateWorkflow1v1: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Prop 1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp 1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Free discussion' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp 2', detail: 'Closing speech (3 min)' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Prop 2', detail: 'Closing speech (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Free discussion' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp 3', detail: 'Closing speech (3 min)' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Prop 3', detail: 'Closing speech (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge FB 3', detail: 'Free discussion' },
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', label: 'Final Judging', detail: 'Match result' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * No-Host 3v3 workflow — mirrors backend DEBATE_FLOW_NOHost_3V3.
 * R2: PRO→OPP (per "Luồng giống Round 1"), R3: Opp→Prop → JUDGES_FB_3 → FINAL_JUDGING
 * WAITING_S1_START at index 0 aligns with backend for correct step matching.
 */
const debateWorkflowNoHost3v3: DebateWorkflowStep[] = [
  { speaker: 'WAITING_S1_START', phase: 'waiting_s1', label: 'Waiting', detail: 'Both S1 start' },
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Prop 1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp 1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Prop 2', detail: 'Extension (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp 2', detail: 'Extension (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Free discussion' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp 3', detail: 'Closing (3 min)' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Prop 3', detail: 'Closing (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge FB 3', detail: 'Free discussion' },
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', label: 'Final Judging', detail: 'Match result' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * No-Host 1v1 workflow — mirrors backend DEBATE_FLOW_NOHost_1V1.
 * R2: OPP→PRO (per "Luồng giống Round 1"), R3: Opp→Prop → JUDGES_FB_3 → FINAL_JUDGING
 * WAITING_S1_START at index 0 aligns with backend for correct step matching.
 */
const debateWorkflowNoHost1v1: DebateWorkflowStep[] = [
  { speaker: 'WAITING_S1_START', phase: 'waiting_s1', label: 'Waiting', detail: 'Both S1 start' },
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Prop 1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp 1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Free discussion' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp 2', detail: 'Closing speech (3 min)' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Prop 2', detail: 'Closing speech (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Free discussion' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp 3', detail: 'Closing speech (3 min)' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Prop 3', detail: 'Closing speech (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge FB 3', detail: 'Free discussion' },
  { speaker: 'FINAL_JUDGING', phase: 'final_judging', label: 'Final Judging', detail: 'Match result' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

export default function DebateRoomPage() {
  const { roomId = '' } = useParams();
  const { t } = useTranslation('common');
  const { t: td } = useTranslation('debate');
  useSocket();
  useDebateSocket(roomId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Track debate room for return-to-debate banner
  const trackedRoom = useDebateStore((s) => s.room);
  useDebateRoomTracker(roomId, trackedRoom?.title);
  const cameraActiveMap = useDebateStore((s) => s.cameraActive);
  const cameraLockedByHost = useDebateStore((s) => s.cameraLockedByHost);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

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
  const [countdownSeconds, setCountdownSeconds] = useState<number | 'GO!' | null>(null);

  useEffect(() => {
    if (countdownSeconds === null) return;
    if (countdownSeconds === 'GO!') {
      const t = setTimeout(() => {
        setCountdownSeconds(null);
      }, 800);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      if (countdownSeconds === 1) {
        setCountdownSeconds(null);
      } else {
        setCountdownSeconds((countdownSeconds as number) - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [countdownSeconds]);

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
      const onCountdownStart = () => {
        setCountdownSeconds(3);
      };
      socket.on('debate:paused', onPaused);
      socket.on('debate:resumed', onResumed);
      socket.on('debate:countdown-start', onCountdownStart);
      return () => {
        socket.off('debate:paused', onPaused);
        socket.off('debate:resumed', onResumed);
        socket.off('debate:countdown-start', onCountdownStart);
      };
    }).catch(() => {
      /* noop — overlay simply won't show in the unlikely case this fails */
    });
  }, [roomId]);

  const [showRules, setShowRules] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);

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
  useEffect(() => {
    // roomId changed or component mounted — wipe stale data
    resetStore();
    return () => {
      // Wiping state on unmount is also clean
      resetStore();
    };
  }, [roomId, resetStore]);



  // New round-based scoring state (used in judge_feedback / final_judging UI)
  const [roundPropSpeak, setRoundPropSpeak] = useState(14);
  const [roundPropCe, setRoundPropCe] = useState(14);
  const [roundPropNotes, setRoundPropNotes] = useState('');
  const [roundOppSpeak, setRoundOppSpeak] = useState(14);
  const [roundOppCe, setRoundOppCe] = useState(14);
  const [roundOppNotes, setRoundOppNotes] = useState('');
  const [showPreviousScoresModal, setShowPreviousScoresModal] = useState(false);

  // Derive the correct workflow based on room format — uses roomFromStore which is
  // populated before this point, avoiding the forward-reference issue.
  // Smooth local countdown: every second, decrement the store time so the
  // timer on the host's screen never freezes between server broadcasts. The
  // server-authoritative `debate:timer-update` will re-sync the value if it
  // drifts. We pause locally when the debate is paused OR when transitioning
  // between phases — when transitioning the server emits `timeRemaining: 0`
  // and `frozen: true` so the user sees 00:00 the moment the popup appears.
  const timeRemaining = useDebateStore((s) => s.timeRemaining);
  const isPausedStore = useDebateStore((s) => s.isPaused);
  const isTransitioningStore = useDebateStore((s) => s.isTransitioning);
  const setTimeRemainingStore = useDebateStore((s) => s.setTimeRemaining);
  useEffect(() => {
    if (isPausedStore) return;
    if (isTransitioningStore) return;
    if (!timeRemaining || timeRemaining <= 0) return;
    const id = window.setInterval(() => {
      // Read state via getState() so we always see the freshest value. The
      // dependency-driven effect re-runs after store updates, but we still
      // guard against an interval tick that races with a freshly-received
      // transition-start event.
      const fresh = useDebateStore.getState();
      if (fresh.isTransitioning) {
        window.clearInterval(id);
        return;
      }
      if (fresh.isPaused) return;
      if (fresh.timeRemaining > 0) {
        setTimeRemainingStore(fresh.timeRemaining - 1);
      } else {
        window.clearInterval(id);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [isPausedStore, isTransitioningStore, timeRemaining > 0, setTimeRemainingStore]);

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
  const noHostS1Ready = useDebateStore((s) => s.noHostS1Ready);
  const finalScores = useDebateStore((s) => s.finalScores);

  // Local loading state (not used — socketReady is derived from store above)
  // Kept for backwards compatibility; intentionally unused now.

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 8000,
  });
  const refetchRoom = roomQuery.refetch;

  const sessionQuery = useQuery({
    queryKey: ['debate-session', roomId],
    queryFn: async () => (await debateService.getSession(roomId)).data.data,
    enabled: Boolean(roomId),
    refetchInterval: 5000,
  });
  const refetchSession = sessionQuery.refetch;

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
      toast.success('Debate updated successfully');
      setTurnTranscript('');
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Action failed';
      toast.error(msg);
    },
  });

  const startPhaseMutation = useMutation({
    mutationFn: () => roomService.startPhase(roomId),
    onSuccess: () => {
      toast.success('Phase started');
      invalidate();
    },
    onError: () => toast.error('Failed to start the phase'),
  });

  // No-host S1 Start mutation (socket-based)
  const noHostS1StartMutation = useMutation({
    mutationFn: () => {
      return new Promise<void>((resolve, reject) => {
        const sock = getSocket();
        if (!sock) return reject(new Error('Socket not connected'));
        (sock as any).emit('debater:s1-start', { roomId }, (res: any) => {
          if (res.error) reject(new Error(res.error.message));
          else resolve();
        });
      });
    },
    onSuccess: () => {
      toast.success('Waiting for opposing S1...');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const debaterPauseMutation = useMutation({
    mutationFn: () => debateService.debaterPause(roomId),
    onSuccess: () => {
      toast.success('Team pause started');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to pause the debate');
    },
  });

  const debaterResumeMutation = useMutation({
    mutationFn: () => debateService.debaterResume(roomId),
    onSuccess: () => {
      toast.success('Team pause resumed');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to resume the debate');
    },
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
      toast.success(variables.action === 'mute' ? 'Chat disabled' : 'Chat enabled');
      invalidate();
    },
    onError: () => toast.error('Failed to change chat state'),
  });

  const toggleCameraMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'mute' | 'unmute' }) =>
      roomService.muteCamera(roomId, userId, action),
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'mute' ? 'Camera disabled' : 'Camera enabled');
      invalidate();
    },
    onError: () => toast.error('Failed to change camera permission'),
  });

  // Round-based judge evaluation: one payload covers BOTH teams.
  const roundScoreMutation = useMutation({
    mutationFn: (payload: {
      round: 1 | 2 | 3;
      proposition: { speaker: SpeakerTurn; speak: number; ce: number; notes: string };
      opposition: { speaker: SpeakerTurn; speak: number; ce: number; notes: string };
    }) => roomService.submitRoundScores(roomId, payload),
    onSuccess: () => {
      toast.success('Round scores submitted');
      setRoundPropSpeak(14);
      setRoundOppSpeak(14);
      setRoundPropCe(14);
      setRoundOppCe(14);
      setRoundPropNotes('');
      setRoundOppNotes('');
      invalidate();
    },
    onError: () => toast.error('Failed to submit round scores'),
  });

  const playerActionMutation = useMutation({
    mutationFn: (action: 'surrender' | 'draw') => {
      if (action === 'surrender') return debateService.surrender(roomId);
      return debateService.requestDraw(roomId);
    },
    onSuccess: (_response, action) => {
      toast.success(action === 'surrender' ? 'Surrender sent' : 'Draw request sent');
      invalidate();
    },
    onError: () => toast.error('Action failed'),
  });

  const leaveMutation = useMutation({
    mutationFn: (newOwnerId?: string) => roomService.leave(roomId, newOwnerId),
    onSuccess: () => {
      clearDebateRoomFromStorage();
      toast.success('Left the debate room');
      navigate('/matches');
    },
    onError: () => {
      clearDebateRoomFromStorage();
      navigate('/matches');
    },
  });



  const aggregateMutation = useMutation({
    mutationFn: () => roomService.aggregateScores(roomId),
    onSuccess: () => {
      toast.success('Scores aggregated');
      invalidate();
    },
    onError: () => toast.error('Failed to aggregate scores'),
  });

  const winnerMutation = useMutation({
    mutationFn: () => roomService.determineWinner(roomId),
    onSuccess: () => {
      toast.success('Winner determined');
      invalidate();
    },
    onError: () => toast.error('Failed to determine the winner'),
  });

  const room = roomQuery.data;
  const session = sessionQuery.data;

  // Prefer the store-populated room (authoritative socket state) but fall
  // back to the REST fetch so the camera grid + main UI still render
  // before `room:joined` arrives. Without the fallback, an empty store
  // makes the camera grid + post-start UI hidden even when the REST room
  // already reports `startedAt`.
  const debateStartedEffective = Boolean(
    (roomFromStore && roomFromStore._id === roomId && roomFromStore.startedAt) ||
      room?.startedAt,
  );
  const { cameraActive, peers: videoPeers, startCamera, stopCamera, localStream } =
    useDebateVideo({ roomId, enabled: debateStartedEffective });

  // Auto redirect handled by ResultBanner (10s countdown with View Result button).
  // We only clear the debate-room storage here so the return-to-debate banner
  // doesn't appear on the replay page.
  useEffect(() => {
    import('@hooks/useSocket').then(({ getSocket }) => {
      const socket = getSocket();
      if (!socket) return;
      const onDebateEnded = () => {
        clearDebateRoomFromStorage();
      };
      socket.on('debate:ended', onDebateEnded);
      return () => socket.off('debate:ended', onDebateEnded);
    });
  }, [roomId, navigate]);

  const debateWorkflow = useMemo(() => {
    const format = roomFromStore?.format;
    const isNoHost = roomFromStore?.hostType !== 'human';
    if (format === '1v1') {
      return isNoHost ? debateWorkflowNoHost1v1 : debateWorkflow1v1;
    }
    return isNoHost ? debateWorkflowNoHost3v3 : debateWorkflow3v3;
  }, [roomFromStore?.format, roomFromStore?.hostType]);

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
          toast.error('Failed to join the debate room', { id: loadId });
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

  const currentParticipant = room?.participants.find((p) => p.userId === user?._id);
  const effectiveRole = currentParticipant
    ? currentParticipant.roomRole === 'owner'
      ? currentParticipant.primaryRole
      : currentParticipant.roomRole
    : null;
  const isController = Boolean(user && room?.hostId === user._id);
  const myRole = effectiveRole;

  const isHost = Boolean(effectiveRole === 'host');
  const isS1Debater = effectiveRole === 'debater' && (currentParticipant as any)?.speakerSlot === 'S1';
  // Judge S1 has host-equivalent permissions in no-host + human-judge rooms
  const isNoHost = room?.hostType !== 'human';
  const isNoHostHumanJudge = isNoHost && room?.judgeType === 'human';
  const isJudgeS1 =
    effectiveRole === 'judge' &&
    ((currentParticipant as any)?.speakerSlot === 'S1' || (currentParticipant as any)?.speakerSlot === undefined);
  // In NH+HJ, Judge S1 inherits host controls (Start, Skip, End, etc.)
  const hasHostControl = isHost || (isNoHostHumanJudge && isJudgeS1);

  // Toast notification when muted/unmuted by host
  const isMuted = currentParticipant?.muted;
  const prevMutedRef = useRef(isMuted);
  useEffect(() => {
    if (isMuted !== prevMutedRef.current) {
      if (isMuted !== undefined) {
        if (isMuted) {
          toast.error('Host has muted your microphone');
        } else {
          toast.success('Host has unmuted your microphone');
        }
      }
      prevMutedRef.current = isMuted;
    }
  }, [isMuted]);

  // Toast notification when chat muted/unmuted by host
  const isChatMuted = currentParticipant?.chatMuted;
  const prevChatMutedRef = useRef(isChatMuted);
  useEffect(() => {
    if (isChatMuted !== prevChatMutedRef.current) {
      if (isChatMuted !== undefined) {
        if (isChatMuted) {
          toast.error('Host has restricted your chat');
        } else {
          toast.success('Host has restored your chat');
        }
      }
      prevChatMutedRef.current = isChatMuted;
    }
  }, [isChatMuted]);

  // Toast notification when camera muted/unmuted by host
  const isCameraMuted = currentParticipant?.cameraMuted;
  const prevCameraMutedRef = useRef(isCameraMuted);
  useEffect(() => {
    if (isCameraMuted !== prevCameraMutedRef.current) {
      if (isCameraMuted !== undefined) {
        if (isCameraMuted) {
          toast.error('Host has restricted your camera');
        } else {
          toast.success('Host has restored your camera');
        }
      }
      prevCameraMutedRef.current = isCameraMuted;
    }
  }, [isCameraMuted]);

  const canUseDebaterActions =
    effectiveRole === 'debater' && ['active', 'paused'].includes(room?.status || '');
  const isJudge = effectiveRole === 'judge';
  const isViewer = effectiveRole === 'viewer' || !isParticipant;
  const debaters: RoomParticipant[] = room?.participants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'debater';
  }) || [];
  const judges: RoomParticipant[] = room?.participants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'judge';
  }) || [];
  const canManageScores = Boolean(isController);

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
  const canAccessPrivateRooms = Boolean(
    (effectiveRole && ['debater', 'judge', 'host'].includes(effectiveRole)) ||
    currentParticipant?.roomRole === 'owner'
  );


  // Speech phase: mic enabled for current speaker
  const currentSpeakerTeam = currentSpeaker?.startsWith('PRO_') ? 'proposition' : 'opposition';
  const isMyTurnToSpeak =
    effectiveRole === 'debater' &&
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

  // Turn off mic and camera locally when the debate is paused
  useEffect(() => {
    if (isPaused) {
      if (cameraActive) {
        stopCamera();
      }
      if (isListening) {
        stopMic();
      }
    }
  }, [isPaused, cameraActive, isListening, stopCamera, stopMic]);

  useEffect(() => {
    if (!opponentPendingDraw || !pendingDrawRequest) return;
    const requestKey = `${pendingDrawRequest.team}:${pendingDrawRequest.requestedAt}`;
    if (lastNotifiedDrawRequestRef.current === requestKey) return;
    lastNotifiedDrawRequestRef.current = requestKey;
    toast(`${pendingDrawRequest.requestedByName || 'Opponent'} requested a draw`);
  }, [opponentPendingDraw, pendingDrawRequest]);
  
  // Sidebar Tab State
  const [sidebarTab, setSidebarTab] = useState<'scoring' | 'admin' | 'private' | 'viewer-chat'>('scoring');

  useEffect(() => {
    if (isViewer) {
      setSidebarTab('viewer-chat');
    }
  }, [isViewer]);

  // Derived speaker and slot structures
  const speakerLabel = currentSpeaker || session?.currentTurn?.speaker || '—';
  const serverTime = session?.currentTurn?.timeRemaining ?? 0;
  const serverTotal = session?.currentTurn?.timeLimit ?? 0;
  // When transitioning, the displayed timer must be 00:00 even if the local
  // ticker or a stale server update still holds a non-zero value. The server
  // freezes the timer at the start of the transition popup per the rules.
  const displayTime = isTransitioning ? 0 : (timeRemaining || serverTime);
  const displayTotal = isTransitioning ? 0 : (totalTime || serverTotal);

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

  const currentRound = useMemo(() => {
    return getRoundForStepIndex(currentWorkflowIndex, room?.format, room?.hostType);
  }, [currentWorkflowIndex, room?.format, room?.hostType]);

  const isScoringAllowed = useMemo(() => {
    const phase = currentPhase || session?.currentTurn?.phase;
    const speaker = (currentSpeaker || session?.currentTurn?.speaker) as string;
    // Round 3: accept scoring at JUDGES_FB_3 (exists in ALL 4 flows)
    if (currentRound === 3) {
      return phase === 'judge_feedback' && speaker === 'JUDGES_FB_3';
    }
    if (currentRound === 1) {
      return phase === 'judge_feedback' && speaker === 'JUDGES_FB_1';
    }
    if (currentRound === 2) {
      return phase === 'judge_feedback' && speaker === 'JUDGES_FB_2';
    }
    return false;
  }, [currentRound, currentPhase, session?.currentTurn?.phase, currentSpeaker, session?.currentTurn?.speaker]);

  const isJudge3 = useMemo(() => {
    const phase = currentPhase || session?.currentTurn?.phase;
    const speaker = (currentSpeaker || session?.currentTurn?.speaker) as string;
    return phase === 'judge_feedback' && speaker === 'JUDGES_FB_3';
  }, [currentPhase, currentSpeaker, session?.currentTurn?.phase, session?.currentTurn?.speaker]);

  useEffect(() => {
    if (!session?.finalScores?.judgeVerdicts || !user?._id) return;
    const verdicts = session.finalScores.judgeVerdicts;
    const propSpeaker = resolvePropSpeakerForRound(currentRound, room?.format);
    const oppSpeaker = resolveOppSpeakerForRound(currentRound, room?.format);
    
    const propVerdict = verdicts.find(
      (v: any) => v.judgeId?.toString() === user._id && v.speaker === propSpeaker
    );
    const oppVerdict = verdicts.find(
      (v: any) => v.judgeId?.toString() === user._id && v.speaker === oppSpeaker
    );

    if (propVerdict) {
      setRoundPropSpeak((propVerdict.score as any)?.logic ?? (propVerdict.score as any)?.speak ?? 14);
      setRoundPropCe((propVerdict.score as any)?.crossExam ?? (propVerdict.score as any)?.ce ?? 14);
      setRoundPropNotes(propVerdict.notes ?? '');
    } else {
      setRoundPropSpeak(14);
      setRoundPropCe(14);
      setRoundPropNotes('');
    }

    if (oppVerdict) {
      setRoundOppSpeak((oppVerdict.score as any)?.logic ?? (oppVerdict.score as any)?.speak ?? 14);
      setRoundOppCe((oppVerdict.score as any)?.crossExam ?? (oppVerdict.score as any)?.ce ?? 14);
      setRoundOppNotes(oppVerdict.notes ?? '');
    } else {
      setRoundOppSpeak(14);
      setRoundOppCe(14);
      setRoundOppNotes('');
    }
  }, [currentRound, session?.finalScores?.judgeVerdicts, user?._id, room?.format]);



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

    // 2. Judge verdicts — group by judge+round and display per-team notes
    const verdicts = session?.finalScores?.judgeVerdicts || [];
    const isRoundBased = verdicts.some((v: any) => v.round !== undefined);

    if (isRoundBased) {
      // Group by judge + round
      const byJudgeRound = new Map<string, Map<number, any>>();
      verdicts.forEach((v: any) => {
        const key = v.judgeName || td('debateRoom.roles.judge');
        if (!byJudgeRound.has(key)) byJudgeRound.set(key, new Map());
        const roundNum = Number(v.round) || 0;
        const existing = byJudgeRound.get(key)!.get(roundNum);
        if (!existing || !existing.speaker) {
          byJudgeRound.get(key)!.set(roundNum, v);
        }
      });

      byJudgeRound.forEach((roundMap, judgeName) => {
        roundMap.forEach((v, roundNum) => {
          const propNotes = v.notes || '—';
          // Find the opposing verdict for the same round
          const oppVerdict = verdicts.find((ov: any) =>
            ov.judgeName === judgeName &&
            Number(ov.round) === roundNum &&
            String(ov.speaker).startsWith('OPP_'),
          );
          const oppNotes = oppVerdict?.notes || '—';
          list.push(
            `Judge ${judgeName} — Round ${roundNum}:\n  Propo team: ${propNotes}\n  Oppo team: ${oppNotes}`,
          );
        });
      });
    } else {
      verdicts.forEach((v: any) => {
        list.push(
          `Judge ${v.judgeName || 'assigned'} — Notes: "${v.notes || 'No notes'}"`,
        );
      });
    }

    // 3. Match completed
    if (session?.finalScores?.winner && room?.status === 'completed') {
      list.push(td('debateRoom.debateEnded', { winner: session.finalScores.winner.toUpperCase() }));
    }

    return list;
  }, [messages, session]);

  // Show loading spinner until REST room data lands. Once we have the room
  // we render the body even if the socket is still mid-reconnect — the
  // socket state will populate via `room:joined` and re-render incrementally.
  // Previously we blocked on `socketReady`, which stranded users on a
  // "Connecting..." spinner when the socket reconnect lagged behind REST.
  const isLoading = roomQuery.isLoading || sessionQuery.isLoading || isJoining;

  // Track socket readiness only for diagnostic UI, not as a render gate.
  const socketPending = isParticipant && !socketReady;

  // Surface clear diagnostics so a stuck page is easy to triage in the field.
  useEffect(() => {
    if (!roomQuery.isError) return;
    // eslint-disable-next-line no-console
    console.warn('[DebateRoom] REST room fetch failed', roomQuery.error);
  }, [roomQuery.isError, roomQuery.error]);

  useEffect(() => {
    if (!socketPending) return;
    const timer = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[DebateRoom] Socket state still pending after 4s', {
        roomId,
        socketId: getSocket()?.id,
        connected: getSocket()?.connected,
        storeRoomId: useDebateStore.getState().room?._id,
      });
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [socketPending, roomId]);

  if (isLoading) {
    return (
      <Container fluid className="py-4 text-center">
        <Spinner animation="border" />
        <div className="mt-2 text-muted small">{td('debateRoom.loading')}</div>
      </Container>
    );
  }

  if (showPasswordPrompt) {
    return (
      <div className="vh-100 w-100 d-flex flex-column align-items-center justify-content-center text-white" style={{ background: '#0a0a0f', fontFamily: 'Rajdhani, sans-serif' }}>
        <Card style={{ width: '400px', background: 'rgba(15, 15, 25, 0.65)', border: '1px solid rgba(0, 245, 255, 0.25)', boxShadow: '0 0 40px rgba(0,245,255,0.1)', backdropFilter: 'blur(10px)' }} className="p-4 rounded-4 text-center">
          <h3 className="mb-3 text-neon-cyan" style={{ fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>
            <i className="bi bi-shield-lock me-2"></i>
            PHÒNG TRANH LUẬN RIÊNG TƯ
          </h3>
          <p className="text-muted small mb-4">{td('debateRoom.enterPassword')}</p>
          <Form onSubmit={handlePrivateJoin}>
            <Form.Group className="mb-3">
              <Form.Control
                type="password"
                placeholder={td('debateRoom.passwordPlaceholder')}
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                required
                autoFocus
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}
              />
            </Form.Group>
            <div className="d-grid gap-2">
              <Button type="submit" variant="primary" disabled={isJoining || !joinPassword.trim()}>
                {isJoining ? td('debateRoom.connecting') : td('debateRoom.enterRoom')}
              </Button>
              <Button variant="outline-light" onClick={() => navigate('/matches')} disabled={isJoining}>
                {td('debateRoom.backToMatch')}
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    );
  }

  if (!room) {
    return (
      <Container className="py-4">
        <Alert variant="warning">
          <Alert.Heading>Debate room is loading</Alert.Heading>
          <p className="mb-2">
            {td('debateRoom.roomNotFound')}
          </p>
          <div className="d-flex gap-2">
            <Button variant="primary" size="sm" onClick={() => refetchRoom()}>
              {td('retry')}
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate('/matches')}>
              {td('backToMatches')}
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container className="py-4">
        <Alert variant="info">
          <Alert.Heading>Debate session is starting</Alert.Heading>
          <p className="mb-2">
            {td('debateRoom.sessionStarting')}
          </p>
          <div className="d-flex gap-2 align-items-center">
            <Spinner animation="border" size="sm" />
            <Button variant="outline-primary" size="sm" onClick={() => refetchSession()}>
              {td('debateRoom.retryNow')}
            </Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate('/matches')}>
              {td('backToMatches')}
            </Button>
          </div>
        </Alert>
      </Container>
    );
  }

  const phaseLabel = t(`debate.phases.${currentPhase || session.currentTurn?.phase}`, {
    defaultValue: currentPhase || session.currentTurn?.phase || '',
  });

  // Render the body even when the socket is still mid-reconnect so the user
  // sees the workflow timeline, chat, etc. — but show a thin banner above
  // the room so they know realtime data may be one or two ticks behind.
  const showSocketPendingBanner = socketPending;

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
      {showSocketPendingBanner && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-2 px-3 py-2 rounded-pill d-flex align-items-center gap-2"
          style={{
            background: 'rgba(255, 214, 10, 0.18)',
            border: '1px solid rgba(255, 214, 10, 0.5)',
            zIndex: 1100,
            fontSize: '12px',
            color: '#ffd60a',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Spinner animation="border" size="sm" />
          <span>{td('debateRoom.syncBanner')}</span>
        </div>
      )}
      <TransitionPopup />
      <ResultBanner
        roomId={roomId}
        finalScores={finalScores}
        aiSummary={sessionQuery.data?.aiSummary}
      />
      <AIFeedbackPopup />
      <PauseOverlay
        isPaused={isPaused}
        pausedAtRemaining={pausedAtRemaining}
        onResume={() => {
          if (hasHostControl) {
            controlMutation.mutate('resume');
          } else {
            debaterResumeMutation.mutate();
          }
        }}
        isResuming={
          (controlMutation.isPending && controlMutation.variables === 'resume') ||
          debaterResumeMutation.isPending
        }
      />
      <DisconnectTimer />

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
            <h2 className="text-neon-pink mb-3 speaking-pulse" style={{ letterSpacing: '0.1em' }}>{td('debateRoom.phaseTransition')}</h2>
            <div className="fs-1 fw-bold text-neon-cyan mb-2" style={{ textShadow: '0 0 10px #00f5ff' }}>{transitionTime}s</div>
            <div className="text-muted small text-uppercase" style={{ letterSpacing: '0.1em' }}>{td('debateRoom.muteMicAndLockChat')}</div>
          </div>
        </div>
      )}

      {/* Floating Judge Reactions - positioned relative to viewport */}
      <div
        className="position-fixed d-none d-md-flex flex-column gap-2"
        style={{
          bottom: '24px',
          right: '340px',
          zIndex: 1050,
          pointerEvents: 'none',
        }}
      >
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

      {/* Mobile reactions - bottom bar */}
      <div
        className="position-fixed d-flex d-md-none gap-2 p-2"
        style={{
          bottom: '70px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1050,
          pointerEvents: 'none',
        }}
      >
        {activeReactions.slice(0, 3).map((react) => (
          <div
            key={react.id}
            className="d-flex align-items-center gap-1 p-1 px-2 rounded-pill text-white"
            style={{
              background: 'rgba(10, 10, 20, 0.85)',
              border: react.type === 'agree' ? '1px solid #00f5ff' : '1px solid #ff006e',
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>{react.type === 'agree' ? '👍' : '👎'}</span>
            <span className="small fw-bold" style={{ fontSize: '10px' }}>{react.username}</span>
          </div>
        ))}
      </div>

      {/* Main container - use 100dvh for mobile browser address bar compatibility */}
      <div
        className="d-flex flex-column text-white"
        style={{
          height: '100dvh',
          background: '#0a0a0f',
          fontFamily: 'Rajdhani, sans-serif',
          overflow: 'hidden',
          maxWidth: '100vw',
        }}
      >
        
        {/* === HEADER PROGRESS LINE === */}
        <div className="flex-shrink-0" style={{ height: '3px', background: 'rgba(255, 255, 255, 0.05)' }}>
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

        {/* === CAMERA GRID === */}
        {debateStartedEffective && !isViewer && (
          <div
            className="flex-shrink-0 p-2"
            style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(0,245,255,0.2)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1 px-1">
              <span
                className="text-uppercase text-muted"
                style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', letterSpacing: '0.1em' }}
              >
                <i className="bi bi-camera-video-fill me-1" />
                Camera
              </span>
            </div>
            <CameraGrid
              peers={videoPeers}
              participants={room?.participants || []}
              localUserId={user?._id}
              localUsername={user?.username || 'You'}
              localStream={localStream}
              localMuted={false}
              resolveUserId={(peer) => peer.userId}
            />

          </div>
        )}

        {/* === VIEWER-ONLY CAMERA PREVIEW (read-only, when host enabled it for viewer) === */}
        {debateStartedEffective && isViewer && Object.values(cameraActiveMap).some(Boolean) && (
          <div
            className="flex-shrink-0 p-2"
            style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(0,245,255,0.2)' }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1 px-1">
              <span
                className="text-uppercase text-muted"
                style={{ fontFamily: 'Orbitron', fontSize: '0.65rem', letterSpacing: '0.1em' }}
              >
                <i className="bi bi-camera-video-fill me-1" />
                Live camera
              </span>
              <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                Viewer-only mode
              </small>
            </div>
            <CameraGrid
              peers={videoPeers}
              participants={room?.participants || []}
              localStream={null}
              resolveUserId={(peer) => peer.userId}
            />
          </div>
        )}

        {/* === MAIN WORKSPACE === */}
        <div className="flex-grow-1 d-flex flex-row overflow-hidden" style={{ minHeight: 0, maxWidth: '100%' }}>

          {/* Main Arena Floor - scrollable container */}
          <div className="flex-grow-1 d-flex flex-column overflow-y-auto p-2 gap-2" style={{ minHeight: 0 }}>
            
            {/* Draw request alerts */}
            {opponentPendingDraw && (
              <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2 py-2 px-3 mb-0 small flex-shrink-0">
                <div>
                  <strong>{pendingDrawRequest?.requestedByName || 'Opponent'}</strong> requested a draw.
                  Accepting will end the match as a draw.
                </div>
                {canUseDebaterActions && (
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => playerActionMutation.mutate('draw')}
                    disabled={playerActionMutation.isPending}
                    style={{ fontSize: '11px' }}
                  >
                    Accept draw
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
            {ownTeamPendingDraw && <Alert variant="info" className="py-2 px-3 mb-0 small flex-shrink-0">{td('debateRoom.actions.drawRequested')}</Alert>}

            {/* Row 1: Mirrored Teams & Motion/Timer */}
            <div className="flex-shrink-0">
              <Row className="g-2 align-items-stretch gx-2">

                {/* Left side: Proposition speakers list */}
                <Col xl={3} md={4} className="d-flex flex-column">
                  <div className="text-neon-cyan mb-1" style={{ fontFamily: 'Orbitron', fontSize: '10px', letterSpacing: '0.05em' }}>
                    <i className="bi bi-people-fill text-neon-cyan me-1"></i> BÊN ĐI
                  </div>
                  <div className="d-flex flex-column gap-1 flex-grow-1 justify-content-around">
                    {slots.map((slot) => {
                      const participant = debaters.find((p) => p.team === 'proposition' && p.speakerSlot === slot);
                      const expected = `PRO_${slot}`;
                      const isCurrent = speakerLabel === expected;

                      return (
                        <div
                          key={slot}
                          className={`p-1 px-2 rounded-2 d-flex align-items-center gap-2 position-relative ${
                            isCurrent ? 'glass-card border-neon' : 'bg-secondary bg-opacity-10 border border-secondary border-opacity-25'
                          }`}
                          style={{
                            borderTop: isCurrent ? '2px solid #00f5ff' : undefined,
                            boxShadow: isCurrent ? '0 0 15px rgba(0, 245, 255, 0.15)' : undefined,
                            opacity: isCurrent ? 1 : 0.65,
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle border flex-shrink-0"
                            style={{
                              width: '26px',
                              height: '26px',
                              background: isCurrent ? 'rgba(0, 245, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              borderColor: isCurrent ? 'rgba(0, 245, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <i className={`bi bi-person-fill ${isCurrent ? 'text-neon-cyan' : 'text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                          </div>
                          <div className="min-width-0">
                            <p className="mb-0 text-white text-truncate" style={{ fontSize: '11px', lineHeight: 1.2 }}>
                              {participant ? participant.username : `Empty (${slot})`}
                            </p>
                            <p className="mb-0 text-uppercase" style={{ fontSize: '8px', letterSpacing: '0.05em', color: isCurrent ? '#00f5ff' : 'var(--text-muted)', lineHeight: 1.2 }}>
                              {isCurrent ? td('debateRoom.speakerStatus.speaking') : participant ? td('debateRoom.speakerStatus.waiting') : td('debateRoom.speakerStatus.empty')}
                            </p>
                          </div>
                          {isCurrent && (
                            <div className="position-absolute" style={{ right: '8px', top: '50%', transform: 'translateY(-50%)' }}>
                              <i className="bi bi-mic-fill text-neon-cyan speaking-pulse" style={{ fontSize: '0.8rem' }}></i>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Col>

                {/* Center: Motion & Time countdown header */}
                <Col xl={6} md={4} className="d-flex flex-column justify-content-between align-items-stretch text-center px-2 bg-secondary bg-opacity-5 rounded-2 border border-secondary border-opacity-10 py-1">
                  <div className="w-100 d-flex justify-content-between align-items-start gap-1">
                    <h2 className="m-0 text-muted text-start flex-grow-1 text-truncate" style={{ fontFamily: 'Orbitron', fontSize: '10px', lineHeight: 1.3 }}>
                      &ldquo;{room.motion}&rdquo;
                    </h2>
                    <div className="d-flex align-items-center gap-1 flex-shrink-0">
                      {canAccessPrivateRooms && (
                        <Button
                          size="sm"
                          variant="outline-warning"
                          onClick={() => setSidebarTab('private')}
                          style={{ fontSize: '9px', fontFamily: 'Orbitron', padding: '0.1rem 0.3rem' }}
                        >
                          Private room
                        </Button>
                        )}
                      <Button
                        size="sm"
                        variant="outline-info"
                        onClick={() => setShowRules(true)}
                        style={{ fontSize: '9px', fontFamily: 'Orbitron', padding: '0.1rem 0.3rem' }}
                      >
                        Rules
                      </Button>
                    </div>
                  </div>

                  <div className="mt-1 w-100 d-flex align-items-center justify-content-between border-top border-secondary border-opacity-20 pt-1">
                    <div className="text-start min-width-0">
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="text-neon-cyan text-uppercase fw-bold d-block" style={{ fontSize: '9px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                          {phaseLabel}
                        </span>
                        {isViewer && (
                          <Badge bg="info" className="px-1 py-0 text-uppercase d-none d-sm-inline-flex" style={{ fontSize: '8px', fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>
                            <i className="bi bi-eye-fill me-0.5"></i> {td('debateRoom.spectator')}
                          </Badge>
                        )}
                      </div>
                      <span className="text-white small text-truncate d-block" style={{ fontSize: '10px' }}>
                        {activeSpeakerName} ({speakerLabel})
                      </span>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {((myRole && ['host', 'owner', 'debater', 'judge'].includes(myRole)) || isMyTurnToSpeak || (isViewer && speakingAllowed)) && (
                        <div className="d-flex align-items-center gap-2">
                          {isMyTurnToSpeak && (
                            <Button
                              size="sm"
                              variant={isListening ? 'danger' : 'success'}
                              onClick={isListening ? stopMic : startMic}
                              disabled={isTransitioning}
                              style={{ fontSize: '8px', padding: '0.15rem 0.3rem' }}
                            >
                              {isListening ? 'Mute mic' : 'Speak'}
                            </Button>
                          )}
                          <MicToggle roomId={roomId} disabled={isTransitioning || currentParticipant?.muted || isPaused} />
                          {cameraActive ? (
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={stopCamera}
                              style={{ fontSize: '10px', padding: '0.15rem 0.35rem' }}
                              title={td('debateRoom.actions.turnCameraOff')}
                            >
                              <i className="bi bi-camera-video-off-fill" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline-info"
                              onClick={startCamera}
                              disabled={cameraLockedByHost || currentParticipant?.cameraMuted}
                              style={{ fontSize: '10px', padding: '0.15rem 0.35rem' }}
                              title={cameraLockedByHost || currentParticipant?.cameraMuted ? 'Locked by host' : 'Turn camera on'}
                            >
                              <i className="bi bi-camera-video-fill" />
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="d-flex align-items-center gap-1 text-muted px-1 py-0.5 rounded bg-dark bg-opacity-35 border border-secondary border-opacity-15" title={td('debateRoom.viewerCount')} style={{ height: 'fit-content' }}>
                        <i className="bi bi-eye-fill text-neon-cyan" style={{ fontSize: '0.7rem' }}></i>
                        <span className="small fw-bold text-white" style={{ fontFamily: 'Orbitron', fontSize: '10px' }}>
                          {(room?.participants || []).filter((p: any) => {
                            const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
                            return role === 'viewer';
                          }).length}
                        </span>
                      </div>
                      <div className="text-white text-end font-weight-bold" style={{ fontFamily: 'Orbitron, monospace', fontSize: '1.4rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
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
                  <div className="text-neon-pink mb-1" style={{ fontFamily: 'Orbitron', fontSize: '10px', letterSpacing: '0.05em' }}>
                    BÊN VÃNG <i className="bi bi-people-fill text-neon-pink ms-1"></i>
                  </div>
                  <div className="d-flex flex-column gap-1 flex-grow-1 justify-content-around">
                    {slots.map((slot) => {
                      const participant = debaters.find((p) => p.team === 'opposition' && p.speakerSlot === slot);
                      const expected = `OPP_${slot}`;
                      const isCurrent = speakerLabel === expected;

                      return (
                        <div
                          key={slot}
                          className={`p-1 px-2 rounded-2 d-flex align-items-center gap-2 justify-content-end text-end position-relative ${
                            isCurrent ? 'glass-card' : 'bg-secondary bg-opacity-10 border border-secondary border-opacity-25'
                          }`}
                          style={{
                            borderTop: isCurrent ? '2px solid #ff006e' : undefined,
                            boxShadow: isCurrent ? '0 0 15px rgba(255, 0, 110, 0.15)' : undefined,
                            borderColor: isCurrent ? '#ff006e' : undefined,
                            opacity: isCurrent ? 1 : 0.65,
                          }}
                        >
                          {isCurrent && (
                            <div className="position-absolute" style={{ left: '8px', top: '50%', transform: 'translateY(-50%)' }}>
                              <i className="bi bi-mic-fill text-neon-pink speaking-pulse" style={{ fontSize: '0.8rem' }}></i>
                            </div>
                          )}
                          <div className="min-width-0">
                            <p className="mb-0 text-white text-truncate" style={{ fontSize: '11px', lineHeight: 1.2 }}>
                              {participant ? participant.username : `Empty (${slot})`}
                            </p>
                            <p className="mb-0 text-uppercase" style={{ fontSize: '8px', letterSpacing: '0.05em', color: isCurrent ? '#ff006e' : 'var(--text-muted)', lineHeight: 1.2 }}>
                              {isCurrent ? td('debateRoom.speakerStatus.speaking') : participant ? td('debateRoom.speakerStatus.waiting') : td('debateRoom.speakerStatus.empty')}
                            </p>
                          </div>
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle border flex-shrink-0"
                            style={{
                              width: '26px',
                              height: '26px',
                              background: isCurrent ? 'rgba(255, 0, 110, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                              borderColor: isCurrent ? 'rgba(255, 0, 110, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            <i className={`bi bi-person-fill ${isCurrent ? 'text-neon-pink' : 'text-muted'}`} style={{ fontSize: '0.8rem' }}></i>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Col>

              </Row>
            </div>

            {/* Row 2: Debate workflow + Host/Judge announcements - condensed */}
            <div className="d-flex gap-2 flex-shrink-0" style={{ height: '160px', minHeight: 0 }}>
              <div className="d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-2 border border-secondary border-opacity-10 p-2" style={{ width: '50%', flexShrink: 0, minHeight: 0 }}>
                <div className="d-flex align-items-center justify-content-between mb-1 flex-shrink-0">
                  <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                    <i className="bi bi-diagram-3-fill me-1"></i> {td('debateRoom.workflow')}
                  </span>
                  <Badge bg="secondary" style={{ fontSize: '8px' }}>
                    {currentWorkflowIndex >= 0 ? `${currentWorkflowIndex + 1}/${debateWorkflow.length}` : 'Waiting'}
                  </Badge>
                </div>

                <div className="d-flex gap-2 mb-1 flex-shrink-0">
                  <div className="flex-fill rounded-2 border border-info border-opacity-25 bg-info bg-opacity-10 p-1.5">
                    <div className="text-neon-cyan text-uppercase fw-bold mb-0.5" style={{ fontSize: '8px', letterSpacing: '0.05em' }}>{td('debateRoom.current')}</div>
                    <div className="fw-bold text-white text-truncate" style={{ fontSize: '11px' }}>{currentWorkflowStep?.label || phaseLabel || 'Waiting'}</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '9px' }}>{activeSpeakerName}</div>
                  </div>
                  <div className="flex-fill rounded-2 border border-warning border-opacity-25 bg-warning bg-opacity-10 p-1.5">
                    <div className="text-neon-yellow text-uppercase fw-bold mb-0.5" style={{ fontSize: '8px', letterSpacing: '0.05em' }}>{td('debateRoom.next')}</div>
                    <div className="fw-bold text-white text-truncate" style={{ fontSize: '11px' }}>{nextWorkflowStep?.label || 'Result'}</div>
                    <div className="text-muted text-truncate" style={{ fontSize: '9px' }}>{nextWorkflowStep?.detail || 'Completed'}</div>
                  </div>
                </div>

                {/* Compact horizontal scrollable timeline */}
                <div
                  className="flex-fill overflow-x-auto overflow-y-hidden"
                  style={{
                    minHeight: 0,
                    overscrollBehavior: 'contain',
                    scrollbarColor: 'rgba(0, 245, 255, 0.4) transparent',
                    scrollbarWidth: 'thin',
                  }}
                >
                  <div className="d-flex gap-1 py-1" style={{ minWidth: 'max-content' }}>
                    {debateWorkflow.map((step, idx) => {
                      const isDone = currentWorkflowIndex > idx;
                      const isActive = currentWorkflowIndex === idx;
                      const isNext = currentWorkflowIndex + 1 === idx;

                      return (
                        <div
                          key={`${step.speaker}-${step.phase}-${idx}`}
                          className={`flex-shrink-0 rounded-2 border px-2 py-1 text-center ${isActive ? 'border-neon' : ''}`}
                          style={{
                            width: '72px',
                            background: isActive
                              ? 'rgba(0, 245, 255, 0.15)'
                              : isNext
                                ? 'rgba(255, 214, 10, 0.1)'
                                : 'rgba(255,255,255,0.03)',
                            borderColor: isActive
                              ? 'rgba(0,245,255,0.5)'
                              : isNext
                                ? 'rgba(255,214,10,0.3)'
                                : 'rgba(255,255,255,0.1)',
                            opacity: isDone ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="d-flex align-items-center justify-content-center rounded-circle mx-auto mb-1"
                            style={{
                              width: '16px',
                              height: '16px',
                              fontSize: '8px',
                              background: isActive ? '#00f5ff' : isDone ? '#198754' : isNext ? 'rgba(255, 214, 10, 0.3)' : 'rgba(255,255,255,0.1)',
                              borderColor: isActive ? '#00f5ff' : isDone ? '#198754' : isNext ? '#ffd60a' : 'rgba(255,255,255,0.2)',
                              color: isActive ? '#050812' : '#fff',
                            }}
                          >
                            {isDone ? '✓' : idx + 1}
                          </div>
                          <div className="text-white fw-semibold text-truncate" style={{ fontSize: '9px', lineHeight: 1.2 }}>
                            {step.label}
                          </div>
                          <div className="text-muted text-truncate" style={{ fontSize: '7px', lineHeight: 1.2 }}>
                            {step.phase.replace('_', ' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex-grow-1 d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-2 border border-secondary border-opacity-10 p-2" style={{ minHeight: 0 }}>
                <div className="d-flex align-items-center justify-content-between mb-1 flex-shrink-0">
                  <span className="text-neon-yellow text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                    <i className="bi bi-bell-fill me-1"></i> {td('debateRoom.notifications')}
                  </span>
                </div>

                <div
                  className="flex-fill overflow-y-auto"
                  style={{
                    minHeight: 0,
                    overscrollBehavior: 'contain',
                    scrollbarColor: 'rgba(255, 214, 10, 0.4) transparent',
                    scrollbarWidth: 'thin',
                  }}
                >
                  {announcements.length === 0 ? (
                    <p className="text-muted small italic text-center py-2">{td('debateRoom.noNotifications')}</p>
                  ) : (
                    announcements.slice(-8).map((ann, idx) => (
                      <div key={idx} className="p-1.5 mb-1 bg-secondary bg-opacity-10 border border-secondary border-opacity-20 rounded text-white" style={{ fontSize: '10px', lineHeight: 1.3 }}>
                        <i className="bi bi-info-circle text-neon-yellow me-1"></i>
                        {ann.length > 80 ? ann.slice(0, 77) + '...' : ann}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Inside Match Chat Box */}
            <div className="flex-shrink-0 d-flex flex-column overflow-hidden bg-secondary bg-opacity-5 rounded-2 border border-secondary border-opacity-10 p-2" style={{ height: '300px', minHeight: '180px' }}>
              <div className="d-flex align-items-center justify-content-between mb-1 flex-shrink-0">
                <span className="text-neon-cyan text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                  <i className="bi bi-chat-dots-fill me-1"></i> {td('debateRoom.matchChat')}
                </span>
              </div>
              <div className="flex-fill overflow-hidden" style={{ minHeight: 0 }}>
                <MainRoomChat roomId={roomId} />
              </div>
            </div>

            {/* Inline Cross Exam details below the chat if CE matches - collapsible */}
            {currentPhase === 'cross_exam' && (
              <div className="flex-shrink-0" style={{ maxHeight: '180px' }}>
                <CrossExamPanel roomId={roomId} />
              </div>
            )}

            {/* Row 4: Assigned Judges Badge List */}
            <div className="flex-shrink-0 bg-secondary bg-opacity-5 rounded-2 border border-secondary border-opacity-10 px-2 py-1">
              <div className="d-flex align-items-center justify-content-between">
                <span className="text-muted text-uppercase fw-bold" style={{ fontSize: '9px', letterSpacing: '0.05em', fontFamily: 'Orbitron' }}>
                  {td('debateRoom.judge.assigned')}
                </span>
                <div className="d-flex gap-1 flex-wrap">
                  {judges.length ? (
                    judges.slice(0, 6).map((j) => (
                      <Badge key={j.userId} bg="dark" className="border border-secondary border-opacity-25 text-white py-0.5 px-1.5" style={{ fontSize: '9px' }}>
                        <i className="bi bi-patch-check-fill text-neon-yellow me-0.5"></i>
                        {j.username}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted" style={{ fontSize: '9px' }}>{td('debateRoom.judge.noJudges')}</span>
                  )}
                </div>
              </div>
            </div>


            {/* Bottom: Dedicated Debater quick-actions bar - compact */}
            {canUseDebaterActions && (
              <div className="flex-shrink-0 bg-dark bg-opacity-30 border border-secondary border-opacity-20 rounded-2 p-1.5 text-center">
                <span className="text-muted me-2" style={{ fontFamily: 'Orbitron', fontSize: '9px' }}>{td('debateRoom.match')}:</span>

                <Button
                  size="sm"
                  variant={room?.status === 'paused' ? 'success' : 'outline-warning'}
                  className="py-0.5 px-2 me-1"
                  onClick={() => {
                    if (room?.status === 'paused') {
                      debaterResumeMutation.mutate();
                    } else {
                      debaterPauseMutation.mutate();
                    }
                  }}
                  disabled={
                    debaterPauseMutation.isPending || 
                    debaterResumeMutation.isPending
                  }
                  style={{ fontSize: '9px', fontFamily: 'Orbitron' }}
                >
                  {room?.status === 'paused'
                    ? td('debateRoom.actions.resume')
                    : `Pause (${3 - (currentParticipant?.team && session?.pausesUsed?.[currentParticipant.team as 'proposition' | 'opposition'] || 0)} left)`}
                </Button>

                {currentPhase === 'prep_7' && (
                  <Button
                    size="sm"
                    variant="success"
                    className="py-0.5 px-2 me-1"
                    style={{ fontSize: '9px', boxShadow: '0 0 6px rgba(40, 167, 69, 0.4)' }}
                    onClick={() => {
                      import('@hooks/useSocket').then(({ getSocket }) => {
                        getSocket()?.emit('debate:end-prep-early', { roomId });
                      });
                    }}
                    disabled={!isS1Debater || prepConsensusReadyUserIds.includes(user?._id || '')}
                  >
                    {prepConsensusReadyUserIds.includes(user?._id || '')
                      ? `Ready (${prepConsensusReadyUserIds.length}/${prepConsensusTotalDebaters || 2})`
                      : `End preparation (${prepConsensusReadyUserIds.length}/${prepConsensusTotalDebaters || 2})`}
                  </Button>
                )}

                {turnStatus === 'active' && currentPhase === 'speech' && isMyTurnToSpeak && (
                  <Button
                    size="sm"
                    className="py-0.5 px-2 me-1"
                    style={{ fontSize: '9px', background: '#ff006e', color: '#fff', border: 'none', boxShadow: '0 0 8px #ff006e' }}
                    onClick={() => controlMutation.mutate('finish')}
                    disabled={controlMutation.isPending || isTransitioning}
                  >
                    Skip
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline-danger"
                  className="py-0.5 px-2 me-1"
                  onClick={() => { if (window.confirm(td('debateRoom.actions.surrenderConfirm'))) playerActionMutation.mutate('surrender'); }}
                  disabled={playerActionMutation.isPending}
                  style={{ fontSize: '9px' }}
                >
                  {td('debateRoom.actions.surrender')}
                </Button>
                <Button
                  size="sm"
                  variant="outline-info"
                  className="py-0.5 px-2"
                  onClick={() => playerActionMutation.mutate('draw')}
                  disabled={playerActionMutation.isPending}
                  style={{ fontSize: '9px' }}
                >
                  {td('debateRoom.actions.draw')}
                </Button>
              </div>
            )}

            {/* Bottom: Dedicated Viewer/Leave Quick actions - compact */}
            <div className="flex-shrink-0 text-center">
              <Button
                size="sm"
                variant="outline-light"
                onClick={() => {
                  const isOwner = currentParticipant?.roomRole === 'owner';
                  const otherParticipants = room?.participants.filter(p => p.userId !== user?._id) || [];
                  if (isOwner && otherParticipants.length > 0) {
                    setShowLeaveConfirmModal(true);
                  } else {
                    leaveMutation.mutate(undefined);
                  }
                }}
                disabled={leaveMutation.isPending}
                style={{ fontSize: '10px', padding: '0.2rem 0.8rem' }}
              >
                {td('debateRoom.leave.leaveRoom')}
              </Button>
            </div>

          </div>

          {/* === RIGHT SIDEBAR (Control Panel) === */}
          {/* Hidden on mobile, shown as fixed bottom sheet on tablet+, 320px fixed width */}
          <aside
            className="d-none d-md-flex flex-column border-start flex-shrink-0 overflow-hidden"
            style={{
              width: '320px',
              minWidth: '320px',
              height: '100%',
              background: 'rgba(18, 18, 31, 0.65)',
              backdropFilter: 'blur(10px)',
            }}
          >
            
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
                {td('debateRoom.admin.score')}
              </button>
              {hasHostControl && (
                <button
                  className={`flex-1 py-2.5 text-center border-0 text-uppercase ${sidebarTab === 'admin' ? 'text-neon-cyan font-weight-bold' : 'text-muted'}`}
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                    fontFamily: 'Orbitron',
                    background: sidebarTab === 'admin' ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                    borderBottom: sidebarTab === 'admin' ? '2px solid #00f5ff' : 'none',
                  }}
                  onClick={() => setSidebarTab('admin')}
                >
                  {td('debateRoom.admin.controlPanel')}
                </button>
              )}
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
                  {td('debateRoom.admin.privateRoom')}
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
                  {td('debateRoom.admin.chat')}
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
                      {td('debateRoom.judge.currentStandings')}
                    </h6>
                    <ScoreBreakdown finalScores={session.finalScores} />
                    
                    <Button
                      size="sm"
                      variant="outline-info"
                      className="mt-3 w-100"
                      onClick={() => setShowPreviousScoresModal(true)}
                      style={{ fontSize: '11px', fontFamily: 'Orbitron' }}
                    >
                      <i className="bi bi-journal-text me-1" />
                      {td('debateRoom.judge.roundScores')}
                    </Button>

                    {canManageScores && (
                      <div className="d-grid gap-2 mt-3">
                        <Button size="sm" variant="outline-primary" onClick={() => aggregateMutation.mutate()} disabled={aggregateMutation.isPending}>
                          {td('debateRoom.judge.aggregateScores')}
                        </Button>
                        <Button size="sm" variant="outline-success" onClick={() => winnerMutation.mutate()} disabled={winnerMutation.isPending}>
                          {td('debateRoom.judge.determineWinner')}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* List of Judges */}
                  <div className="border-top border-secondary border-opacity-20 pt-3">
                    <div className="text-muted small mb-2" style={{ fontFamily: 'Orbitron', fontSize: '11px' }}>{td('debateRoom.admin.title')}</div>
                    <ListGroup>
                      {judges.length ? (
                        judges.map((j) => (
                          <ListGroup.Item key={j.userId} className="bg-transparent text-white border-secondary border-opacity-25 py-2 px-3 small">
                            {j.username}
                          </ListGroup.Item>
                        ))
                      ) : (
                        <ListGroup.Item className="bg-transparent text-muted border-secondary border-opacity-25 py-2 px-3 small text-center">
                          {td('debateRoom.judge.noJudges')}
                        </ListGroup.Item>
                      )}
                    </ListGroup>
                  </div>

                  {/* Judge Rating Form */}
                  {isJudge && (
                    <div className="border-top border-secondary border-opacity-20 pt-3">
                      <h6 className="text-neon-yellow font-weight-bold mb-3" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                        {td('debateRoom.judge.quickReaction')}
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
                          {td('debateRoom.judge.agree')}
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
                          {td('debateRoom.judge.disagree')}
                        </Button>
                      </div>

                      <h6 className="text-neon-yellow font-weight-bold mb-3" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                        {td('debateRoom.judge.submitEvaluation')}
                      </h6>
                      <RoundJudgeForm
                        round={currentRound}
                        propSpeaker={resolvePropSpeakerForRound(currentRound, room?.format)}
                        oppSpeaker={resolveOppSpeakerForRound(currentRound, room?.format)}
                        propSpeak={roundPropSpeak}
                        propCe={roundPropCe}
                        propNotes={roundPropNotes}
                        oppSpeak={roundOppSpeak}
                        oppCe={roundOppCe}
                        oppNotes={roundOppNotes}
                        onPropSpeakChange={setRoundPropSpeak}
                        onPropCeChange={setRoundPropCe}
                        onPropNotesChange={setRoundPropNotes}
                        onOppSpeakChange={setRoundOppSpeak}
                        onOppCeChange={setRoundOppCe}
                        onOppNotesChange={setRoundOppNotes}
                        onSubmit={() => {
                          const propSpeaker = resolvePropSpeakerForRound(currentRound, room?.format);
                          const oppSpeaker = resolveOppSpeakerForRound(currentRound, room?.format);
                          if (!propSpeaker || !oppSpeaker) {
                            toast.error('Could not resolve speakers for this round');
                            return;
                          }
                          // Rule: Round 3 has no Cross Examination — send ce=0
                          const isRound3 = currentRound === 3;
                          roundScoreMutation.mutate({
                            round: currentRound as 1 | 2 | 3,
                            proposition: { speaker: propSpeaker, speak: roundPropSpeak, ce: isRound3 ? 0 : roundPropCe, notes: roundPropNotes },
                            opposition: { speaker: oppSpeaker, speak: roundOppSpeak, ce: isRound3 ? 0 : roundOppCe, notes: roundOppNotes },
                          });
                        }}
                        isPending={roundScoreMutation.isPending}
                        isSubmitEnabled={isScoringAllowed}
                      />
                    </div>
                  )}

                </div>
              )}

              {/* ADMIN PANEL TAB PANEL */}
              {sidebarTab === 'admin' && hasHostControl && (
                <div className="p-3 d-flex flex-column gap-3">
                  <h6 className="mb-0 text-uppercase text-muted" style={{ fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '0.05em' }}>
                    {td('debateRoom.admin.hostControlPanel')}
                  </h6>

                  {/* No-Host: S1 Start Panel */}
                  {room?.hostType === 'ai' && currentPhase === 'waiting_s1' && (
                    <div className="p-3 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-3">
                      <div className="text-success small mb-2 text-uppercase fw-bold" style={{ fontFamily: 'Orbitron', fontSize: '10px' }}>
                        {td('debateRoom.noHost.waitingForS1')}
                      </div>
                      <div className="text-muted small mb-2">
                        {td('debateRoom.noHost.s1MustStart')}
                      </div>
                      <div className="d-flex gap-2 align-items-center mb-2">
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: noHostS1Ready.includes(user?._id || '') ? '#00ff88' : 'rgba(255,255,255,0.2)',
                            boxShadow: noHostS1Ready.includes(user?._id || '') ? '0 0 8px #00ff88' : 'none',
                            flexShrink: 0,
                          }}
                        />
                        <span className="small text-white">
                          {noHostS1Ready.includes(user?._id || '')
                            ? td('debateRoom.noHost.youHaveStarted')
                            : td('debateRoom.noHost.youHaveNotStarted')}
                        </span>
                      </div>
                      {isS1Debater && (
                        <Button
                          size="sm"
                          className="w-100 fw-bold py-1.5"
                          style={{
                            background: noHostS1Ready.includes(user?._id || '') ? 'rgba(0,255,136,0.1)' : '#00ff66',
                            color: noHostS1Ready.includes(user?._id || '') ? '#00ff88' : '#000',
                            border: 'none',
                            fontSize: '11px',
                            boxShadow: noHostS1Ready.includes(user?._id || '') ? 'none' : '0 0 10px rgba(0,255,102,0.4)',
                          }}
                          onClick={() => noHostS1StartMutation.mutate()}
                          disabled={noHostS1StartMutation.isPending || noHostS1Ready.includes(user?._id || '')}
                        >
                          {noHostS1Ready.includes(user?._id || '') ? td('debateRoom.noHost.started') : td('debateRoom.actions.start')}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Host Phase & Timer Controls — only shown to authorized controllers */}
                  {hasHostControl && (
                  <div className="p-3 bg-secondary bg-opacity-5 border border-secondary border-opacity-25 rounded-3">
                    <div className="text-muted small mb-2 text-uppercase fw-bold" style={{ fontFamily: 'Orbitron', fontSize: '10px' }}>{td('debateRoom.debateControls')}</div>
                    <div className="d-flex flex-column gap-2 w-100">
                      <div className="d-flex gap-2 w-100">
                        <Button
                          size="sm"
                          className="flex-fill py-1.5 fw-bold"
                          style={{
                            background:
                              turnStatus === 'waiting_to_start' && !isJudge3
                                ? '#00ff66'
                                : 'rgba(255,255,255,0.05)',
                            color:
                              turnStatus === 'waiting_to_start' && !isJudge3
                                ? '#000'
                                : 'rgba(255, 255, 255, 0.3)',
                            border: 'none',
                            boxShadow:
                              turnStatus === 'waiting_to_start' && !isJudge3
                                ? '0 0 10px rgba(0, 255, 102, 0.4)'
                                : 'none',
                            fontSize: '11px',
                          }}
                          onClick={() => startPhaseMutation.mutate()}
                          disabled={
                            startPhaseMutation.isPending ||
                            isJudge3 ||
                            turnStatus !== 'waiting_to_start'
                          }
                        >
                          {td('debateRoom.actions.start')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="flex-fill py-1.5"
                          onClick={() => controlMutation.mutate('finish')}
                          disabled={
                            controlMutation.isPending ||
                            isJudge3 ||
                            // Phase must be actively running OR in judge_feedback /
                            // final_judging (free time per rules — Host can Skip to
                            // advance to the next round / phase).
                            (turnStatus !== 'active' &&
                              currentPhase !== 'judge_feedback' &&
                              currentPhase !== 'final_judging')
                          }
                          style={{ fontSize: '11px' }}
                        >
                          {td('debateRoom.actions.skip')}
                        </Button>
                      </div>
                      <div className="d-flex gap-2 w-100">
                        <Button
                          size="sm"
                          variant="outline-warning"
                          className="flex-fill py-1.5"
                          onClick={() => controlMutation.mutate(room?.status === 'paused' ? 'resume' : 'pause')}
                          disabled={controlMutation.isPending}
                          style={{ fontSize: '11px' }}
                        >
                          {room?.status === 'paused' ? td('debateRoom.actions.resume') : td('debateRoom.actions.pause')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          className="flex-fill py-1.5"
                          onClick={() => controlMutation.mutate('end')}
                          disabled={controlMutation.isPending}
                          style={{ fontSize: '11px' }}
                        >
                          {td('debateRoom.actions.end')}
                        </Button>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Participant Moderation Toggles */}
                  <div className="p-3 bg-secondary bg-opacity-5 border border-secondary border-opacity-25 rounded-3 d-flex flex-column gap-2">
                    <div className="text-muted small mb-1 text-uppercase fw-bold" style={{ fontFamily: 'Orbitron', fontSize: '10px' }}>{td('debateRoom.participantControls')}</div>
                    <div className="table-responsive" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                      <table className="table table-borderless table-sm align-middle text-white mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr className="text-muted" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <th className="py-2 ps-0 fw-normal">{td('debateRoom.user')}</th>
                            <th className="py-2 text-center fw-normal">{td('debateRoom.role')}</th>
                            <th className="py-2 text-center fw-normal">{td('debateRoom.cam')}</th>
                            <th className="py-2 text-center fw-normal">{td('debateRoom.mic')}</th>
                            <th className="py-2 text-center fw-normal">{td('debateRoom.chat')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(room?.participants || [])
                            .filter((p) => p.userId !== user?._id)
                            .map((p) => {
                              const isCamMuted = Boolean(p.cameraMuted);
                              const isMuted = Boolean(p.muted);
                              const isChatMuted = Boolean(p.chatMuted);
                              const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
                              const isSpectator = role === 'viewer';

                              let roleLabel = td('debateRoom.roles.viewer');
                              let roleBadgeBg = 'rgba(108, 117, 125, 0.2)';
                              let roleTextColor = '#a0a0a0';

                              if (role === 'debater') {
                                if (p.team === 'proposition') {
                                  roleLabel = `${td('debateRoom.roles.prop')} ${p.speakerSlot || ''}`;
                                  roleBadgeBg = 'rgba(0, 245, 255, 0.15)';
                                  roleTextColor = '#00f5ff';
                                } else if (p.team === 'opposition') {
                                  roleLabel = `${td('debateRoom.roles.opp')} ${p.speakerSlot || ''}`;
                                  roleBadgeBg = 'rgba(255, 0, 110, 0.15)';
                                  roleTextColor = '#ff006e';
                                } else {
                                  roleLabel = td('debateRoom.roles.speaker');
                                  roleBadgeBg = 'rgba(255, 255, 255, 0.1)';
                                  roleTextColor = '#ffffff';
                                }
                              } else if (role === 'judge') {
                                roleLabel = td('debateRoom.roles.judge');
                                roleBadgeBg = 'rgba(255, 214, 10, 0.15)';
                                roleTextColor = '#ffd60a';
                              } else if (role === 'host') {
                                roleLabel = td('debateRoom.roles.host');
                                roleBadgeBg = 'rgba(255, 165, 0, 0.15)';
                                roleTextColor = '#ffa500';
                              } else if (p.roomRole === 'owner') {
                                roleLabel = td('debateRoom.roles.owner');
                                roleBadgeBg = 'rgba(255, 165, 0, 0.15)';
                                roleTextColor = '#ffa500';
                              }

                              return (
                                <tr key={p.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td className="py-2 ps-0 text-truncate fw-semibold" style={{ maxWidth: '90px' }} title={p.username}>
                                    {p.username}
                                  </td>
                                  <td className="py-2 text-center">
                                    <span
                                      className="px-1.5 py-0.5 rounded text-uppercase font-monospace"
                                      style={{
                                        fontSize: '0.6rem',
                                        background: roleBadgeBg,
                                        color: roleTextColor,
                                        border: `1px solid ${roleTextColor}20`,
                                      }}
                                    >
                                      {roleLabel}
                                    </span>
                                  </td>
                                  <td className="py-2 text-center">
                                    {isSpectator ? (
                                      <span className="text-muted">—</span>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="link"
                                        className="p-0 border-0 text-decoration-none"
                                        onClick={() => toggleCameraMutation.mutate({ userId: p.userId, action: isCamMuted ? 'unmute' : 'mute' })}
                                        disabled={toggleCameraMutation.isPending}
                                      >
                                        <i className={`bi ${isCamMuted ? 'bi-camera-video-off-fill text-danger' : 'bi-camera-video-fill text-success'}`} style={{ fontSize: '0.9rem' }} />
                                      </Button>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    {isSpectator ? (
                                      <span className="text-muted">—</span>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="link"
                                        className="p-0 border-0 text-decoration-none"
                                        onClick={() => toggleMicMutation.mutate({ userId: p.userId, action: isMuted ? 'unmute' : 'mute' })}
                                        disabled={toggleMicMutation.isPending}
                                      >
                                        <i className={`bi ${isMuted ? 'bi-mic-mute-fill text-danger' : 'bi-mic-fill text-success'}`} style={{ fontSize: '0.9rem' }} />
                                      </Button>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    <Button
                                      size="sm"
                                      variant="link"
                                      className="p-0 border-0 text-decoration-none d-inline-flex align-items-center justify-content-center"
                                      onClick={() => toggleChatMutation.mutate({ userId: p.userId, action: isChatMuted ? 'unmute' : 'mute' })}
                                      disabled={toggleChatMutation.isPending}
                                      title={isChatMuted ? 'Unban chat' : 'Ban chat'}
                                    >
                                      {isChatMuted ? (
                                        <span className="position-relative d-inline-flex align-items-center justify-content-center" style={{ width: '1.2rem', height: '1.2rem' }}>
                                          <i className="bi bi-chat-fill text-danger" style={{ fontSize: '0.9rem', opacity: 0.6 }} />
                                          <i className="bi bi-slash position-absolute text-danger fw-bold" style={{ fontSize: '1.2rem' }} />
                                        </span>
                                      ) : (
                                        <i className="bi bi-chat-fill text-success" style={{ fontSize: '0.9rem' }} />
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          {(room?.participants || []).filter((p) => p.userId !== user?._id).length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center text-muted py-3">
                                {td('debateRoom.errors.noOtherParticipants')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PRIVATE PREP ROOM TAB PANEL */}
              {sidebarTab === 'private' && canAccessPrivateRooms && (
                <div className="p-3">
                  <div className="d-flex align-items-center mb-2">
                    <h6 className="mb-0 text-uppercase text-muted" style={{ fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '0.05em' }}>
                      {td('debateRoom.admin.privateRoom')}
                    </h6>
                  </div>
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

      {/* Mobile: Bottom action bar for sidebar controls */}
      <div
        className="d-md-none position-fixed bottom-0 start-0 end-0 bg-dark border-top border-neon border-opacity-50 p-2"
        style={{ zIndex: 1040, backdropFilter: 'blur(10px)' }}
      >
        <div className="d-flex justify-content-around">
          <button
            className={`btn btn-sm ${sidebarTab === 'scoring' ? 'btn-outline-info' : 'btn-outline-secondary'}`}
            onClick={() => setSidebarTab('scoring')}
            style={{ fontSize: '10px' }}
          >
            <i className="bi bi-star-fill d-block" style={{ fontSize: '14px' }}></i>
            {td('debateRoom.admin.score')}
          </button>
          {hasHostControl && (
            <button
              className={`btn btn-sm ${sidebarTab === 'admin' ? 'btn-outline-info' : 'btn-outline-secondary'}`}
              onClick={() => setSidebarTab('admin')}
              style={{ fontSize: '10px' }}
            >
              <i className="bi bi-shield-lock-fill d-block" style={{ fontSize: '14px' }}></i>
              {td('debateRoom.admin.title')}
            </button>
          )}
          {canAccessPrivateRooms && (
            <button
              className={`btn btn-sm ${sidebarTab === 'private' ? 'btn-outline-warning' : 'btn-outline-secondary'}`}
              onClick={() => setSidebarTab('private')}
              style={{ fontSize: '10px' }}
            >
              <i className="bi bi-door-closed-fill d-block" style={{ fontSize: '14px' }}></i>
              {td('debateRoom.preparation')}
            </button>
          )}
                {sidebarTab === 'viewer-chat' && (isViewer || myRole === 'host' || myRole === 'owner') && (
                  <button
                    className={`btn btn-sm ${sidebarTab === 'viewer-chat' ? 'btn-outline-info' : 'btn-outline-secondary'}`}
                    onClick={() => setSidebarTab('viewer-chat')}
                    style={{ fontSize: '10px' }}
                  >
                    <i className="bi bi-chat-dots-fill d-block" style={{ fontSize: '14px' }}></i>
                    {td('debateRoom.admin.chat')}
                  </button>
                )}
        </div>
      </div>

      {/* === RULES OVERLAY MODAL === */}
      <Modal show={showRules} onHide={() => setShowRules(false)} size="lg" centered className="dark-theme-modal">
        <Modal.Header closeButton className="border-neon bg-dark text-white border-opacity-20">
          <Modal.Title style={{ fontFamily: 'Orbitron', fontSize: '16px' }}>{td('debateRoom.rules.title')}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px' }}>
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>{td('debateRoom.rules.generalStructure')}</h5>
          <p className="text-muted mb-3">{td('debateRoom.rules.structureDesc')}</p>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>{td('debateRoom.rules.motion')}</strong> {td('debateRoom.rules.motionDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.prep7')}</strong> {td('debateRoom.rules.prep7Desc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.speeches')}</strong> {td('debateRoom.rules.speechesDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.crossExam')}</strong> {td('debateRoom.rules.crossExamDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.judgeFeedback')}</strong> {td('debateRoom.rules.judgeFeedbackDesc')}</li>
          </ul>

          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>{td('debateRoom.rules.speakerPositions')}</h5>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>{td('debateRoom.rules.s1')}</strong> {td('debateRoom.rules.s1Desc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.s2')}</strong> {td('debateRoom.rules.s2Desc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.s3')}</strong> {td('debateRoom.rules.s3Desc')}</li>
          </ul>

          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>{td('debateRoom.rules.scoringCriteria')}</h5>
          <p className="text-muted mb-3">{td('debateRoom.rules.scoringCriteriaDesc')}</p>
          <ul className="mb-0" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>{td('debateRoom.rules.logic', { max: 30 })}</strong> {td('debateRoom.rules.logicDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.rebuttal', { max: 20 })}</strong> {td('debateRoom.rules.rebuttalDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.evidence', { max: 15 })}</strong> {td('debateRoom.rules.evidenceDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.crossExamCriteria', { max: 15 })}</strong> {td('debateRoom.rules.crossExamCriteriaDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.strategy', { max: 10 })}</strong> {td('debateRoom.rules.strategyDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.communication', { max: 10 })}</strong> {td('debateRoom.rules.communicationDesc')}</li>
          </ul>
        </Modal.Body>
        <Modal.Footer className="border-neon bg-dark border-opacity-20">
          <Button size="sm" variant="outline-primary" onClick={() => setShowRules(false)}>
            {td('debateRoom.rules.closeRules')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* === LEAVE CONFIRMATION MODAL === */}
      <Modal
        show={showLeaveConfirmModal}
        onHide={() => setShowLeaveConfirmModal(false)}
        centered
        className="dark-theme-modal"
      >
        <Modal.Header closeButton className="border-neon bg-dark text-white border-opacity-20">
          <Modal.Title style={{ fontFamily: 'Orbitron', fontSize: '16px' }}>
            {td('debateRoom.leave.title')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px' }}>
          <p className="mb-3">
            {td('debateRoom.leave.ownerWarning')}
          </p>

          {room?.participants && room.participants.filter(p => p.userId !== user?._id).length > 0 ? (
            <>
              <p className="text-secondary small mb-3">
                {td('debateRoom.leave.ownerWarning2')}
              </p>
              <div className="list-group list-group-flush mb-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {room.participants
                  .filter((p) => p.userId !== user?._id)
                  .map((p) => (
                    <button
                      key={p.userId}
                      className="list-group-item list-group-item-action bg-dark text-white border-secondary border-opacity-20 d-flex align-items-center justify-content-between py-2 px-3"
                      onClick={() => {
                        setShowLeaveConfirmModal(false);
                        leaveMutation.mutate(p.userId);
                      }}
                    >
                      <div className="d-flex align-items-center">
                        <img
                          src={p.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80'}
                          alt={p.username}
                          className="rounded-circle me-2"
                          style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                        />
                        <span>{p.username}</span>
                      </div>
                      <span className="badge bg-primary text-capitalize">
                        {p.roomRole === 'owner' ? p.primaryRole || 'owner' : (p.roomRole === 'debater' ? p.primaryRole || 'debater' : p.roomRole)}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-secondary small mb-4">
              {td('debateRoom.leave.onlyOneWarning')}
            </p>
          )}

          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-light" size="sm" onClick={() => setShowLeaveConfirmModal(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowLeaveConfirmModal(false);
                leaveMutation.mutate(undefined);
              }}
            >
              {td('debateRoom.leave.leaveNow')}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* === 3S COUNTDOWN OVERLAY (post-start countdown) === */}
      {/* Visual style: semi-transparent so users see the underlying debate room
          structure during the 3s countdown. The countdown number alone on a
          fully opaque dark background reads as a "black screen" — show the
          next phase label and the workflow stage alongside the digit. */}
      {countdownSeconds !== null && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
          style={{
            zIndex: 9999,
            background: 'rgba(10, 10, 18, 0.55)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <style>{`
            @keyframes zoomInScale {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-zoom-scale {
              animation: zoomInScale 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
            }
          `}</style>
          <div className="animate-zoom-scale text-center" key={countdownSeconds}>
            <p
              className="mb-2 text-uppercase text-secondary"
              style={{ fontFamily: 'Orbitron', fontSize: '12px', letterSpacing: '4px' }}
            >
              {currentWorkflowStep?.label
                ? td('debateRoom.countdown.startsIn', { label: currentWorkflowStep.label })
                : td('debateRoom.countdown.matchStarting')}
            </p>
            <h1
              className="m-0 text-neon-cyan"
              style={{
                fontFamily: 'Orbitron',
                fontSize: countdownSeconds === 'GO!' ? '120px' : '150px',
                fontWeight: 900,
                textShadow: '0 0 20px rgba(0, 242, 254, 0.8), 0 0 40px rgba(0, 242, 254, 0.4)',
              }}
            >
              {countdownSeconds}
            </h1>
            <p
              className="mt-3 mb-0 text-uppercase text-secondary"
              style={{ fontFamily: 'Orbitron', fontSize: '14px', letterSpacing: '3px' }}
            >
              {countdownSeconds === 'GO!' ? t('startNow') : t('startingSoon')}
            </p>
          </div>
        </div>
      )}

      {/* PREVIOUS SCORES MODAL */}
      <Modal
        show={showPreviousScoresModal}
        onHide={() => setShowPreviousScoresModal(false)}
        size="lg"
        centered
        className="bg-opacity-50"
      >
        <Modal.Header closeButton className="bg-dark text-white border-secondary border-opacity-20">
          <Modal.Title style={{ fontFamily: 'Orbitron', fontSize: '14px' }} className="text-neon-cyan text-uppercase font-weight-bold">
            <i className="bi bi-journal-text me-2" />
            {td('debateRoom.judge.roundScores')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="d-flex flex-column gap-4">
            {[1, 2, 3].map((rNum) => {
              
              const propSpk = resolvePropSpeakerForRound(rNum, room?.format);
              const oppSpk = resolveOppSpeakerForRound(rNum, room?.format);
              
              const verdicts = session?.finalScores?.judgeVerdicts || [];
              const propVerdicts = verdicts.filter((v: any) => v.speaker === propSpk);
              const oppVerdicts = verdicts.filter((v: any) => v.speaker === oppSpk);
              
              const allVectIdx = Array.from(new Set([
                ...propVerdicts.map((v: any) => v.judgeId?.toString()),
                ...oppVerdicts.map((v: any) => v.judgeId?.toString())
              ]));

              return (
                <div key={rNum} className="p-3 rounded-3 bg-secondary bg-opacity-5 border border-secondary border-opacity-10">
                  <h5 className="text-neon-yellow border-bottom border-secondary border-opacity-15 pb-2 mb-3 text-uppercase font-weight-bold" style={{ fontFamily: 'Orbitron', fontSize: '12px' }}>
                    {td('debateRoom.previousScores.round', { round: rNum })} ({propSpk} vs {oppSpk})
                  </h5>
                  
                  {allVectIdx.length === 0 ? (
                    <div className="text-muted small italic">{td('debateRoom.judge.notYetSubmitted')}</div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {allVectIdx.map((jId) => {
                        const propV = propVerdicts.find((v: any) => v.judgeId?.toString() === jId);
                        const oppV = oppVerdicts.find((v: any) => v.judgeId?.toString() === jId);
                        const judgeName = propV?.judgeName || oppV?.judgeName || td('debateRoom.roles.judge');
                        
                        return (
                          <div key={jId} className="bg-black bg-opacity-25 rounded p-3 border-start border-neon-cyan border-2">
                            <div className="fw-bold text-white mb-2 small">{judgeName}</div>
                            <Row>
                              <Col md={6} className="mb-2 mb-md-0">
                                <div className="text-neon-cyan small fw-bold mb-1">{td('debateRoom.proposition')}</div>
                                {propV ? (
                                  <div className="small">
                                      <div className="mb-1 text-white-50">
                                      {td('debateRoom.scoreBreakdown.speak')} <strong className="text-white">{(propV.score as any)?.logic ?? 0}</strong>/20
                                      {rNum !== 3 && <> | {td('debateRoom.scoreBreakdown.ce')} <strong className="text-white">{(propV.score as any)?.crossExam ?? 0}</strong>/20</>}
                                    </div>
                                    {propV.notes && (
                                      <div className="text-light italic text-opacity-80" style={{ fontSize: '10px' }}>
                                        &ldquo;{propV.notes}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-muted small">{td('debateRoom.judge.noSubmitted')}</div>
                                )}
                              </Col>
                              <Col md={6}>
                                <div className="text-neon-pink small fw-bold mb-1">{td('debateRoom.opposition')}</div>
                                {oppV ? (
                                  <div className="small">
                                      <div className="mb-1 text-white-50">
                                      {td('debateRoom.scoreBreakdown.speak')} <strong className="text-white">{(oppV.score as any)?.logic ?? 0}</strong>/20
                                      {rNum !== 3 && <> | {td('debateRoom.scoreBreakdown.ce')} <strong className="text-white">{(oppV.score as any)?.crossExam ?? 0}</strong>/20</>}
                                    </div>
                                    {oppV.notes && (
                                      <div className="text-light italic text-opacity-80" style={{ fontSize: '10px' }}>
                                        &ldquo;{oppV.notes}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-muted small">{td('debateRoom.judge.noSubmitted')}</div>
                                )}
                              </Col>
                            </Row>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Modal.Body>
      </Modal>

    </>
  );
}

function ScoreBreakdown({ finalScores }: { finalScores: any }) {
  const { t } = useTranslation('debate');
  const pro = finalScores?.teamProposition?.total || 0;
  const opp = finalScores?.teamOpposition?.total || 0;
  const total = Math.max(pro + opp, 1);

  return (
    <>
      <div className="mb-2 text-muted small">{t('debateRoom.proposition')}</div>
      <ProgressBar now={(pro / total) * 100} label={String(Math.round(pro))} className="mb-3" />
      <div className="mb-2 text-muted small">{t('debateRoom.opposition')}</div>
      <ProgressBar now={(opp / total) * 100} label={String(Math.round(opp))} variant="danger" className="mb-3" />
      <Alert variant={finalScores?.winner ? 'success' : 'secondary'} className="mb-0 py-2 px-3 small border-secondary border-opacity-20 bg-dark text-white">
        {t('debateRoom.winner.label')} <span className="text-capitalize text-neon-cyan font-weight-bold">{finalScores?.winner || t('debateRoom.winner.waiting')}</span>
      </Alert>
    </>
  );
}

export function resolvePropSpeakerForRound(round: number, _format?: string): SpeakerTurn | null {
  if (round === 1) return 'PRO_S1';
  if (round === 2) return 'PRO_S2';
  return 'PRO_S3';
}

export function resolveOppSpeakerForRound(round: number, _format?: string): SpeakerTurn | null {
  if (round === 1) return 'OPP_S1';
  if (round === 2) return 'OPP_S2';
  return 'OPP_S3';
}

export function getRoundForStepIndex(index: number, format?: string, _hostType?: string): 1 | 2 | 3 {
  // All 4 flows (Host/NoHost × 3v3/1v1) now have the same step order:
  // [HOST, PREP, R1 speeches+CE+FB, R2 speeches+CE+FB, R3 speeches+FB, FINAL_JUDGING, COMPLETED]
  // R1: indices 2-5, R2: indices 6-9, R3: indices 10-12
  if (index === -1) return 1;
  if (format === '1v1') {
    // 1v1: same structure but all steps are unique speakers per round
    if (index <= 5) return 1;   // HOST,PREP,PRO_S1,OPP_S1,CE1,JUDGES_FB_1
    if (index <= 9) return 2;   // OPP_S2,PRO_S2,CE2,JUDGES_FB_2
    return 3;                   // OPP_S3,PRO_S3,JUDGES_FB_3
  }
  // 3v3: same step count as 1v1
  if (index <= 5) return 1;   // HOST,PREP,PRO_S1,OPP_S1,CE1,JUDGES_FB_1
  if (index <= 9) return 2;   // PRO_S2,OPP_S2,CE2,JUDGES_FB_2
  return 3;                   // OPP_S3,PRO_S3,JUDGES_FB_3
}

