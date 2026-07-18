import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Button as RBButton,
  Card,
  Col,
  Container,
  Form,
  ProgressBar,
  Row,
  Spinner,
  Modal,
} from 'react-bootstrap';
const Button = RBButton as any;
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
import { CrossExamPanel } from '@components/debate/CrossExamPanel';
import { MicToggle } from '@components/debate/MicToggle';
import { LiveTranslationCaptions, type CaptionMode } from '@components/debate/LiveTranslationCaptions';
import { MainRoomChat } from '@components/chat/MainRoomChat';
import { ViewerChat } from '@components/chat/ViewerChat';
import { ReconnectOverlay } from '@components/common/ReconnectOverlay';
import { PauseOverlay } from '@components/debate/PauseOverlay';
import { DisconnectTimer } from '@components/debate/DisconnectTimer';
import { TransitionPopup } from '@components/debate/TransitionPopup';
import { ResultBanner } from '@components/debate/ResultBanner';
import { AIFeedbackPopup } from '@components/debate/AIFeedbackPopup';
import { RoundJudgeForm, detectCurrentRound } from '@components/debate/RoundJudgeForm';
import { DebateRoomHeader } from '@components/debate/dashboard/DebateRoomHeader';
import { DebateParticipantPodium } from '@components/debate/dashboard/DebateParticipantPodium';
import { DebateMotionStage } from '@components/debate/dashboard/DebateMotionStage';
import type { DebateMotionNotification } from '@components/debate/dashboard/DebateMotionStage';
import { DebateRightRail } from '@components/debate/dashboard/DebateRightRail';
import { DebateHostControlPanel } from '@components/debate/dashboard/DebateHostControlPanel';
import '../../styles/customRoom.css';
import type {
  RoomParticipant,
  SpeakerTurn,
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
 * Rule order: R1(Prop→Opp→CE), R2(Prop→Opp→CE), R3(Prop→Opp, no CE)
 * R2: "(Same flow as Round 1)" → PRO_S2 first, OPP_S2 second
 * R3: Proposition FIRST per requirement: Prop→Opp → JUDGES_FB_3 → COMPLETED
 */
const debateWorkflow3v3: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Proposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'Cross-examination 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge Feedback 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Proposition S2', detail: 'Extension (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opposition S2', detail: 'Extension (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'Cross-examination 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge Feedback 2', detail: 'Free discussion' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Proposition S3', detail: 'Closing (3 min)' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opposition S3', detail: 'Closing (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge Feedback 3', detail: 'Free discussion' },
  { speaker: 'COMPLETE_REVIEW', phase: 'completed', label: 'Review', detail: 'Host can end match (5 min countdown)' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * Human Host 1v1 workflow — mirrors backend DEBATE_FLOW_HOST_1V1.
 * R2: OPP→PRO (per "Same flow as Round 1"), R3: Prop→Opp → JUDGES_FB_3 → COMPLETED
 */
const debateWorkflow1v1: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Proposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'Cross-examination 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge Feedback 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Proposition S2', detail: 'Closing speech (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opposition S2', detail: 'Closing speech (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'Cross-examination 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge Feedback 2', detail: 'Free discussion' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Proposition S3', detail: 'Closing speech (3 min)' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opposition S3', detail: 'Closing speech (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge Feedback 3', detail: 'Free discussion' },
  { speaker: 'COMPLETE_REVIEW', phase: 'completed', label: 'Review', detail: 'Host can end match (5 min countdown)' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * No-Host 3v3 workflow — mirrors backend DEBATE_FLOW_NOHost_3V3.
 * R2: PRO→OPP (per "Same flow as Round 1"), R3: Prop→Opp → JUDGES_FB_3 → COMPLETED
 */
const debateWorkflowNoHost3v3: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Proposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'Cross-examination 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge Feedback 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Proposition S2', detail: 'Extension (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opposition S2', detail: 'Extension (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'Cross-examination 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge Feedback 2', detail: 'Free discussion' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Proposition S3', detail: 'Closing (3 min)' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opposition S3', detail: 'Closing (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge Feedback 3', detail: 'Free discussion' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Match ended' },
];

/**
 * No-Host 1v1 workflow — mirrors backend DEBATE_FLOW_NOHost_1V1.
 * R2: PRO→OPP (per "Same flow as Round 1"), R3: Prop→Opp → JUDGES_FB_3 → COMPLETED
 */
const debateWorkflowNoHost1v1: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Announce topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Proposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opposition S1', detail: 'Opening speech (3 min)' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'Cross-examination 1', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge Feedback 1', detail: 'Free discussion' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Proposition S2', detail: 'Closing speech (3 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opposition S2', detail: 'Closing speech (3 min)' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'Cross-examination 2', detail: 'Cross examination (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge Feedback 2', detail: 'Free discussion' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Proposition S3', detail: 'Closing speech (3 min)' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opposition S3', detail: 'Closing speech (3 min)' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge Feedback 3', detail: 'Free discussion' },
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
      const onCountdownStart = (data?: { durationMs?: number }) => {
        setCountdownSeconds(data?.durationMs ? Math.round(data.durationMs / 1000) : 3);
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
  const turnStatus = useDebateStore((s) => s.turnStatus);
  const speakingAllowed = useDebateStore((s) => s.speakingAllowed);
  const prepConsensusReadyUserIds = useDebateStore((s) => s.prepConsensusReadyUserIds);

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
  const { cameraActive, peers: videoPeers, localStream, startCamera, stopCamera } =
    useDebateVideo({ roomId, enabled: debateStartedEffective });

  const remoteVideoStreamsByUserId = useMemo(() => {
    const streams = new Map<string, MediaStream>();
    videoPeers.forEach((peer) => {
      if (peer.userId && peer.stream) {
        streams.set(peer.userId, peer.stream);
      }
    });
    return streams;
  }, [videoPeers]);

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
    const isHumanJudge = roomFromStore?.judgeType === 'human';

    let workflow = isNoHost
      ? (format === '1v1' ? debateWorkflowNoHost1v1 : debateWorkflowNoHost3v3)
      : (format === '1v1' ? debateWorkflow1v1 : debateWorkflow3v3);

    // Host + Human Judge: Round 2 (OPP_S2 before PRO_S2)
    if (!isNoHost && isHumanJudge) {
      workflow = workflow.map((step) => {
        if (step.speaker === 'PRO_S2') return { ...step, speaker: 'OPP_S2', label: format === '1v1' ? 'Opposition S2' : 'Opposition S2' };
        if (step.speaker === 'OPP_S2') return { ...step, speaker: 'PRO_S2', label: format === '1v1' ? 'Proposition S2' : 'Proposition S2' };
        return step;
      });
    }

    return workflow;
  }, [roomFromStore?.format, roomFromStore?.hostType, roomFromStore?.judgeType]);

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
  const myRole = effectiveRole;

  const isHost = Boolean(effectiveRole === 'host');
  const isS1Debater = effectiveRole === 'debater' && (currentParticipant as any)?.speakerSlot === 'S1';
  // Judge S1 has host-equivalent permissions in no-host + human-judge rooms
  const isNoHost = room?.hostType !== 'human';
  const isNoHostHumanJudge = isNoHost && room?.judgeType === 'human';
  // Identify Judge S1: prefer explicit slot, fall back to first judge in the room.
  // The backend assigns `speakerSlot = null` on judge role, so we must derive S1
  // from the order of room.judges (or treat any single judge as S1 in 1v1).
  // Owner-as-Judge is also recognized: when the room creator took judge role,
  // they are not pushed into room.judges by the backend, so we still treat
  // them as the S1 judge if they are the only judge in the room.
  const mySpeakerSlot = (currentParticipant as any)?.speakerSlot as string | null | undefined;
  const judgesList = (room?.judges as any[]) || [];
  const myJudgeIndex = judgesList.findIndex(
    (j) => j.userId?.toString() === user?._id?.toString(),
  );
  const isOnlyJudgeInList = judgesList.length === 1 && myJudgeIndex === 0;
  const isFirstJudgeInList = myJudgeIndex === 0;
  // Count owner-as-judge too — owner judges live in participants but not in room.judges.
  const ownerAsJudgeCount =
    effectiveRole === 'judge' &&
    currentParticipant?.roomRole === 'owner' &&
    !judgesList.some((j) => j.userId?.toString() === user?._id?.toString())
      ? 1
      : 0;
  const totalJudges = judgesList.length + ownerAsJudgeCount;
  const isSoleJudgeAnywhere =
    effectiveRole === 'judge' &&
    ((room?.format === '1v1' && totalJudges === 1 && (isOnlyJudgeInList || ownerAsJudgeCount === 1)) ||
      (room?.format !== '1v1' && isFirstJudgeInList));
  const isJudgeS1 =
    effectiveRole === 'judge' &&
    (mySpeakerSlot === 'S1' ||
      mySpeakerSlot === undefined ||
      // In 1v1, a single judge always acts as S1
      (room?.format === '1v1' && isSoleJudgeAnywhere) ||
      // In 3v3, the first judge in the judges list is Judge S1
      isFirstJudgeInList);
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
  // Keep both chat channels visible to every room participant. ViewerChat
  // remains responsible for role-based send permissions.
  const canAccessViewerChat = isParticipant || isViewer;
  const judges: RoomParticipant[] = room?.participants.filter((p) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'judge';
  }) || [];

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


  // Speech phase: mic enabled for current speaker.
  // Speaker must match the team. Slot match is required only for 3v3 — in 1v1 a
  // participant with slot S1 represents the same person for S1/S2/S3 (per the
  // 1v1 rule: each team has 1 speaker who handles all 3 rounds).
  const currentSpeakerTeam = currentSpeaker?.startsWith('PRO_') ? 'proposition' : 'opposition';
  const currentSpeakerSlot = currentSpeaker?.startsWith('PRO_S1')
    || currentSpeaker?.startsWith('OPP_S1') ? 'S1'
    : currentSpeaker?.startsWith('PRO_S2') || currentSpeaker?.startsWith('OPP_S2') ? 'S2'
    : currentSpeaker?.startsWith('PRO_S3') || currentSpeaker?.startsWith('OPP_S3') ? 'S3'
    : null;
  const is1v1 = room?.format === '1v1';
  const isMyTurnToSpeak =
    effectiveRole === 'debater' &&
    currentParticipant?.team === currentSpeakerTeam &&
    currentPhase === 'speech' &&
    (is1v1
      ? true
      : currentSpeakerSlot === null || currentParticipant?.speakerSlot === currentSpeakerSlot);


  // Gemini's input transcript replaces the browser-only speech recognition
  // as the transcript that is persisted for the active speaker's turn.
  const handleOwnSourceTranscript = useCallback((text: string) => {
    if (isMyTurnToSpeak) setTurnTranscript(text);
  }, [isMyTurnToSpeak]);

  const progress = useMemo(() => {
    if (!totalTime) return 0;
    return Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100));
  }, [timeRemaining, totalTime]);

  // MicToggle observes isPaused through its disabled prop and stops its stream.
  useEffect(() => {
    if (isPaused && cameraActive) {
      stopCamera();
    }
  }, [isPaused, cameraActive, stopCamera]);

  useEffect(() => {
    if (!opponentPendingDraw || !pendingDrawRequest) return;
    const requestKey = `${pendingDrawRequest.team}:${pendingDrawRequest.requestedAt}`;
    if (lastNotifiedDrawRequestRef.current === requestKey) return;
    lastNotifiedDrawRequestRef.current = requestKey;
    toast(`${pendingDrawRequest.requestedByName || 'Opponent'} requested a draw`);
  }, [opponentPendingDraw, pendingDrawRequest]);
  
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

  const storeScoringRound = useMemo(
    () => getScoringRoundFromPhaseSpeaker(currentPhase, currentSpeaker),
    [currentPhase, currentSpeaker],
  );
  const sessionScoringRound = useMemo(
    () => getScoringRoundFromPhaseSpeaker(session?.currentTurn?.phase, session?.currentTurn?.speaker),
    [session?.currentTurn?.phase, session?.currentTurn?.speaker],
  );
  const activeScoringRound = useMemo(() => {
    const storeHasPhase = Boolean(currentPhase);
    const storeIsScoringPhase = isScoringPhase(currentPhase);
    const sessionIsScoringPhase = isScoringPhase(session?.currentTurn?.phase);

    if (storeHasPhase && !storeIsScoringPhase) return 0;
    if (!storeHasPhase && session?.currentTurn?.phase && !sessionIsScoringPhase) return 0;
    if (storeIsScoringPhase && !sessionIsScoringPhase) return storeScoringRound;
    if (!storeIsScoringPhase && sessionIsScoringPhase) return sessionScoringRound;

    const rounds = [storeScoringRound, sessionScoringRound].filter((round): round is 1 | 2 | 3 => round > 0);
    if (!rounds.length) return 0;
    return Math.max(...rounds) as 1 | 2 | 3;
  }, [
    currentPhase,
    session?.currentTurn?.phase,
    storeScoringRound,
    sessionScoringRound,
  ]);

  const currentRound = useMemo(() => {
    if (activeScoringRound) return activeScoringRound;
    return getRoundForStepIndex(currentWorkflowIndex, room?.format, room?.hostType);
  }, [activeScoringRound, currentWorkflowIndex, room?.format, room?.hostType]);

  const isScoringAllowed = useMemo(() => {
    return activeScoringRound > 0;
  }, [activeScoringRound]);

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

  const motionNotifications = useMemo<DebateMotionNotification[]>(() => {
    const entries: Array<{ notification: DebateMotionNotification; timestamp: number }> = [];

    (session?.finalScores?.judgeVerdicts || []).forEach((verdict, index) => {
      const speaker = String(verdict.speaker || '');
      const team = speaker.startsWith('PRO_') ? 'Proposition' : speaker.startsWith('OPP_') ? 'Opposition' : 'Speaker';
      const roundMatch = speaker.match(/_S(\d)$/);
      const round = roundMatch ? `Round ${roundMatch[1]}` : speaker.replace(/_/g, ' ');
      const speakScore = Number(verdict.score?.logic ?? 0);
      const crossExamScore = Number(verdict.score?.crossExam ?? 0);
      const overallScore = Number(verdict.score?.overall ?? speakScore + crossExamScore);
      const scoreSummary = `Speak ${speakScore}/20 · CE ${crossExamScore}/20 · Overall ${overallScore}`;
      const notes = verdict.notes?.trim();
      const submittedAt = verdict.submittedAt ? new Date(verdict.submittedAt) : null;

      entries.push({
        notification: {
          id: `judge-${verdict.judgeId || verdict.source || 'unknown'}-${speaker}-${index}`,
          title: `${verdict.judgeName || (verdict.source === 'ai' ? 'AI Judge' : 'Judge')} scored ${team} · ${round}`,
          detail: notes ? `${scoreSummary} — ${notes}` : scoreSummary,
          meta: verdict.source === 'ai' ? 'AI' : 'Judge',
          tone: 'score',
        },
        timestamp: submittedAt && !Number.isNaN(submittedAt.getTime()) ? submittedAt.getTime() : index,
      });
    });

    messages.forEach((message, index) => {
      if (message.type !== 'system' && message.senderId !== 'system') return;
      const createdAt = message.timestamp ? new Date(message.timestamp) : null;
      entries.push({
        notification: {
          id: `system-${message._id || index}`,
          title: 'System update',
          detail: message.content,
          meta: 'System',
          tone: 'system',
        },
        timestamp: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : index,
      });
    });

    return entries
      .sort((left, right) => right.timestamp - left.timestamp)
      .map((entry) => entry.notification);
  }, [messages, session?.finalScores?.judgeVerdicts]);

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
    console.warn('[DebateRoom] REST room fetch failed', roomQuery.error);
  }, [roomQuery.isError, roomQuery.error]);

  useEffect(() => {
    if (!socketPending) return;
    const timer = window.setTimeout(() => {
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
            {td('debateRoom.privateRoom', 'PRIVATE DEBATE ROOM')}
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

  const scorePanelContent = (
    <div className="debate-rail-score-workspace">
      <div className="debate-rail-score-summary">
        <div className="debate-operation-section-heading">
          <span>Current standings</span>
          <Button size="sm" variant="outline-info" onClick={() => setShowPreviousScoresModal(true)}>
            <i className="bi bi-journal-text" aria-hidden="true" /> Rounds
          </Button>
        </div>
        <ScoreBreakdown finalScores={session.finalScores} />
        <div className="debate-assigned-judges">
          <span>Assigned judges</span>
          <div>
            {judges.length ? judges.map((judge) => (
              <span key={judge.userId}><i className="bi bi-award-fill" aria-hidden="true" /> {judge.username}</span>
            )) : <small>No judges assigned</small>}
          </div>
        </div>
      </div>

      {isJudge && (
        <div className="debate-rail-judge-workspace">
          <div className="debate-judge-reactions">
            <span>Quick reaction</span>
            <div>
              <Button
                size="sm"
                variant="outline-info"
                onClick={() => getSocket()?.emit('judge:reaction', { roomId, type: 'agree' })}
              >
                <i className="bi bi-hand-thumbs-up-fill" aria-hidden="true" /> Agree
              </Button>
              <Button
                size="sm"
                variant="outline-danger"
                onClick={() => getSocket()?.emit('judge:reaction', { roomId, type: 'disagree' })}
              >
                <i className="bi bi-hand-thumbs-down-fill" aria-hidden="true" /> Disagree
              </Button>
            </div>
          </div>
          <RoundJudgeForm
            round={currentRound}
            propSpeaker={resolvePropSpeakerForRound(currentRound, room.format)}
            oppSpeaker={resolveOppSpeakerForRound(currentRound, room.format)}
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
              const propSpeaker = resolvePropSpeakerForRound(currentRound, room.format);
              const oppSpeaker = resolveOppSpeakerForRound(currentRound, room.format);
              if (!propSpeaker || !oppSpeaker) return;
              roundScoreMutation.mutate({
                round: currentRound,
                proposition: {
                  speaker: propSpeaker,
                  speak: roundPropSpeak,
                  ce: currentRound === 3 ? 0 : roundPropCe,
                  notes: roundPropNotes,
                },
                opposition: {
                  speaker: oppSpeaker,
                  speak: roundOppSpeak,
                  ce: currentRound === 3 ? 0 : roundOppCe,
                  notes: roundOppNotes,
                },
              });
            }}
            isPending={roundScoreMutation.isPending}
            isSubmitEnabled={isScoringAllowed}
          />
        </div>
      )}
    </div>
  );

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
      <TransitionPopup 
        countdownSeconds={countdownSeconds}
        countdownLabel={currentWorkflowStep?.label ? td('debateRoom.countdown.startsIn', { label: currentWorkflowStep.label }) : td('debateRoom.countdown.matchStarting')}
        countdownFooter={countdownSeconds === 'GO!' ? t('startNow') : t('startingSoon')}
      />
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
        className="debate-room-shell d-flex flex-column text-white"
        style={{
          height: '100dvh',
          background: '#0a0a0f',
          fontFamily: 'Rajdhani, sans-serif',
          overflow: 'hidden',
          maxWidth: '100vw',
        }}
      >
        
        <DebateRoomHeader
          roomTitle={room.title}
          roomCode={room._id.slice(-6).toUpperCase()}
          phaseLabel={phaseLabel}
          status={room.status}
          workflowSteps={debateWorkflow}
          currentWorkflowIndex={currentWorkflowIndex}
          actions={(
            <div className="debate-header-action-list">
              {canUseDebaterActions && (
                <>
                  <Button
                    size="sm"
                    className="action-pause"
                    onClick={() => room.status === 'paused' ? debaterResumeMutation.mutate() : debaterPauseMutation.mutate()}
                    disabled={debaterPauseMutation.isPending || debaterResumeMutation.isPending}
                    title={room.status === 'paused' ? 'Resume debate' : 'Use team pause'}
                  >
                    <i className={`bi ${room.status === 'paused' ? 'bi-play-fill' : 'bi-pause-fill'}`} aria-hidden="true" />
                    <span>{room.status === 'paused' ? 'Resume' : `Pause (${3 - (currentParticipant?.team && session?.pausesUsed?.[currentParticipant.team as 'proposition' | 'opposition'] || 0)})`}</span>
                  </Button>
                  {currentPhase === 'prep_7' && (
                    <Button
                      size="sm"
                      className="action-ready"
                      onClick={() => getSocket()?.emit('debate:end-prep-early', { roomId })}
                      disabled={!isS1Debater || prepConsensusReadyUserIds.includes(user?._id || '')}
                      title="End preparation when both teams are ready"
                    >
                      <i className="bi bi-check-circle-fill" aria-hidden="true" />
                      <span>{prepConsensusReadyUserIds.includes(user?._id || '') ? 'Ready' : 'End prep'}</span>
                    </Button>
                  )}
                  {turnStatus === 'active' && currentPhase === 'speech' && isMyTurnToSpeak && (
                    <Button
                      size="sm"
                      className="action-skip"
                      onClick={() => controlMutation.mutate('finish')}
                      disabled={controlMutation.isPending || isTransitioning}
                      title="Finish your speech"
                    >
                      <i className="bi bi-skip-forward-fill" aria-hidden="true" /><span>Skip</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="action-surrender"
                    onClick={() => { if (window.confirm(td('debateRoom.actions.surrenderConfirm'))) playerActionMutation.mutate('surrender'); }}
                    disabled={playerActionMutation.isPending}
                  >
                    <i className="bi bi-flag-fill" aria-hidden="true" /><span>{td('debateRoom.actions.surrender')}</span>
                  </Button>
                  <Button
                    size="sm"
                    className="action-draw"
                    onClick={() => playerActionMutation.mutate('draw')}
                    disabled={playerActionMutation.isPending || ownTeamPendingDraw}
                  >
                    <i className="bi bi-dash-circle-fill" aria-hidden="true" /><span>{td('debateRoom.actions.draw')}</span>
                  </Button>
                </>
              )}
              <Button
                size="sm"
                className="action-leave"
                onClick={() => {
                  const isOwner = currentParticipant?.roomRole === 'owner';
                  const otherParticipants = room.participants.filter((participant) => participant.userId !== user?._id);
                  if (isOwner && otherParticipants.length > 0) setShowLeaveConfirmModal(true);
                  else leaveMutation.mutate(undefined);
                }}
                disabled={leaveMutation.isPending}
              >
                <i className="bi bi-box-arrow-right" aria-hidden="true" /><span>Leave room</span>
              </Button>
            </div>
          )}
        />

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

        {/* === MAIN WORKSPACE === */}
        <div className="debate-room-main flex-grow-1 d-flex flex-row overflow-hidden" style={{ minHeight: 0, maxWidth: '100%' }}>

          {/* Main Arena Floor - scrollable container */}
          <div className="debate-room-arena flex-grow-1 d-flex flex-column overflow-y-auto p-2 gap-2" style={{ minHeight: 0 }}>
            
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
            {ownTeamPendingDraw && <Alert variant="info" className="py-2 px-3 mb-0 small flex-shrink-0">{td('debateRoom.actions.drawRequested')}</Alert>}

            <DebateParticipantPodium
              participants={room.participants}
              format={room.format}
              currentSpeaker={currentSpeaker || session.currentTurn?.speaker || null}
              localUserId={user?._id}
              localStream={localStream}
              localCameraActive={cameraActive}
              remoteStreamsByUserId={remoteVideoStreamsByUserId}
            />

            <div className={`debate-motion-dashboard-row ${hasHostControl ? 'has-host-panel' : ''}`}>
              <DebateMotionStage
                motion={room.motion}
                phaseLabel={phaseLabel}
                speakerName={activeSpeakerName}
                speakerCode={speakerLabel}
                format={room.format}
                hostType={room.hostType}
                judgeType={room.judgeType}
                timeRemaining={displayTime}
                totalTime={displayTotal}
                isPaused={isPaused}
                isTransitioning={isTransitioning}
                viewerCount={room.participants.filter((participant) => {
                  const role = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
                  return role === 'viewer';
                }).length}
                isViewer={isViewer}
                notifications={motionNotifications}
                onOpenRules={() => navigate(`/debate/${roomId}/rules`)}
                onOpenPrivateRoom={canAccessPrivateRooms && (isJudge || currentParticipant?.team) ? () => {
                  const target = isJudge ? 'judge' : currentParticipant?.team;
                  if (target) navigate(`/debate/${roomId}/private/${target}`);
                } : undefined}
                captionsPanel={
                  <LiveTranslationCaptions
                    roomId={roomId}
                    captionMode={captionMode}
                    onCaptionModeChange={setCaptionMode}
                    onOwnSourceTranscript={handleOwnSourceTranscript}
                    includeOwnCaptions
                  />
                }
                mediaControls={
                  ((myRole && ['host', 'owner', 'debater', 'judge'].includes(myRole)) || isMyTurnToSpeak || (isViewer && speakingAllowed)) ? (
                    <div className="debate-motion-media-controls">
                      <MicToggle roomId={roomId} disabled={isTransitioning || currentParticipant?.muted || isPaused} />
                      <Button
                        size="sm"
                        variant={cameraActive ? 'outline-danger' : 'outline-info'}
                        onClick={cameraActive ? stopCamera : startCamera}
                        disabled={!cameraActive && (cameraLockedByHost || currentParticipant?.cameraMuted)}
                        aria-label={cameraActive ? 'Turn camera off' : 'Turn camera on'}
                      >
                        <i className={`bi ${cameraActive ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`} aria-hidden="true" />
                      </Button>
                    </div>
                  ) : undefined
                }
              />
              {hasHostControl && (
                <DebateHostControlPanel
                  phaseLabel={phaseLabel}
                  roomStatus={room.status}
                  roomId={roomId}
                  participants={room.participants}
                  startDisabled={startPhaseMutation.isPending || isJudge3 || turnStatus !== 'waiting_to_start'}
                  skipDisabled={isJudge3 || (turnStatus !== 'active' && currentPhase !== 'judge_feedback')}
                  controlsPending={controlMutation.isPending}
                  cameraPending={toggleCameraMutation.isPending}
                  micPending={toggleMicMutation.isPending}
                  chatPending={toggleChatMutation.isPending}
                  onStart={() => startPhaseMutation.mutate()}
                  onSkip={() => controlMutation.mutate('finish')}
                  onPauseOrResume={() => controlMutation.mutate(room.status === 'paused' ? 'resume' : 'pause')}
                  onEnd={() => controlMutation.mutate('end')}
                  onToggleCamera={(userId, action) => toggleCameraMutation.mutate({ userId, action })}
                  onToggleMic={(userId, action) => toggleMicMutation.mutate({ userId, action })}
                  onToggleChat={(userId, action) => toggleChatMutation.mutate({ userId, action })}
                  onJoinPrivateRoom={canAccessPrivateRooms ? (team) => navigate(`/debate/${roomId}/private/${team}`) : undefined}
                />
              )}
            </div>


            {/* Inline Cross Exam details below the chat if CE matches - collapsible */}
            {currentPhase === 'cross_exam' && (
              <div className="flex-shrink-0" style={{ maxHeight: '180px' }}>
                <CrossExamPanel roomId={roomId} />
              </div>
            )}


          </div>

          <DebateRightRail
            scoreContent={scorePanelContent}
            matchChatContent={<MainRoomChat roomId={roomId} />}
            viewerChatContent={canAccessViewerChat ? <ViewerChat roomId={roomId} /> : undefined}
            canViewViewerChat={canAccessViewerChat}
          />

        </div>

      </div>

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

export function getScoringRoundFromPhaseSpeaker(
  phase?: string | null,
  speaker?: string | null,
): 0 | 1 | 2 | 3 {
  const detectedRound = detectCurrentRound(phase, speaker);
  if (detectedRound) return detectedRound;
  if (phase !== 'judge_feedback' || !speaker) return 0;

  const ceMatch = /CE_ROUND_(\d)/i.exec(speaker);
  if (!ceMatch) return 0;
  const round = Number(ceMatch[1]);
  return [1, 2, 3].includes(round) ? (round as 1 | 2 | 3) : 0;
}

export function isScoringPhase(phase?: string | null): boolean {
  return phase === 'judge_feedback';
}

export function getRoundForStepIndex(index: number, format?: string, _hostType?: string): 1 | 2 | 3 {
  // All 4 flows (Host/NoHost × 3v3/1v1) now have the same step order:
  // [HOST, PREP, R1 speeches+CE+FB, R2 speeches+CE+FB, R3 speeches+FB, COMPLETED]
  // R1: indices 2-5, R2: indices 6-9, R3: indices 10-12
  if (index === -1) return 1;
  if (format === '1v1') {
    // 1v1: same structure but all steps are unique speakers per round
    if (index <= 5) return 1;   // HOST,PREP,PRO_S1,OPP_S1,CE1,JUDGES_FB_1
    if (index <= 9) return 2;   // OPP_S2,PRO_S2,CE2,JUDGES_FB_2
    return 3;                   // PRO_S3,OPP_S3,JUDGES_FB_3 (Round 3: Proposition → Opposition)
  }
  // 3v3: same step count as 1v1
  if (index <= 5) return 1;   // HOST,PREP,PRO_S1,OPP_S1,CE1,JUDGES_FB_1
  if (index <= 9) return 2;   // PRO_S2,OPP_S2,CE2,JUDGES_FB_2
  return 3;                   // PRO_S3,OPP_S3,JUDGES_FB_3 (Round 3: Proposition → Opposition)
}

