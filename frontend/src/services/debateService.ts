import api from './api';
import type { AIDebateFinalAnalysis, ApiResponse, DebateSession } from '@/types';

export interface DebateControlResult {
  room?: unknown;
  session: DebateSession;
  currentTurn?: DebateSession['currentTurn'];
  ranking?: unknown;
}

export const debateService = {
  getSession(roomId: string) {
    return api.get<ApiResponse<DebateSession>>(`/debate/${roomId}/session`);
  },

  nextTurn(roomId: string, transcript?: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/next-turn`, { transcript });
  },

  finishPhase(roomId: string, transcript?: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/finish-phase`, { transcript });
  },

  passCeTurn(roomId: string, content?: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/ce/pass-turn`, { content });
  },

  finishCe(roomId: string, transcript?: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/ce/finish`, { transcript });
  },

  pause(roomId: string) {
    return api.post(`/debate/${roomId}/host/pause`);
  },

  resume(roomId: string) {
    return api.post(`/debate/${roomId}/host/resume`);
  },

  debaterPause(roomId: string) {
    return api.post(`/debate/${roomId}/debater/pause`);
  },

  debaterResume(roomId: string) {
    return api.post(`/debate/${roomId}/debater/resume`);
  },

  issueCard(roomId: string, userId: string, reason: string) {
    return api.post(`/debate/${roomId}/host/issue-card`, { userId, reason });
  },

  kick(roomId: string, userId: string) {
    return api.post(`/debate/${roomId}/host/kick`, { userId });
  },

  submitScore(roomId: string, payload: Record<string, unknown>) {
    return api.post(`/debate/${roomId}/judge/submit-score`, payload);
  },

  end(roomId: string, summary?: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/end`, { summary });
  },

  surrender(roomId: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/surrender`);
  },

  requestDraw(roomId: string) {
    return api.post<ApiResponse<DebateControlResult>>(`/debate/${roomId}/draw/request`);
  },

  getScores(roomId: string) {
    return api.get<ApiResponse<{
      finalScores: DebateSession['finalScores'];
      judgeVerdicts: NonNullable<DebateSession['finalScores']>['judgeVerdicts'];
      turnHistory: DebateSession['turnHistory'];
    }>>(`/debate/${roomId}/scores`);
  },

  getReplay(roomId: string) {
    return api.get<ApiResponse<{ room: unknown; session: DebateSession }>>(`/debate/${roomId}/replay`);
  },

  generateFinalAnalysis(roomId: string) {
    return api.post<ApiResponse<{
      analysis: AIDebateFinalAnalysis;
      aiSummary: string | null;
      finalScores: DebateSession['finalScores'];
    }>>(`/debate/${roomId}/final-analysis`);
  },
};
