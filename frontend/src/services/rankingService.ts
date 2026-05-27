import api from './api';
import type { ApiResponse, LeaderboardEntry } from '@/types';

export const rankingService = {
  getLeaderboard(params?: { page?: number; limit?: number }) {
    return api.get<ApiResponse<LeaderboardEntry[]>>('/rankings/leaderboard', { params });
  },

  getUserRank(userId: string) {
    return api.get<ApiResponse<{ elo: number; tier: string; rank: number }>>(`/rankings/user/${userId}`);
  },
};
