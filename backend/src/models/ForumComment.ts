import mongoose, { Document, Schema, Types } from 'mongoose';
import type { ForumStanceValue } from './ForumStance.js';

export interface IForumComment extends Document {
  post: Types.ObjectId;
  author: Types.ObjectId;
  stance: ForumStanceValue;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const forumCommentSchema = new Schema<IForumComment>(
  {
    post: { type: Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stance: { type: String, enum: ['agree', 'disagree'], required: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
  },
  { timestamps: true },
);

forumCommentSchema.index({ post: 1, createdAt: 1 });

export const ForumComment = mongoose.model<IForumComment>('ForumComment', forumCommentSchema);
