import { OAuth2Client } from 'google-auth-library';
import { User, IUser } from '../../models/User.js';
import { ENV } from '../../config/env.js';
import { generateTokenPair, verifyRefreshToken } from '../../utils/jwt.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../../utils/AppError.js';
import { generateRawToken, hashToken } from '../../utils/token.js';
import { emailService } from './email.service.js';
import type {
  RegisterInput,
  LoginInput,
  GoogleLoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from './auth.schema.js';

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export class AuthService {
  private googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

  async register(input: RegisterInput) {
    const { username, email, password } = input;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      if (existing.email === email) throw new ConflictError('Email already registered');
      throw new ConflictError('Username already taken');
    }

    const verificationToken = generateRawToken();
    const user = await User.create({
      username,
      email,
      password,
      authProvider: 'local',
      isEmailVerified: false,
      emailVerificationToken: hashToken(verificationToken),
      emailVerificationExpires: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      profile: { displayName: username },
    });

    await emailService.sendVerificationEmail(email, verificationToken);
    const tokens = generateTokenPair({ userId: user._id.toString(), role: user.role });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async verifyEmail(token: string) {
    const user = await User.findOne({
      emailVerificationToken: hashToken(token),
      emailVerificationExpires: { $gt: new Date() },
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) throw new BadRequestError('Invalid or expired verification token');

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return this.sanitizeUser(user);
  }

  async resendVerification(userId: string) {
    const user = await User.findById(userId).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) throw new BadRequestError('User not found');
    if (user.isEmailVerified) return this.sanitizeUser(user);

    const verificationToken = generateRawToken();
    user.emailVerificationToken = hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + EMAIL_TOKEN_TTL_MS);
    await user.save();
    await emailService.sendVerificationEmail(user.email, verificationToken);

    return this.sanitizeUser(user);
  }

  async login(input: LoginInput) {
    const { email, password } = input;

    const user = await User.findOne({ email }).select('+password');
    if (!user || user.authProvider !== 'local') {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new UnauthorizedError('Invalid email or password');

    const tokens = generateTokenPair({ userId: user._id.toString(), role: user.role });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async googleLogin(input: GoogleLoginInput) {
    if (!ENV.GOOGLE_CLIENT_ID) throw new BadRequestError('Google OAuth is not configured');

    const ticket = await this.googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: ENV.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || !payload.sub) throw new UnauthorizedError('Invalid Google token');

    let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email: payload.email }] });
    if (!user) {
      const baseUsername = (payload.email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
      const username = await this.createUniqueUsername(baseUsername);
      user = await User.create({
        username,
        email: payload.email.toLowerCase(),
        authProvider: 'google',
        googleId: payload.sub,
        isEmailVerified: true,
        profile: {
          displayName: payload.name || username,
          avatar: payload.picture || '',
        },
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.isEmailVerified = true;
      if (!user.profile.avatar && payload.picture) user.profile.avatar = payload.picture;
      await user.save();
    }

    const tokens = generateTokenPair({ userId: user._id.toString(), role: user.role });
    return { user: this.sanitizeUser(user), ...tokens };
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await User.findOne({ email: input.email }).select('+passwordResetToken +passwordResetExpires');
    if (user && user.authProvider === 'local') {
      const resetToken = generateRawToken();
      user.passwordResetToken = hashToken(resetToken);
      user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await user.save();
      await emailService.sendPasswordResetEmail(user.email, resetToken);
    }
  }

  async resetPassword(input: ResetPasswordInput) {
    const user = await User.findOne({
      passwordResetToken: hashToken(input.token),
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpires +password');

    if (!user) throw new BadRequestError('Invalid or expired reset token');

    user.password = input.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.authProvider = 'local';
    await user.save();
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new BadRequestError('User not found');
    if (user.authProvider !== 'local') throw new BadRequestError('Password login is not enabled for this account');

    const isMatch = await user.comparePassword(input.currentPassword);
    if (!isMatch) throw new UnauthorizedError('Current password is incorrect');

    user.password = input.newPassword;
    await user.save();
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.userId);
      if (!user) throw new UnauthorizedError('User not found');

      const tokens = generateTokenPair({ userId: user._id.toString(), role: user.role });
      return tokens;
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new BadRequestError('User not found');
    return this.sanitizeUser(user);
  }

  private async createUniqueUsername(baseUsername: string) {
    let username = baseUsername;
    let suffix = 0;

    while (await User.exists({ username })) {
      suffix += 1;
      username = `${baseUsername}${suffix}`.slice(0, 20);
    }

    return username;
  }

  private sanitizeUser(user: IUser) {
    const obj = user.toObject();
    delete (obj as any).password;
    delete (obj as any).emailVerificationToken;
    delete (obj as any).emailVerificationExpires;
    delete (obj as any).passwordResetToken;
    delete (obj as any).passwordResetExpires;
    return obj;
  }
}

export const authService = new AuthService();
