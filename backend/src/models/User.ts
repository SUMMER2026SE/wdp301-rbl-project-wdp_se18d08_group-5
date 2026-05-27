import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  role: string;
  authProvider: 'local' | 'google';
  googleId?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  profile: {
    displayName: string;
    avatar: string;
    bio: string;
    school: string;
    club: string;
  };
  stats: {
    totalDebates: number;
    wins: number;
    losses: number;
    totalScore: number;
    avgScore: number;
  };
  ranking: {
    elo: number;
    tier: string;
    seasonPoints: number;
  };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user',
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: { type: String, sparse: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    profile: {
      displayName: { type: String, default: '' },
      avatar: { type: String, default: '' },
      bio: { type: String, default: '', maxlength: 500 },
      school: { type: String, default: '' },
      club: { type: String, default: '' },
    },
    stats: {
      totalDebates: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      avgScore: { type: Number, default: 0 },
    },
    ranking: {
      elo: { type: Number, default: 1000 },
      tier: {
        type: String,
        enum: ['Novice', 'Debater', 'Advanced', 'Expert', 'Master', 'GrandMaster'],
        default: 'Novice',
      },
      seasonPoints: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ 'ranking.elo': -1 });
userSchema.index({ username: 'text', 'profile.displayName': 'text' });
userSchema.index({ emailVerificationToken: 1 }, { sparse: true });
userSchema.index({ passwordResetToken: 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);
