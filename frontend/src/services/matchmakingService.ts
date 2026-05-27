import api from './api';
import type { ApiResponse, DebateFormat } from '@/types';

export const matchmakingService = {
  joinQueue(format: DebateFormat) {
    return api.post<ApiResponse<{ queueId: string }>>('/matchmaking/queue', { format });
  },

  leaveQueue() {
    return api.delete('/matchmaking/queue');
  },

  getStatus() {
    return api.get<ApiResponse<{ status: string; format: string; waitTime: number }>>('/matchmaking/status');
  },
};
