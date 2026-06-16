import api from './api';
import type {
  AdminOverview,
  AdminReport,
  AdminReportsQueryParams,
  AdminRoom,
  AdminRoomDetail,
  AdminRoomsQueryParams,
  AdminUser,
  AdminUsersQueryParams,
  ApiResponse,
  BanUserRequest,
  PaginatedResponse,
  ReportStatus,
  UpdateReportRequest,
  UpdateUserRoleRequest,
} from '@/types';

export const adminService = {
  getOverview() {
    return api.get<ApiResponse<AdminOverview>>('/admin/overview');
  },

  getUsers(params?: AdminUsersQueryParams) {
    return api.get<PaginatedResponse<AdminUser>>('/admin/users', { params });
  },

  getUser(userId: string) {
    return api.get<ApiResponse<{ user: AdminUser; activity: {
      roomsCreated: number;
      roomsJoined: number;
      reportsFiled: number;
      reportsReceived: number;
    } }>>(`/admin/users/${userId}`);
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

  getRooms(params?: AdminRoomsQueryParams) {
    return api.get<PaginatedResponse<AdminRoom>>('/admin/rooms', { params });
  },

  getRoom(roomId: string) {
    return api.get<ApiResponse<AdminRoomDetail>>(`/admin/rooms/${roomId}`);
  },

  updateRoomStatus(roomId: string, status: AdminRoom['status'], reason?: string) {
    return api.patch<ApiResponse<AdminRoom>>(`/admin/rooms/${roomId}/status`, { status, reason });
  },

  kickParticipant(roomId: string, userId: string, reason?: string) {
    return api.post<ApiResponse<AdminRoom>>(`/admin/rooms/${roomId}/kick`, { userId, reason });
  },

  muteParticipant(roomId: string, userId: string, muted: boolean, reason?: string) {
    return api.post<ApiResponse<AdminRoom>>(`/admin/rooms/${roomId}/mute`, { userId, muted, reason });
  },

  setViewerChat(roomId: string, enabled: boolean) {
    return api.patch<ApiResponse<AdminRoom>>(`/admin/rooms/${roomId}/viewer-chat`, { enabled });
  },

  getReports(params?: AdminReportsQueryParams) {
    return api.get<PaginatedResponse<AdminReport>>('/admin/reports', { params });
  },

  updateReport(reportId: string, data: UpdateReportRequest) {
    return api.patch<ApiResponse<{ report: AdminReport; moderatedUser: AdminUser | null }>>(
      `/admin/reports/${reportId}`,
      data,
    );
  },

  setReportStatus(reportId: string, status: ReportStatus) {
    return api.patch<ApiResponse<{ report: AdminReport; moderatedUser: AdminUser | null }>>(
      `/admin/reports/${reportId}`,
      { status, resolution: 'none' },
    );
  },
};
