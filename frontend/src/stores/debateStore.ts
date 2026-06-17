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
  totalTime: number;
  isPaused: boolean;

  // Mic state (per role)
  micActive: boolean;
  isSpeaking: boolean;

  // Cross Examination
  ceState: {
    activeTeam: 'proposition' | 'opposition' | null;
    proQuestionsUsed: number;
    oppQuestionsUsed: number;
    proTimeRemaining: number;
    oppTimeRemaining: number;
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

  // Actions
  setRoom: (room: DebateRoom) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  setHost: (hostId: string, participants: RoomParticipant[]) => void;
  setPhase: (phase: DebatePhase) => void;
  setSpeaker: (speaker: SpeakerTurn) => void;
  setTimeRemaining: (time: number) => void;
  setTotalTime: (time: number) => void;
  setPaused: (paused: boolean) => void;
  setMicActive: (active: boolean) => void;
  setIsSpeaking: (speaking: boolean) => void;
  setCEState: (state: Partial<DebateState['ceState']>) => void;
  addMessage: (message: ChatMessage) => void;
  addViewerChatMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setViewerChatEnabled: (enabled: boolean) => void;
  setScore: (speaker: string, score: ScoreBreakdown) => void;
  setAIAnalysis: (speaker: string, analysis: AIAnalysis) => void;
  setFinalScores: (finalScores: FinalScores) => void;
  setWinnerResult: (winnerResult: WinnerResult) => void;
  setCurrentPrivateRoom: (room: DebateState['currentPrivateRoom']) => void;
  addPrivateRoomMessage: (room: string, message: ChatMessage) => void;
  setPrivateRoomParticipants: (room: string, participants: string[]) => void;
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
  totalTime: 0,
  isPaused: false,
  micActive: false,
  isSpeaking: false,
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
  setMicActive: (micActive) => set({ micActive }),
  setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
  setCEState: (ceState) =>
    set((state) => ({ ceState: { ...state.ceState, ...ceState } })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  addViewerChatMessage: (message) =>
    set((state) => ({ viewerChatMessages: [...state.viewerChatMessages, message] })),
  setMessages: (messages) => set({ messages }),
  setViewerChatEnabled: (viewerChatEnabled) => set({ viewerChatEnabled }),
  setScore: (speaker, score) =>
    set((state) => ({ scores: { ...state.scores, [speaker]: score } })),
  setAIAnalysis: (speaker, analysis) =>
    set((state) => ({ aiAnalyses: { ...state.aiAnalyses, [speaker]: analysis } })),
  setFinalScores: (finalScores) => set({ finalScores }),
  setWinnerResult: (winnerResult) =>
    set({ winnerResult, finalScores: winnerResult.finalScores }),
  setCurrentPrivateRoom: (currentPrivateRoom) => set({ currentPrivateRoom }),
  addPrivateRoomMessage: (room, message) =>
    set((state) => ({
      privateRoomMessages: {
        ...state.privateRoomMessages,
        [room]: [...(state.privateRoomMessages[room] || []), message],
      },
    })),
  setPrivateRoomParticipants: (room, participants) =>
    set((state) => ({
      privateRoomParticipants: {
        ...state.privateRoomParticipants,
        [room]: participants,
      },
    })),
  reset: () =>
    set({
      room: null,
      participants: [],
      currentPhase: null,
      currentSpeaker: null,
      timeRemaining: 0,
      totalTime: 0,
      isPaused: false,
      micActive: false,
      isSpeaking: false,
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
    }),
}));
