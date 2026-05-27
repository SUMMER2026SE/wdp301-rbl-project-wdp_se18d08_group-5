import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderName: string;
  senderRole: string;
  content: string;
  type: string;
  isToxic: boolean;
  timestamp: Date;
}

const messageSchema = new Schema<IMessage>({
  roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, default: 'viewer' },
  content: { type: String, required: true, maxlength: 1000 },
  type: {
    type: String,
    enum: ['chat', 'system', 'announcement', 'cross-exam'],
    default: 'chat',
  },
  isToxic: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
});

messageSchema.index({ roomId: 1, timestamp: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
