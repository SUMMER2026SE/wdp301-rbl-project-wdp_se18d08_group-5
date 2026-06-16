import api from './api';
import type { AdminReport, ApiResponse, CreateReportRequest } from '@/types';

export const reportService = {
  create(data: CreateReportRequest) {
    return api.post<ApiResponse<AdminReport>>('/reports', data);
  },
};
