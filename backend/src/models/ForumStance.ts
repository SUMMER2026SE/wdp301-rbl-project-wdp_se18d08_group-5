import mongoose, { Document, Schema, Types } from 'mongoose';

export type ForumStanceValue = 'agree' | 'disagree';

export interface IForumStance extends Document {
  topic: Types.ObjectId;
  user: Types.ObjectId;
  stance: ForumStanceValue;
  createdAt: Date;
  updatedAt: Date;
}

const forumStanceSchema = new Schema<IForumStance>(
  {
    topic: { type: Schema.Types.ObjectId, ref: 'ForumTopic', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stance: { type: String, enum: ['agree', 'disagree'], required: true },
  },
  { timestamps: true },
);

forumStanceSchema.index({ topic: 1, user: 1 }, { unique: true });
forumStanceSchema.index({ topic: 1, stance: 1 });

export const ForumStance = mongoose.model<IForumStance>('ForumStance', forumStanceSchema);
