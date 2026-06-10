import api from './api';
import type {
  ApiResponse,
  PaginatedResponse,
  CreateRoomRequest,
  DebateRoom,
  Team,
  SpeakerSlot,
  RoomParticipant,
  SubmitJudgeScoreRequest,
  SubmitJudgeScoreResponse,
  FinalScores,
  WinnerResult,
  RankingApplicationResult,
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

  setViewerChat(roomId: string, enabled: boolean) {
    return api.post<ApiResponse<{ viewerChatEnabled: boolean }>>(
      `/rooms/${roomId}/host/viewer-chat`,
      { enabled },
    );
  },

  transferHost(roomId: string, userId: string) {
    return api.post<
      ApiResponse<{
        hostId: string;
        hostType: 'human';
        previousHostId: string | null;
        participants: RoomParticipant[];
      }>
    >(`/rooms/${roomId}/host/transfer`, { userId });
  },

  submitJudgeScore(roomId: string, data: SubmitJudgeScoreRequest) {
    return api.post<ApiResponse<SubmitJudgeScoreResponse>>(
      `/rooms/${roomId}/judge/submit-score`,
      data,
    );
  },

  aggregateScores(roomId: string) {
    return api.post<ApiResponse<FinalScores>>(`/rooms/${roomId}/scores/aggregate`);
  },

  getWinner(roomId: string) {
    return api.get<ApiResponse<WinnerResult>>(`/rooms/${roomId}/winner`);
  },

  determineWinner(roomId: string) {
    return api.post<ApiResponse<WinnerResult>>(`/rooms/${roomId}/winner`);
  },

  applyRankResult(roomId: string) {
    return api.post<ApiResponse<RankingApplicationResult>>(`/rooms/${roomId}/result`);
  },
};
