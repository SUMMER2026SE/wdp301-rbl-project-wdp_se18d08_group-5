// ============================================================
// SHARED TYPES — Aligned with the Database Schema in 04_TRD
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
  | 'waiting_s1'
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
  draws: number;
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
  primaryRole?: RoomRole | null;
  team: Team | null;
  speakerSlot: SpeakerSlot | null;
  positionLocked: boolean;
  muted?: boolean;
  speakingAllowed?: boolean;
  chatMuted?: boolean;
  cameraMuted?: boolean;
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
  viewerChatEnabled: boolean;
  judgeType: JudgeType;
  judgeCount: number;
  participants: RoomParticipant[];
  judges: { userId: string; username: string }[];
  currentPhase: DebatePhase;
  createdAt: string;
  startedAt: string | null;
}

export interface CreateRoomRequest {
  title: string;
  motion: string;
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

export interface SubmitJudgeScoreRequest {
  speaker: SpeakerTurn;
  logic: number;
  rebuttal: number;
  evidence: number;
  crossExam: number;
  strategy: number;
  communication: number;
  winner?: Team | 'draw';
  notes?: string;
}

// Round-based judge evaluation (new UX).
// Each round = one Judge Feedback phase where the judge scores BOTH teams.
export interface SubmitJudgeRoundScoresRequest {
  round: 1 | 2 | 3;
  proposition: {
    speaker: SpeakerTurn; // PRO_S1 | PRO_S2 | PRO_S3
    speak: number;        // 0-20
    ce: number;           // 0-20 (ignored in round 3)
    notes?: string;
  };
  opposition: {
    speaker: SpeakerTurn; // OPP_S1 | OPP_S2 | OPP_S3
    speak: number;        // 0-20
    ce: number;           // 0-20 (ignored in round 3)
    notes?: string;
  };
}

export interface SubmitJudgeRoundScoresResponse {
  round: number;
  proposition: { speaker: SpeakerTurn; score: ScoreBreakdown; notes: string };
  opposition: { speaker: SpeakerTurn; score: ScoreBreakdown; notes: string };
  finalScores: FinalScores;
  autoCompleted: boolean;
}

export interface SubmitJudgeScoreResponse {
  speaker: SpeakerTurn;
  winner: Team | 'draw' | null;
  score: ScoreBreakdown;
  notes: string;
  finalScores: FinalScores;
}

export interface AIAnalysis {
  score: ScoreBreakdown;
  strengths: string[];
  weaknesses: string[];
  fallacies: { type: string; description: string }[];
  summary: string;
  verdict?: Team | 'draw';
  comments?: string;
}

export interface TurnHistory {
  speaker: SpeakerTurn;
  startTime: string;
  endTime: string;
  duration: number;
  transcript: string;
  aiAnalysis: AIAnalysis | null;
}

export interface JudgeVerdict {
  judgeId: string | null;
  judgeName?: string;
  speaker: SpeakerTurn;
  winner: Team | 'draw' | null;
  score: ScoreBreakdown;
  notes: string;
  source?: 'ai' | 'human';
  submittedAt: string;
}

export interface DrawRequest {
  requestedBy: string;
  requestedByName: string;
  team: Team;
  status: 'pending' | 'accepted' | 'cancelled';
  requestedAt: string;
  acceptedBy?: string;
  acceptedAt?: string;
}

export interface FinalScores {
  teamProposition: { total: number; breakdown: ScoreBreakdown; weight?: number };
  teamOpposition: { total: number; breakdown: ScoreBreakdown; weight?: number };
  winner: Team | 'draw';
  winnerTeam?: Team | 'draw';
  aiVerdict: Team | 'draw' | null;
  judgeVerdicts?: JudgeVerdict[];
  drawRequests?: DrawRequest[];
  aggregatePolicy?: {
    humanJudgeWeight: number;
    aiJudgeWeight: number;
    method: string;
    weightedVoteWinner?: Team | 'draw';
    winnerMethod?: string;
    verdictCount: number;
    aggregatedAt: string;
  };
}

export interface WinnerResult {
  roomId?: string;
  winnerTeam: Team | 'draw';
  propositionTotal: number;
  oppositionTotal: number;
  finalScores: FinalScores;
}

export interface RankingUpdate {
  userId: string;
  username: string;
  team: Team;
  previousElo: number;
  newElo: number;
  eloDelta: number;
  tier: RankTier;
  result: 'win' | 'loss' | 'draw';
}

export interface RankingApplicationResult {
  applied: boolean;
  reason?: 'room_not_ranked' | 'already_applied' | 'missing_winner' | 'room_not_completed' | 'missing_debaters';
  winner?: Team | 'draw';
  winnerTeam?: Team | 'draw';
  format?: DebateFormat;
  teamElo?: {
    proposition: number;
    opposition: number;
  };
  updates?: RankingUpdate[];
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
    ceState?: {
      askingTeam: Team;
      answeringTeam: Team;
      quotaPerTeam: number;
      questionsAsked: number;
      questionsAnswered: number;
      currentRole: 'asker' | 'answerer';
      transcript: Array<{ team: Team; type: string; content: string; timestamp: string }>;
    } | null;
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
  pauseType?: 'host' | 'proposition' | 'opposition' | null;
  pausedAt?: string | null;
  pausesUsed?: {
    proposition: number;
    opposition: number;
  };
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
  displayName?: string;
  avatar: string;
  elo: number;
  tier: RankTier;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
}

export interface DebateHistoryItem {
  sessionId: string;
  roomId: string;
  roomTitle: string;
  motion: string;
  format: DebateFormat;
  status: RoomStatus;
  startedAt: string | null;
  endedAt: string | null;
  userSide: Team | null;
  userRole: RoomRole;
  result: 'win' | 'loss' | 'draw' | null;
}

// --- Forum ---

export type ForumStance = 'agree' | 'disagree';

export interface ForumAuthor {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
}

export interface ForumTopic {
  _id: string;
  title: string;
  description: string;
  createdBy: ForumAuthor;
  agreeCount: number;
  disagreeCount: number;
  postCount: number;
  lastActivityAt: string;
  createdAt: string;
}

export interface ForumPost {
  _id: string;
  topic: string;
  stance: ForumStance;
  opinion: string;
  evidenceText: string;
  evidenceImageUrl: string;
  author: ForumAuthor;
  likeCount: number;
  isLiked: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateForumPostRequest {
  opinion: string;
  evidenceText?: string;
  evidenceImageUrl?: string;
}

export interface ForumComment {
  _id: string;
  content: string;
  author: ForumAuthor;
  stance: ForumStance | null;
  createdAt: string;
}

export interface ForumTopicDetail {
  topic: ForumTopic;
  userStance: ForumStance | null;
  posts: Record<ForumStance, ForumPost[]>;
}

export interface CreateForumTopicRequest {
  title: string;
  description?: string;
}

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  authProvider: 'local' | 'google';
  isEmailVerified: boolean;
  isBanned: boolean;
  banReason: string;
  bannedUntil: string | null;
  bannedAt: string | null;
  profile: {
    displayName: string;
    avatar: string;
  };
  stats?: UserStats;
  ranking?: UserRanking;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'admin' | 'user';
  status?: 'active' | 'banned' | 'pending';
}

export interface UpdateUserRoleRequest {
  role: 'admin' | 'user';
}

export type BanDurationPreset = '1h' | '24h' | '7d' | '30d' | 'custom';
export type CustomBanDurationUnit = 'minutes' | 'hours' | 'days';

export interface BanUserRequest {
  durationPreset: BanDurationPreset;
  customDurationValue?: number;
  customDurationUnit?: CustomBanDurationUnit;
  reason?: string;
}

export interface AdminRoom {
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
  hostName: string;
  viewerChatEnabled: boolean;
  judgeType: JudgeType;
  judgeCount: number;
  participants: RoomParticipant[];
  participantCount: number;
  debaterCount: number;
  judgeAssignedCount: number;
  mutedCount: number;
  currentPhase: DebatePhase;
  eloApplied: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  session: {
    _id: string;
    currentTurn: DebateSession['currentTurn'];
    turnCount: number;
    cardCount: number;
    hasFinalScores: boolean;
    finalScores: FinalScores | null;
  } | null;
}

export interface AdminRoomsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: RoomStatus;
  roomType?: RoomType;
  format?: DebateFormat;
}

