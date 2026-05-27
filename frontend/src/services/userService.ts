import api from './api';
import type { ApiResponse, UpdateProfileRequest, User } from '@/types';

export const userService = {
  getProfile(userId: string) {
    return api.get<ApiResponse<User>>(`/users/${userId}`);
  },

  getStats(userId: string) {
    return api.get<ApiResponse<User>>(`/users/${userId}/stats`);
  },

  updateProfile(userId: string, data: UpdateProfileRequest) {
    return api.put<ApiResponse<User>>(`/users/${userId}/profile`, data);
  },
};
