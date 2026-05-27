import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchQueue extends Document {
  userId: mongoose.Types.ObjectId;
  format: string;
  eloAtQueue: number;
  status: string;
  matchedRoomId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const matchQueueSchema = new Schema<IMatchQueue>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    format: { type: String, enum: ['1v1', '3v3'], required: true },
    eloAtQueue: { type: Number, required: true },
    status: {
      type: String,
      enum: ['waiting', 'matched', 'cancelled'],
      default: 'waiting',
    },
    matchedRoomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', default: null },
  },
  {
    timestamps: true,
  },
);

matchQueueSchema.index({ status: 1, format: 1, eloAtQueue: 1 });

export const MatchQueue = mongoose.model<IMatchQueue>('MatchQueue', matchQueueSchema);
