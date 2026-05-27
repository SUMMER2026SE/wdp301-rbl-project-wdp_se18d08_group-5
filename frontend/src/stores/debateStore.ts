import { create } from 'zustand';
import type {
  DebateRoom,
  DebatePhase,
  SpeakerTurn,
  ChatMessage,
  RoomParticipant,
  ScoreBreakdown,
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

  // Scores
  scores: Record<string, ScoreBreakdown>;

  // Actions
  setRoom: (room: DebateRoom) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  setPhase: (phase: DebatePhase) => void;
  setSpeaker: (speaker: SpeakerTurn) => void;
  setTimeRemaining: (time: number) => void;
  setPaused: (paused: boolean) => void;
  setCEState: (state: Partial<DebateState['ceState']>) => void;
  addMessage: (message: ChatMessage) => void;
  setScore: (speaker: string, score: ScoreBreakdown) => void;
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
  scores: {},

  setRoom: (room) => set({ room, participants: room.participants }),
  setParticipants: (participants) => set({ participants }),
  setPhase: (currentPhase) => set({ currentPhase }),
  setSpeaker: (currentSpeaker) => set({ currentSpeaker }),
  setTimeRemaining: (timeRemaining) => set({ timeRemaining }),
  setPaused: (isPaused) => set({ isPaused }),
  setCEState: (ceState) =>
    set((state) => ({ ceState: { ...state.ceState, ...ceState } })),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setScore: (speaker, score) =>
    set((state) => ({ scores: { ...state.scores, [speaker]: score } })),
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
      scores: {},
    }),
}));