export interface AdminRoomDetail {
  room: AdminRoom;
  toxicMessages: Array<{
    _id: string;
    senderId: string;
    senderName: string;
    senderRole: RoomRole;
    content: string;
    type: MessageType;
    timestamp: string;
  }>;
}

export type ReportTargetType = 'user' | 'message' | 'room' | 'debate' | 'other';
export type ReportReason = 'harassment' | 'toxic_chat' | 'spam' | 'cheating' | 'inappropriate_content' | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportResolution = 'none' | 'warned' | 'muted' | 'banned' | 'dismissed';

export interface AdminReport {
  _id: string;
  targetType: ReportTargetType;
  targetId: string | null;
  reporterId: string;
  reporterName: string;
  reportedUserId: string | null;
  reportedUserName: string;
  roomId: string | null;
  roomTitle: string;
  messageId: string | null;
  messageSnippet: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution: ReportResolution;
  adminNote: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminReportsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ReportStatus;
  targetType?: ReportTargetType;
}

export interface UpdateReportRequest {
  status: ReportStatus;
  resolution?: ReportResolution;
  adminNote?: string;
  ban?: BanUserRequest;
}

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId?: string;
  reportedUserId?: string;
  roomId?: string;
  reason: ReportReason;
  details?: string;
}

export interface AdminOverview {
  users: {
    total: number;
    admins: number;
    banned: number;
    pendingVerification: number;
    newToday: number;
  };
  rooms: {
    total: number;
    waiting: number;
    ready: number;
    active: number;
    paused: number;
    completed: number;
    cancelled: number;
    rank: number;
    custom: number;
  };
  reports: {
    total: number;
    open: number;
    reviewing: number;
    resolved: number;
    dismissed: number;
  };
  moderation: {
    toxicMessages: number;
    yellowCards: number;
  };
  recentUsers: AdminUser[];
  recentRooms: AdminRoom[];
  recentReports: AdminReport[];
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
