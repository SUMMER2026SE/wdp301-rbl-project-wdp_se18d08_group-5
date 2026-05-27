import api from './api';
import type {
  ApiResponse,
  AuthTokens,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GoogleLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from '@/types';

export const authService = {
  register(data: RegisterRequest) {
    return api.post<ApiResponse<AuthTokens & { user: User }>>('/auth/register', data);
  },

  verifyEmail(token: string) {
    return api.post<ApiResponse<User>>('/auth/verify-email', { token });
  },

  resendVerification() {
    return api.post<ApiResponse<User>>('/auth/resend-verification');
  },

  login(data: LoginRequest) {
    return api.post<ApiResponse<AuthTokens & { user: User }>>('/auth/login', data);
  },

  googleLogin(data: GoogleLoginRequest) {
    return api.post<ApiResponse<AuthTokens & { user: User }>>('/auth/google', data);
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return api.post<ApiResponse<null>>('/auth/forgot-password', data);
  },

  resetPassword(data: ResetPasswordRequest) {
    return api.post<ApiResponse<null>>('/auth/reset-password', data);
  },

  changePassword(data: ChangePasswordRequest) {
    return api.post<ApiResponse<null>>('/auth/change-password', data);
  },

  logout() {
    return api.post('/auth/logout');
  },

  getMe() {
    return api.get<ApiResponse<User>>('/auth/me');
  },

  refreshToken(refreshToken: string) {
    return api.post<ApiResponse<AuthTokens>>('/auth/refresh-token', { refreshToken });
  },
};
