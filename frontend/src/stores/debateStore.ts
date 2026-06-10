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

interface DebateState {
  // Room state
  room: DebateRoom | null;
  participants: RoomParticipant[];

  // Debate state
  currentPhase: DebatePhase | null;
  currentSpeaker: SpeakerTurn | null;
  timeRemaining: number;
  isPaused: boolean;

  // Cross Examination
  ceState: {
    activeTeam: 'proposition' | 'opposition' | null;
    proQuestionsUsed: number;
    oppQuestionsUsed: number;
    proTimeRemaining: number;
    oppTimeRemaining: number;
  };

  // Chat
  messages: ChatMessage[];
  viewerChatEnabled: boolean;

  // Scores
  scores: Record<string, ScoreBreakdown>;
  aiAnalyses: Record<string, AIAnalysis>;
  finalScores: FinalScores | null;
  winnerResult: WinnerResult | null;

  // Actions
  setRoom: (room: DebateRoom) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  setHost: (hostId: string, participants: RoomParticipant[]) => void;
  setPhase: (phase: DebatePhase) => void;
  setSpeaker: (speaker: SpeakerTurn) => void;
  setTimeRemaining: (time: number) => void;
  setPaused: (paused: boolean) => void;
  setCEState: (state: Partial<DebateState['ceState']>) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setViewerChatEnabled: (enabled: boolean) => void;
  setScore: (speaker: string, score: ScoreBreakdown) => void;
  setAIAnalysis: (speaker: string, analysis: AIAnalysis) => void;
  setFinalScores: (finalScores: FinalScores) => void;
  setWinnerResult: (winnerResult: WinnerResult) => void;
  reset: () => void;
}

const initialCEState = {
  activeTeam: null as 'proposition' | 'opposition' | null,
  proQuestionsUsed: 0,
  oppQuestionsUsed: 0,
  proTimeRemaining: 180, // 3 minutes
  oppTimeRemaining: 180,
};

export const useDebateStore = create<DebateState>((set) => ({
  room: null,
  participants: [],
  currentPhase: null,
  currentSpeaker: null,
  timeRemaining: 0,
  isPaused: false,
  ceState: initialCEState,
  messages: [],
  viewerChatEnabled: true,
  scores: {},
  aiAnalyses: {},
  finalScores: null,
  winnerResult: null,

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
  setPaused: (isPaused) => set({ isPaused }),
  setCEState: (ceState) =>
    set((state) => ({ ceState: { ...state.ceState, ...ceState } })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setViewerChatEnabled: (viewerChatEnabled) => set({ viewerChatEnabled }),
  setScore: (speaker, score) =>
    set((state) => ({ scores: { ...state.scores, [speaker]: score } })),
  setAIAnalysis: (speaker, analysis) =>
    set((state) => ({ aiAnalyses: { ...state.aiAnalyses, [speaker]: analysis } })),
  setFinalScores: (finalScores) => set({ finalScores }),
  setWinnerResult: (winnerResult) =>
    set({ winnerResult, finalScores: winnerResult.finalScores }),
  reset: () =>
    set({
      room: null,
      participants: [],
      currentPhase: null,
      currentSpeaker: null,
      timeRemaining: 0,
      isPaused: false,
      ceState: initialCEState,
      messages: [],
      viewerChatEnabled: true,
      scores: {},
      aiAnalyses: {},
      finalScores: null,
      winnerResult: null,
    }),
}));
