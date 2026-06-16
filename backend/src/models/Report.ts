import mongoose, { Schema, Document } from 'mongoose';

export type ReportTargetType = 'user' | 'message' | 'room' | 'debate' | 'other';
export type ReportReason =
  | 'harassment'
  | 'toxic_chat'
  | 'spam'
  | 'cheating'
  | 'inappropriate_content'
  | 'other';
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
export type ReportResolution = 'none' | 'warned' | 'muted' | 'banned' | 'dismissed';

export interface IReport extends Document {
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId | null;
  reporterId: mongoose.Types.ObjectId;
  reporterName: string;
  reportedUserId: mongoose.Types.ObjectId | null;
  reportedUserName: string;
  roomId: mongoose.Types.ObjectId | null;
  roomTitle: string;
  messageId: mongoose.Types.ObjectId | null;
  messageSnippet: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolution: ReportResolution;
  adminNote: string;
  resolvedBy: mongoose.Types.ObjectId | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    targetType: {
      type: String,
      enum: ['user', 'message', 'room', 'debate', 'other'],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, default: null },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reporterName: { type: String, default: '' },
    reportedUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reportedUserName: { type: String, default: '' },
    roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', default: null },
    roomTitle: { type: String, default: '' },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    messageSnippet: { type: String, default: '', maxlength: 280 },
    reason: {
      type: String,
      enum: ['harassment', 'toxic_chat', 'spam', 'cheating', 'inappropriate_content', 'other'],
      default: 'other',
    },
    details: { type: String, default: '', maxlength: 1000 },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'resolved', 'dismissed'],
      default: 'open',
    },
    resolution: {
      type: String,
      enum: ['none', 'warned', 'muted', 'banned', 'dismissed'],
      default: 'none',
    },
    adminNote: { type: String, default: '', maxlength: 1000 },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });
reportSchema.index({ reportedUserId: 1, createdAt: -1 });
reportSchema.index({ roomId: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', reportSchema);
