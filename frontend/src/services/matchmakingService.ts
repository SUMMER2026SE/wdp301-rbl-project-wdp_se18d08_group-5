import api from './api';
import type { ApiResponse, DebateFormat } from '@/types';

export const matchmakingService = {
  joinQueue(format: DebateFormat) {
    return api.post<ApiResponse<{ queueId: string; status: string; format: DebateFormat; elo: number; eloRange: number; waitTime: number; roomId: string | null }>>('/matchmaking/queue', { format });
  },

  leaveQueue() {
    return api.delete('/matchmaking/queue');
  },

  getStatus() {
    return api.get<ApiResponse<{ status: string; format?: string; waitTime?: number; eloRange?: number; roomId?: string | null }>>('/matchmaking/status');
  },
};
