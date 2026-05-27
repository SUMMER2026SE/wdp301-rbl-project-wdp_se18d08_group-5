export const ENV = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4300/api/v1',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:4300',
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
} as const;
