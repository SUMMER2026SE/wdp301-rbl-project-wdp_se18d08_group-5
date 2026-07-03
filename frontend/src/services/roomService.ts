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
  SubmitJudgeRoundScoresRequest,
  SubmitJudgeRoundScoresResponse,
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

  leave(roomId: string, newOwnerId?: string) {
    return api.post(`/rooms/${roomId}/leave`, { newOwnerId });
  },

  selectPosition(roomId: string, team: Team, speakerSlot: SpeakerSlot) {
    return api.post(`/rooms/${roomId}/position`, { team, speakerSlot });
  },

  assignParticipant(
    roomId: string,
    data: {
      userId: string;
      role: 'debater' | 'host' | 'judge' | 'viewer';
      team?: Team | null;
      speakerSlot?: SpeakerSlot | null;
    },
  ) {
    return api.post<ApiResponse<DebateRoom>>(`/rooms/${roomId}/assign-role`, data);
  },

  lockPositions(roomId: string) {
    return api.post(`/rooms/${roomId}/position/lock`);
  },

  unlockPositions(roomId: string) {
    return api.post(`/rooms/${roomId}/position/unlock`);
  },

  toggleParticipantLock(roomId: string, userId: string, locked: boolean) {
    return api.post(`/rooms/${roomId}/position/lock-user`, { userId, locked });
  },

  start(roomId: string) {
    return api.post(`/rooms/${roomId}/start`);
  },

  updateMotion(roomId: string, motion: string) {
    return api.post<ApiResponse<{ motion: string }>>(`/rooms/${roomId}/host/motion`, { motion });
  },

  nextTurnWithTranscript(
    roomId: string,
    data: {
      nextSpeaker?: string;
      phase?: string;
      timeLimit?: number;
      transcript?: string;
    },
  ) {
    return api.post(`/rooms/${roomId}/host/next-turn`, data);
  },

  passCrossExamWithTranscript(roomId: string, data: { nextSpeaker?: string; transcript?: string }) {
    return api.post(`/rooms/${roomId}/cross-exam/pass-turn`, data);
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

  submitRoundScores(
    roomId: string,
    data: SubmitJudgeRoundScoresRequest,
  ) {
    return api.post<ApiResponse<SubmitJudgeRoundScoresResponse>>(
      `/rooms/${roomId}/judge/submit-round-scores`,
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

  startPhase(roomId: string) {
    return api.post(`/rooms/${roomId}/host/start-phase`);
  },

  grantSpeaking(roomId: string, userId: string) {
    return api.post(`/rooms/${roomId}/host/grant-speaking`, { userId });
  },

  revokeSpeaking(roomId: string, userId: string) {
    return api.post(`/rooms/${roomId}/host/revoke-speaking`, { userId });
  },

  muteParticipant(roomId: string, userId: string, action: 'mute' | 'unmute') {
    return api.post(`/rooms/${roomId}/host/mute`, { userId, action });
  },

  muteChat(roomId: string, userId: string, action: 'mute' | 'unmute') {
    return api.post(`/rooms/${roomId}/host/mute-chat`, { userId, action });
  },

  muteCamera(roomId: string, userId: string, action: 'mute' | 'unmute') {
    return api.post(`/rooms/${roomId}/host/mute-camera`, { userId, action });
  },
};
