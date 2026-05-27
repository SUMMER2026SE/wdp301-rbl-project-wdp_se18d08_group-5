import mongoose, { Schema, Document } from 'mongoose';

export interface IDebateSession extends Document {
  roomId: mongoose.Types.ObjectId;
  currentTurn: {
    speaker: string;
    phase: string;
    startTime: Date;
    timeLimit: number;
    timeRemaining: number;
    status: string;
  };
  turnHistory: {
    speaker: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    transcript: string;
    crossExamination: {
      questionsAsked: number;
      questionsAnswered: number;
      timeRemainingPro: number;
      timeRemainingOpp: number;
      transcript: { team: string; type: string; content: string; timestamp: Date }[];
    } | null;
    aiAnalysis: {
      score: {
        logic: number;
        rebuttal: number;
        evidence: number;
        crossExam: number;
        strategy: number;
        communication: number;
        overall: number;
      };
      strengths: string[];
      weaknesses: string[];
      fallacies: { type: string; description: string }[];
      summary: string;
    } | null;
  }[];
  cards: {
    type: string;
    issuedTo: mongoose.Types.ObjectId;
    issuedBy: mongoose.Types.ObjectId;
    reason: string;
    timestamp: Date;
  }[];
  finalScores: {
    teamProposition: { total: number; breakdown: object };
    teamOpposition: { total: number; breakdown: object };
    winner: string;
    aiVerdict: string;
    judgeVerdicts: { judgeId: mongoose.Types.ObjectId; winner: string; notes: string }[];
  } | null;
  aiSummary: string | null;
  createdAt: Date;
}

const debateSessionSchema = new Schema<IDebateSession>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', required: true, index: true },
    currentTurn: {
      speaker: { type: String, default: 'PRO_S1' },
      phase: { type: String, default: 'motion' },
      startTime: { type: Date, default: Date.now },
      timeLimit: { type: Number, default: 0 },
      timeRemaining: { type: Number, default: 0 },
      status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
    },
    turnHistory: [
      {
        speaker: String,
        startTime: Date,
        endTime: Date,
        duration: Number,
        transcript: { type: String, default: '' },
        crossExamination: {
          type: Schema.Types.Mixed,
          default: null,
        },
        aiAnalysis: {
          type: Schema.Types.Mixed,
          default: null,
        },
      },
    ],
    cards: [
      {
        type: { type: String, enum: ['yellow'] },
        issuedTo: { type: Schema.Types.ObjectId, ref: 'User' },
        issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    finalScores: {
      type: Schema.Types.Mixed,
      default: null,
    },
    aiSummary: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

export const DebateSession = mongoose.model<IDebateSession>('DebateSession', debateSessionSchema);
