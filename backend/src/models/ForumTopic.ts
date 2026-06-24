import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IForumTopic extends Document {
  title: string;
  description: string;
  createdBy: Types.ObjectId;
  agreeCount: number;
  disagreeCount: number;
  postCount: number;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const forumTopicSchema = new Schema<IForumTopic>(
  {
    title: { type: String, required: true, trim: true, minlength: 8, maxlength: 200 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agreeCount: { type: Number, default: 0, min: 0 },
    disagreeCount: { type: Number, default: 0, min: 0 },
    postCount: { type: Number, default: 0, min: 0 },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

forumTopicSchema.index({ lastActivityAt: -1 });
forumTopicSchema.index({ createdAt: -1 });

export const ForumTopic = mongoose.model<IForumTopic>('ForumTopic', forumTopicSchema);
