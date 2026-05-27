import { Request } from 'express';

// --- Enums ---
export type RoomType = 'rank' | 'custom';
export type RoomStatus = 'waiting' | 'ready' | 'active' | 'paused' | 'completed' | 'cancelled';
export type DebateFormat = '1v1' | '3v3';
export type Team = 'proposition' | 'opposition';
export type SpeakerSlot = 'S1' | 'S2' | 'S3';
export type RoomRole = 'debater' | 'host' | 'judge' | 'viewer' | 'owner';
export type HostType = 'human' | 'ai';
export type JudgeType = 'human' | 'ai';
export type CardType = 'yellow';
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

export type RankTier = 'Novice' | 'Debater' | 'Advanced' | 'Expert' | 'Master' | 'GrandMaster';

// --- Auth ---
export interface JwtPayload {
  userId: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// --- Score ---
export interface ScoreBreakdown {
  logic: number;
  rebuttal: number;
  evidence: number;
  crossExam: number;
  strategy: number;
  communication: number;
  overall: number;
}
