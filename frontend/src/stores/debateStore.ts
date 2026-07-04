import { create } from 'zustand';
import type {
  DebateRoom,
  DebatePhase,
  SpeakerTurn,
  ChatMessage,
  RoomParticipant,
  ScoreBreakdown,
  AIAnalysis,
  FinalScores,
  WinnerResult,
} from '@/types';

interface DisconnectedMember {
  userId: string;
  username: string;
  team: 'proposition' | 'opposition';
  disconnectedAt: string;
}

interface DebateState {
  // Room state
  room: DebateRoom | null;
  participants: RoomParticipant[];

  // Debate state
  currentPhase: DebatePhase | null;
  currentSpeaker: SpeakerTurn | null;
  timeRemaining: number;
  totalTime: number;
  isPaused: boolean;
  pauseType: 'host' | 'proposition' | 'opposition' | null;
  pausesUsed: {
    proposition: number;
    opposition: number;
  };
  isTransitioning: boolean;
  transitionTime: number;
  turnStatus: 'waiting_to_start' | 'active' | 'paused';
  speakingAllowed: boolean;
  transitionAnnouncement: string;
  prepConsensusReadyUserIds: string[];
  prepConsensusTotalDebaters: number;
  // Per-team consensus (for 3v3)
  prepConsensusPropositionVotes: number;
  prepConsensusPropositionTotal: number;
  prepConsensusOppositionVotes: number;
  prepConsensusOppositionTotal: number;

  // Judge next-phase votes (for no-host mode)
  judgeNextPhaseVotes: string[];
  judgeNextPhaseTotal: number;

  // No-host S1 start consensus



  // AI feedback (for AI judge mode)
  aiFeedback: {
    speaker: string;
    feedback: AIAnalysis;
  } | null;
  aiFinalVerdict: WinnerResult | null;

  // Mic state (per role)
  micActive: boolean;
  isSpeaking: boolean;

  // Camera state (per user) — whether each user has their camera on
  cameraActive: Record<string, boolean>;
  // Whether the local user has their own camera forced off by host
  cameraLockedByHost: boolean;

  // Cross Examination
  ceState: {
    sharedRemaining: number;
    totalSeconds: number;
    questionsPro: number;
    questionsOpp: number;
    quotaPerTeam: number;
    isPaused?: boolean;
  };

  // Chat
  messages: ChatMessage[];
  viewerChatEnabled: boolean;
  viewerChatMessages: ChatMessage[];

  // Scores
  scores: Record<string, ScoreBreakdown>;
  aiAnalyses: Record<string, AIAnalysis>;
  finalScores: FinalScores | null;
  winnerResult: WinnerResult | null;

  // Private room state
  currentPrivateRoom: 'proposition' | 'opposition' | 'judge' | null;
  privateRoomMessages: Record<string, ChatMessage[]>;
  privateRoomParticipants: Record<string, string[]>;

  // Disconnect tracking state
  disconnectedMembers: Record<string, DisconnectedMember>;
  disconnectTimerActive: boolean;
  disconnectTimerTeam: 'proposition' | 'opposition' | null;
  disconnectTimerStartTime: number | null;
  forfeitTeam: 'proposition' | 'opposition' | null;

