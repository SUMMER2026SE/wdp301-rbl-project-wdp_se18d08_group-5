import api from './api';
import type {
  AdminUser,
  AdminUsersQueryParams,
  ApiResponse,
  BanUserRequest,
  DebateHistoryItem,
  PaginatedResponse,
  UpdateProfileRequest,
  UpdateUserRoleRequest,
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

  getAdminUsers(params?: AdminUsersQueryParams) {
    return api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  },

  updateUserRole(userId: string, data: UpdateUserRoleRequest) {
    return api.patch<ApiResponse<AdminUser>>(`/admin/users/${userId}/role`, data);
  },

  banUser(userId: string, data: BanUserRequest) {
    return api.post<ApiResponse<AdminUser>>(`/admin/users/${userId}/ban`, data);
  },

  unbanUser(userId: string) {
    return api.post<ApiResponse<AdminUser>>(`/admin/users/${userId}/unban`);
  },
};
