import { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { sendSuccess } from '../../utils/response.js';
import type { AuthRequest } from '../../types/index.js';

export class AuthController {
  async register(req: Request, res: Response) {
    const result = await authService.register(req.body);
    sendSuccess(res, result, 'Registration successful. Please verify your email.', 201);
  }

  async verifyEmail(req: Request, res: Response) {
    const user = await authService.verifyEmail(req.body.token);
    sendSuccess(res, user, 'Email verified');
  }

  async resendVerification(req: AuthRequest, res: Response) {
    const user = await authService.resendVerification(req.user!.userId);
    sendSuccess(res, user, 'Verification email sent');
  }

  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    sendSuccess(res, result, 'Login successful');
  }

  async googleLogin(req: Request, res: Response) {
    const result = await authService.googleLogin(req.body);
    sendSuccess(res, result, 'Google login successful');
  }

  async forgotPassword(req: Request, res: Response) {
    await authService.forgotPassword(req.body);
    sendSuccess(res, null, 'If the email exists, a reset link has been sent');
  }

  async resetPassword(req: Request, res: Response) {
    await authService.resetPassword(req.body);
    sendSuccess(res, null, 'Password reset successful');
  }

  async changePassword(req: AuthRequest, res: Response) {
    await authService.changePassword(req.user!.userId, req.body);
    sendSuccess(res, null, 'Password changed');
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed');
  }

  async getMe(req: AuthRequest, res: Response) {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  }

  async logout(_req: Request, res: Response) {
    sendSuccess(res, null, 'Logged out');
  }
}

export const authController = new AuthController();
