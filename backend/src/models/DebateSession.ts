import mongoose, { Schema, Document } from 'mongoose';

export type TranscriptRole = 'host' | 'debater' | 'judge' | 'viewer' | 'owner';
export type TranscriptTeam = 'proposition' | 'opposition';
export type TranscriptSource = 'gemini-live' | 'native-client';
export type DebateAnalysisStatus = 'processing' | 'completed' | 'failed';
export type DebateAnalysisWinner = 'proposition' | 'opposition' | 'draw';

export interface ISpeechTranscript {
  roomId: mongoose.Types.ObjectId;
  segmentKey: string;
  round: 0 | 1 | 2 | 3;
  phase: string;
  speaker: string;
  isActiveSpeaker: boolean;
  userId: mongoose.Types.ObjectId;
  username: string;
  role: TranscriptRole;
  team?: TranscriptTeam;
  speakerSlot?: 'S1' | 'S2' | 'S3';
  language: string;
  originalText: string;
  translatedText?: string;
  source: TranscriptSource;
  judgeType: 'human' | 'ai';
  hostType: 'human' | 'ai';
  format: '1v1' | '3v3';
  startedAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}

export interface IAIDebateAnalysis {
  status: DebateAnalysisStatus;
  judgeMode: 'ai' | 'human';
  affectsOfficialResult: boolean;
  model: string;
  sourceFingerprint: string;
  generatedAt?: Date;
  error?: string;
  transcriptStats?: {
    participantCount: number;
    segmentCount: number;
    totalCharacters: number;
    truncated: boolean;
  };
  transcriptQuality?: {
    overallConfidence: number;
    issues: string[];
    notes: string;
  };
  summary?: string;
  keyClashes?: string[];
  teams?: {
    proposition: {
      score: number;
      keyArguments: string[];
      strengths: string[];
      weaknesses: string[];
    };
    opposition: {
      score: number;
      keyArguments: string[];
      strengths: string[];
      weaknesses: string[];
    };
  };
  rounds?: Array<{
    round: 1 | 2 | 3;
    proposition: {
      speaker: string;
      userId: string;
      username: string;
      speechScore: number;
      crossExamScore: number;
      transcriptConfidence: number;
      summary: string;
      strengths: string[];
      improvements: string[];
      fallacies: string[];
    };
    opposition: {
      speaker: string;
      userId: string;
      username: string;
      speechScore: number;
      crossExamScore: number;
      transcriptConfidence: number;
      summary: string;
      strengths: string[];
      improvements: string[];
      fallacies: string[];
    };
  }>;
  participants?: Array<{
    userId: string;
    username: string;
    team: TranscriptTeam;
    transcriptConfidence: number;
    summary: string;
    strengths: string[];
    improvements: string[];
  }>;
  judgeSynthesis?: {
    summary: string;
    agreements: string[];
    disagreements: string[];
  };
  recommendedWinner?: DebateAnalysisWinner;
  officialWinner?: DebateAnalysisWinner | null;
  winnerReason?: string;
}

export interface IDebateSession extends Document {
  roomId: mongoose.Types.ObjectId;
  pausesUsed: {
    proposition: number;
    opposition: number;
  };
  pauseType: 'host' | 'proposition' | 'opposition' | null;
  pausedAt: Date | null;
  currentTurn: {
    speaker: string;
    phase: string;
    startTime: Date;
    timeLimit: number;
    timeRemaining: number;
    status: string;
    phaseStatus?: string;
    ceState?: {
      askingTeam: string;
      answeringTeam: string;
      quotaPerTeam: number;
      questionsAsked: number;
      questionsAnswered: number;
      currentRole: string;
      transcript: { team: string; type: string; content: string; timestamp: Date }[];
    };
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
  speechTranscripts: ISpeechTranscript[];
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
    winner: string | null;
    aiVerdict: string | null;
    judgeVerdicts: Array<{
      judgeId: mongoose.Types.ObjectId | null;
      judgeName?: string;
      winner?: string;
      speaker?: string;
      score?: any;
      notes: string;
      source?: 'ai' | 'human';
      round?: number;
      submittedAt: Date;
    }>;
    resultSource?: 'judging' | 'surrender' | 'agreed_draw' | 'forfeit';
  } | null;
  aiSummary: string | null;
  aiDebateAnalysis: IAIDebateAnalysis | null;
  createdAt: Date;
}

const debateSessionSchema = new Schema<IDebateSession>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', required: true, index: true },
    pausesUsed: {
      proposition: { type: Number, default: 0 },
      opposition: { type: Number, default: 0 },
    },
    pauseType: { type: String, enum: ['host', 'proposition', 'opposition', null], default: null },
    pausedAt: { type: Date, default: null },
    currentTurn: {
      speaker: { type: String, default: 'PRO_S1' },
      phase: { type: String, default: 'motion' },
      startTime: { type: Date, default: Date.now },
      timeLimit: { type: Number, default: 0 },
      timeRemaining: { type: Number, default: 0 },
      status: { type: String, enum: ['active', 'paused', 'completed', 'waiting_to_start', 'transition'], default: 'waiting_to_start' },
      phaseStatus: { type: String, default: 'idle' },
      ceState: {
        type: Schema.Types.Mixed,
        default: null,
      },
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
    speechTranscripts: [
      {
        roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', required: true },
        segmentKey: { type: String, required: true },
        round: { type: Number, enum: [0, 1, 2, 3], required: true },
        phase: { type: String, required: true },
        speaker: { type: String, required: true },
        isActiveSpeaker: { type: Boolean, default: false },
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        role: {
          type: String,
          enum: ['host', 'debater', 'judge', 'viewer', 'owner'],
          required: true,
        },
        team: {
          type: String,
          enum: ['proposition', 'opposition'],
          required: false,
        },
        speakerSlot: {
          type: String,
          enum: ['S1', 'S2', 'S3'],
          required: false,
        },
        language: { type: String, default: 'und' },
        originalText: { type: String, required: true, maxlength: 50_000 },
        translatedText: { type: String, required: false, maxlength: 50_000 },
        source: {
          type: String,
          enum: ['gemini-live', 'native-client'],
          required: true,
        },
        judgeType: { type: String, enum: ['human', 'ai'], required: true },
        hostType: { type: String, enum: ['human', 'ai'], required: true },
        format: { type: String, enum: ['1v1', '3v3'], required: true },
        startedAt: { type: Date, required: false },
        updatedAt: { type: Date, required: true },
        createdAt: { type: Date, required: true },
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
    aiDebateAnalysis: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
  },
);

debateSessionSchema.index({ roomId: 1, 'speechTranscripts.userId': 1 });
debateSessionSchema.index({ roomId: 1, 'speechTranscripts.round': 1 });
debateSessionSchema.index({ roomId: 1, 'speechTranscripts.speaker': 1 });
debateSessionSchema.index({ roomId: 1, 'speechTranscripts.phase': 1 });

export const DebateSession = mongoose.model<IDebateSession>('DebateSession', debateSessionSchema);
