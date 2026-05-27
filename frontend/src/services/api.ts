import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '@/config/env';
import { useAuthStore } from '@stores/authStore';

const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach access token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 + refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${ENV.API_BASE_URL}/auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = data.data;
        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
