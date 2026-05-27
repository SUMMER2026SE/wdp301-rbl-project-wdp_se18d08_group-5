import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  CreateRoomRequest,
  DebateRoom,
  Team,
  SpeakerSlot,
} from '@/types';

export const roomService = {
  create(data: CreateRoomRequest) {
    return api.post<ApiResponse<DebateRoom>>('/rooms/create', data);
  },

  getAll(params?: {
    status?: string;
    format?: string;
    roomType?: string;
    page?: number;
    limit?: number;
  }) {
    return api.get<PaginatedResponse<DebateRoom>>('/rooms', { params });
  },

  getById(roomId: string) {
    return api.get<ApiResponse<DebateRoom>>(`/rooms/${roomId}`);
  },

  join(roomId: string, password?: string) {
    return api.post<ApiResponse<DebateRoom>>(`/rooms/${roomId}/join`, { password });
  },

  leave(roomId: string) {
    return api.post(`/rooms/${roomId}/leave`);
  },

  selectPosition(roomId: string, team: Team, speakerSlot: SpeakerSlot) {
    return api.post(`/rooms/${roomId}/position`, { team, speakerSlot });
  },

  lockPositions(roomId: string) {
    return api.post(`/rooms/${roomId}/position/lock`);
  },

  start(roomId: string) {
    return api.post(`/rooms/${roomId}/start`);
  },

  kick(roomId: string, userId: string) {
    return api.post(`/rooms/${roomId}/kick`, { userId });
  },
};
