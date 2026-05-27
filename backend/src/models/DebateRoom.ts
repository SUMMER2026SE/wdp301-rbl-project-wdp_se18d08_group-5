import mongoose, { Schema, Document } from 'mongoose';

export interface IDebateRoom extends Document {
  roomType: string;
  title: string;
  motion: string;
  status: string;
  format: string;
  isPrivate: boolean;
  password: string | null;
  createdBy: mongoose.Types.ObjectId;
  hostType: string;
  hostId: mongoose.Types.ObjectId | null;
  judgeType: string;
  judgeCount: number;
  judges: { userId: mongoose.Types.ObjectId; username: string }[];
  participants: {
    userId: mongoose.Types.ObjectId;
    username: string;
    avatar: string;
    roomRole: string;
    team: string | null;
    speakerSlot: string | null;
    positionLocked: boolean;
  }[];
  currentPhase: string;
  eloApplied: boolean;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

const debateRoomSchema = new Schema<IDebateRoom>(
  {
    roomType: {
      type: String,
      enum: ['rank', 'custom'],
      required: true,
    },
    title: { type: String, default: '' },
    motion: { type: String, default: '' },
    status: {
      type: String,
      enum: ['waiting', 'ready', 'active', 'paused', 'completed', 'cancelled'],
      default: 'waiting',
    },
    format: {
      type: String,
      enum: ['1v1', '3v3'],
      required: true,
    },
    isPrivate: { type: Boolean, default: false },
    password: { type: String, default: null, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostType: {
      type: String,
      enum: ['human', 'ai'],
      default: 'human',
    },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    judgeType: {
      type: String,
      enum: ['human', 'ai'],
      default: 'ai',
    },
    judgeCount: { type: Number, default: 1, min: 1, max: 3 },
    judges: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        username: String,
      },
    ],
    participants: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        username: String,
        avatar: { type: String, default: '' },
        roomRole: {
          type: String,
          enum: ['debater', 'host', 'judge', 'viewer', 'owner'],
        },
        team: {
          type: String,
          enum: ['proposition', 'opposition', null],
          default: null,
        },
        speakerSlot: {
          type: String,
          enum: ['S1', 'S2', 'S3', null],
          default: null,
        },
        positionLocked: { type: Boolean, default: false },
      },
    ],
    currentPhase: {
      type: String,
      enum: [
        'motion',
        'prep_7',
        'speech',
        'cross_exam',
        'judge_feedback',
        'prep_1',
        'closing',
        'final_judging',
        'completed',
      ],
      default: 'motion',
    },
    eloApplied: { type: Boolean, default: false },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

// Indexes
debateRoomSchema.index({ status: 1, roomType: 1 });
debateRoomSchema.index({ createdBy: 1 });
debateRoomSchema.index({ 'participants.userId': 1 });

export const DebateRoom = mongoose.model<IDebateRoom>('DebateRoom', debateRoomSchema);
