import mongoose, { Document, Schema, Types } from 'mongoose';
import type { ForumStanceValue } from './ForumStance.js';

export interface IForumPost extends Document {
  topic: Types.ObjectId;
  author: Types.ObjectId;
  stance: ForumStanceValue;
  /** Legacy field retained for existing posts. New posts mirror their opinion here. */
  content: string;
  opinion: string;
  evidenceText: string;
  evidenceImageUrl: string;
  likeUserIds: Types.ObjectId[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const forumPostSchema = new Schema<IForumPost>(
  {
    topic: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stance: { type: String, enum: ['agree', 'disagree'], required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    opinion: { type: String, default: '', trim: true, maxlength: 2000 },
    evidenceText: { type: String, default: '', trim: true, maxlength: 2000 },
    evidenceImageUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    likeUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

forumPostSchema.index({ topic: 1, stance: 1, createdAt: -1 });

export const ForumPost = mongoose.model<IForumPost>('ForumPost', forumPostSchema);
