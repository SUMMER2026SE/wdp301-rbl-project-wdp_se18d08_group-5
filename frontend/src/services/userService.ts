import api from './api';
import type {
  ApiResponse,
  DebateHistoryItem,
  PaginatedResponse,
  UpdateProfileRequest,
  User,
} from '@/types';

export const userService = {
  getProfile(userId: string) {
    return api.get<ApiResponse<User>>(`/users/${userId}`);
  },

  getStats(userId: string) {
    return api.get<ApiResponse<User>>(`/users/${userId}/stats`);
  },

  getHistory(userId: string, params?: { page?: number; limit?: number }) {
    return api.get<PaginatedResponse<DebateHistoryItem>>(`/users/${userId}/history`, { params });
  },

  updateProfile(userId: string, data: UpdateProfileRequest) {
    return api.put<ApiResponse<User>>(`/users/${userId}/profile`, data);
  },
};
