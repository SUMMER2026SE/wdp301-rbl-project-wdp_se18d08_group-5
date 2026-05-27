import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ENV } from '@/config/env';
import { useAuthStore } from '@stores/authStore';
import { authService } from '@services/authService';

const api = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshRequest: Promise<string> | null = null;

async function refreshAccessToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const { data } = await authService.refreshToken(refreshToken);
      const { accessToken, refreshToken: newRefreshToken } = data.data;
      useAuthStore.getState().setTokens(accessToken, newRefreshToken);
      return accessToken;
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

function handleBlockedSession(error: AxiosError) {
  if (error.response?.status !== 403) {
    return false;
  }

  const message = typeof error.response.data === 'object' && error.response.data !== null
    ? (error.response.data as { message?: string }).message
    : '';

  if (!message || !message.includes('Account is banned')) {
    return false;
  }

  useAuthStore.getState().clearAuth();
  redirectToLogin();
  return true;
}

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

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (handleBlockedSession(error)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return api(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        redirectToLogin();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