  // Actions
  setRoom: (room: DebateRoom) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  setHost: (hostId: string, participants: RoomParticipant[]) => void;
  setPhase: (phase: DebatePhase) => void;
  setSpeaker: (speaker: SpeakerTurn) => void;
  setTimeRemaining: (time: number) => void;
  setTotalTime: (time: number) => void;
  setPaused: (paused: boolean) => void;
  setPauseType: (type: 'host' | 'proposition' | 'opposition' | null) => void;
  setPausesUsed: (pausesUsed: { proposition: number; opposition: number }) => void;
  setTransitionState: (isTransitioning: boolean, time?: number) => void;
  setTurnStatus: (status: 'waiting_to_start' | 'active' | 'paused') => void;
  setSpeakingAllowed: (allowed: boolean) => void;
  setTransitionAnnouncement: (announcement: string) => void;
  setPrepConsensus: (readyUserIds: string[], totalDebaters: number) => void;
  setPrepConsensusByTeam: (team: 'proposition' | 'opposition', votes: number, total: number) => void;
  setJudgeNextPhaseVotes: (votedUserIds: string[], totalJudges: number) => void;
  setMicActive: (active: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setCameraActive: (userId: string, active: boolean) => void;
  setCameraLockedByHost: (locked: boolean) => void;
  setCEState: (state: Partial<DebateState['ceState']>) => void;
  addMessage: (message: ChatMessage) => void;
  addViewerChatMessage: (message: ChatMessage) => void;
  setViewerChatMessages: (messages: ChatMessage[]) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setViewerChatEnabled: (enabled: boolean) => void;
  setScore: (speaker: string, score: ScoreBreakdown) => void;
  setAIAnalysis: (speaker: string, analysis: AIAnalysis) => void;
  setFinalScores: (finalScores: FinalScores | null) => void;
  setWinnerResult: (winnerResult: WinnerResult | null) => void;
  setCurrentPrivateRoom: (room: DebateState['currentPrivateRoom']) => void;
  addPrivateRoomMessage: (room: string, message: ChatMessage) => void;
  setPrivateRoomParticipants: (room: string, participants: string[]) => void;
  setDisconnectedMembers: (members: Record<string, DisconnectedMember>) => void;
  addDisconnectedMember: (member: DisconnectedMember) => void;
  removeDisconnectedMember: (userId: string) => void;
  setDisconnectTimerActive: (active: boolean, team?: 'proposition' | 'opposition' | null, startTime?: number | null) => void;
  setForfeitTeam: (team: 'proposition' | 'opposition' | null) => void;
  setAIFeedback: (feedback: DebateState['aiFeedback']) => void;
  setAIFinalVerdict: (verdict: DebateState['aiFinalVerdict']) => void;
  reset: () => void;
}

const initialCEState = {
  sharedRemaining: 0,
  totalSeconds: 0,
  questionsPro: 0,
  questionsOpp: 0,
  quotaPerTeam: 2,
};

export const useDebateStore = create<DebateState>((set) => ({
  room: null,
  participants: [],
  currentPhase: null,
  currentSpeaker: null,
  timeRemaining: 0,
  totalTime: 0,
  isPaused: false,
  pauseType: null,
  pausesUsed: { proposition: 0, opposition: 0 },
  isTransitioning: false,
  transitionTime: 0,
  turnStatus: 'waiting_to_start',
  speakingAllowed: false,
  transitionAnnouncement: '',
  prepConsensusReadyUserIds: [],
  prepConsensusTotalDebaters: 0,
  prepConsensusPropositionVotes: 0,
  prepConsensusPropositionTotal: 0,
  prepConsensusOppositionVotes: 0,
  prepConsensusOppositionTotal: 0,
  judgeNextPhaseVotes: [],
  judgeNextPhaseTotal: 0,


  aiFeedback: null,
  aiFinalVerdict: null,
  micActive: false,
  isSpeaking: false,
  cameraActive: {},
  cameraLockedByHost: false,
  ceState: initialCEState,
  messages: [],
  viewerChatEnabled: true,
  viewerChatMessages: [],
  scores: {},
  aiAnalyses: {},
  finalScores: null,
  winnerResult: null,
  currentPrivateRoom: null,
  privateRoomMessages: {},
  privateRoomParticipants: {},
  disconnectedMembers: {},
  disconnectTimerActive: false,
  disconnectTimerTeam: null,
  disconnectTimerStartTime: null,
  forfeitTeam: null,

  setRoom: (room) =>
    set({
      room,
      participants: room.participants,
      viewerChatEnabled: room.viewerChatEnabled ?? true,
    }),
  setParticipants: (participants) => set({ participants }),
  setHost: (hostId, participants) =>
    set((state) => ({
      participants,
      room: state.room
        ? {
            ...state.room,
            hostType: 'human',
            hostId,
            participants,
          }
        : state.room,
    })),
  setPhase: (currentPhase) => set({ currentPhase }),
  setSpeaker: (currentSpeaker) => set({ currentSpeaker }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  setTotalTime: (totalTime) => set({ totalTime }),
  setPaused: (isPaused) => set({ isPaused }),
  setPauseType: (pauseType) => set({ pauseType }),
  setPausesUsed: (pausesUsed) => set({ pausesUsed }),
  setTransitionState: (isTransitioning, transitionTime = 3) => set({ isTransitioning, transitionTime }),
  setTurnStatus: (turnStatus) => set({ turnStatus }),
  setSpeakingAllowed: (speakingAllowed) => set({ speakingAllowed }),
  setTransitionAnnouncement: (transitionAnnouncement) => set({ transitionAnnouncement }),
  setPrepConsensus: (prepConsensusReadyUserIds, prepConsensusTotalDebaters) =>
    set({ prepConsensusReadyUserIds, prepConsensusTotalDebaters }),
  setPrepConsensusByTeam: (team, votes, total) =>
    set(() =>
      team === 'proposition'
        ? { prepConsensusPropositionVotes: votes, prepConsensusPropositionTotal: total }
        : { prepConsensusOppositionVotes: votes, prepConsensusOppositionTotal: total }
    ),
  setJudgeNextPhaseVotes: (judgeNextPhaseVotes, judgeNextPhaseTotal) =>
    set({ judgeNextPhaseVotes, judgeNextPhaseTotal }),
  setMicActive: (micActive) => set({ micActive }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setCameraActive: (userId, active) =>
    set((state) => ({ cameraActive: { ...state.cameraActive, [userId]: active } })),
  setCameraLockedByHost: (cameraLockedByHost) => set({ cameraLockedByHost }),
  setCEState: (ceState) =>
    set((state) => ({ ceState: { ...state.ceState, ...ceState } })),
  addMessage: (message) =>
    set((state) => {
      if (state.messages.some((m) => m._id === message._id)) return state;
      return { messages: [...state.messages, message] };
    }),
  addViewerChatMessage: (message) =>
    set((state) => {
      if (state.viewerChatMessages.some((m) => m._id === message._id)) return state;
      return { viewerChatMessages: [...state.viewerChatMessages, message] };
    }),
  setViewerChatMessages: (viewerChatMessages) => set({ viewerChatMessages }),
  setMessages: (messages) => set({ messages }),
  setViewerChatEnabled: (viewerChatEnabled) => set({ viewerChatEnabled }),
  setScore: (speaker, score) =>
    set((state) => ({ scores: { ...state.scores, [speaker]: score } })),
  setAIAnalysis: (speaker, analysis) =>
    set((state) => ({ aiAnalyses: { ...state.aiAnalyses, [speaker]: analysis } })),
  setFinalScores: (finalScores) => set({ finalScores }),
  setWinnerResult: (winnerResult) =>
    set({ winnerResult, finalScores: winnerResult ? winnerResult.finalScores : null }),
  setCurrentPrivateRoom: (currentPrivateRoom) => set({ currentPrivateRoom }),
  addPrivateRoomMessage: (room, message) =>
    set((state) => {
      const current = state.privateRoomMessages[room] || [];
      if (current.some((m) => m._id === message._id)) return state;
      return {
        privateRoomMessages: {
          ...state.privateRoomMessages,
          [room]: [...current, message],
        },
      };
    }),
  setPrivateRoomParticipants: (room, participants) =>
    set((state) => ({
      privateRoomParticipants: {
        ...state.privateRoomParticipants,
        [room]: participants,
      },
    })),
  setDisconnectedMembers: (members) => set({ disconnectedMembers: members }),
  addDisconnectedMember: (member) =>
    set((state) => ({
      disconnectedMembers: {
        ...state.disconnectedMembers,
        [member.userId]: member,
      },
    })),
  removeDisconnectedMember: (userId) =>
    set((state) => {
      const { [userId]: _, ...rest } = state.disconnectedMembers;
      return { disconnectedMembers: rest };
    }),
  setDisconnectTimerActive: (active, team = null, startTime = null) =>
    set({
      disconnectTimerActive: active,
      disconnectTimerTeam: team,
      disconnectTimerStartTime: startTime,
    }),
  setForfeitTeam: (team) => set({ forfeitTeam: team }),

  setAIFeedback: (aiFeedback) => set({ aiFeedback }),
  setAIFinalVerdict: (aiFinalVerdict) => set({ aiFinalVerdict }),
  reset: () =>
    set({
      room: null,
      participants: [],
      currentPhase: null,
      currentSpeaker: null,
      timeRemaining: 0,
      totalTime: 0,
      isPaused: false,
      isTransitioning: false,
      transitionTime: 0,
      turnStatus: 'waiting_to_start',
      speakingAllowed: false,
      transitionAnnouncement: '',
      prepConsensusReadyUserIds: [],
      prepConsensusTotalDebaters: 0,
      prepConsensusPropositionVotes: 0,
      prepConsensusPropositionTotal: 0,
      prepConsensusOppositionVotes: 0,
      prepConsensusOppositionTotal: 0,
      judgeNextPhaseVotes: [],
      judgeNextPhaseTotal: 0,


      aiFeedback: null,
      aiFinalVerdict: null,
      micActive: false,
      isSpeaking: false,
      cameraActive: {},
      ceState: initialCEState,
      messages: [],
      viewerChatEnabled: true,
      viewerChatMessages: [],
      scores: {},
      aiAnalyses: {},
      finalScores: null,
      winnerResult: null,
      currentPrivateRoom: null,
      privateRoomMessages: {},
      privateRoomParticipants: {},
      disconnectedMembers: {},
      disconnectTimerActive: false,
      disconnectTimerTeam: null,
      disconnectTimerStartTime: null,
      forfeitTeam: null,
    }),
}));
