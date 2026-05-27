// ============================================================
// SHARED TYPES — Phù hợp với Database Schema trong 04_TRD
// ============================================================

// --- Enums ---

export type RoomType = 'rank' | 'custom';
export type RoomStatus = 'waiting' | 'ready' | 'active' | 'paused' | 'completed' | 'cancelled';
export type DebateFormat = '1v1' | '3v3';
export type Team = 'proposition' | 'opposition';
export type SpeakerSlot = 'S1' | 'S2' | 'S3';
export type RoomRole = 'debater' | 'host' | 'judge' | 'viewer' | 'owner';
export type HostType = 'human' | 'ai';
export type JudgeType = 'human' | 'ai';
export type CardType = 'yellow' | 'red';
export type MessageType = 'chat' | 'system' | 'announcement' | 'cross-exam';

export type DebatePhase =
  | 'motion'
  | 'prep_7'
  | 'speech'
  | 'cross_exam'
  | 'judge_feedback'
  | 'prep_1'
  | 'closing'
  | 'final_judging'
  | 'completed';

export type SpeakerTurn =
  | 'PRO_S1'
  | 'OPP_S1'
  | 'PRO_S2'
  | 'OPP_S2'
  | 'PRO_S3'
  | 'OPP_S3';

export type RankTier =
  | 'Novice'
  | 'Debater'
  | 'Advanced'
  | 'Expert'
  | 'Master'
  | 'GrandMaster';

// --- User ---

export interface UserProfile {
  displayName: string;
  avatar: string;
  bio: string;
  school: string;
  club: string;
}

export interface UserStats {
  totalDebates: number;
  wins: number;
  losses: number;
  totalScore: number;
  avgScore: number;
}

export interface UserRanking {
  elo: number;
  tier: RankTier;
  seasonPoints: number;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
  profile: UserProfile;
  stats: UserStats;
  ranking: UserRanking;
  createdAt: string;
}

// --- Auth ---

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatar?: string;
  bio?: string;
  school?: string;
  club?: string;
}

// --- Room ---

export interface RoomParticipant {
  userId: string;
  username: string;
  avatar: string;
  roomRole: RoomRole;
  team: Team | null;
  speakerSlot: SpeakerSlot | null;
  positionLocked: boolean;
}

export interface DebateRoom {
  _id: string;
  roomType: RoomType;
  title: string;
  motion: string;
  status: RoomStatus;
  format: DebateFormat;
  isPrivate: boolean;
  createdBy: string;
  hostType: HostType;
  hostId: string | null;
  judgeType: JudgeType;
  judgeCount: number;
  participants: RoomParticipant[];
  currentPhase: DebatePhase;
  createdAt: string;
  startedAt: string | null;
}

export interface CreateRoomRequest {
  title: string;
  format: DebateFormat;
  hostType: HostType;
  judgeType: JudgeType;
  judgeCount: number;
  isPrivate: boolean;
  password?: string;
}

// --- Debate Session ---

export interface ScoreBreakdown {
  logic: number;
  rebuttal: number;
  evidence: number;
  crossExam: number;
  strategy: number;
  communication: number;
  overall: number;
}

export interface AIAnalysis {
  score: ScoreBreakdown;
  strengths: string[];
  weaknesses: string[];
  fallacies: { type: string; description: string }[];
  summary: string;
}

export interface TurnHistory {
  speaker: SpeakerTurn;
  startTime: string;
  endTime: string;
  duration: number;
  transcript: string;
  aiAnalysis: AIAnalysis | null;
}

export interface FinalScores {
  teamProposition: { total: number; breakdown: ScoreBreakdown };
  teamOpposition: { total: number; breakdown: ScoreBreakdown };
  winner: Team | 'draw';
  aiVerdict: string;
}

export interface DebateSession {
  _id: string;
  roomId: string;
  currentTurn: {
    speaker: SpeakerTurn;
    phase: DebatePhase;
    startTime: string;
    timeLimit: number;
    timeRemaining: number;
    status: 'active' | 'paused' | 'completed';
  };
  turnHistory: TurnHistory[];
  cards: {
    type: CardType;
    issuedTo: string;
    reason: string;
    timestamp: string;
  }[];
  finalScores: FinalScores | null;
  aiSummary: string | null;
}

// --- Chat ---

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: RoomRole;
  content: string;
  type: MessageType;
  isToxic: boolean;
  timestamp: string;
}

// --- Leaderboard ---

export interface LeaderboardEntry {
  _id: string;
  username: string;
  avatar: string;
  elo: number;
  tier: RankTier;
  wins: number;
  losses: number;
  rank: number;
}

// --- API Response ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
