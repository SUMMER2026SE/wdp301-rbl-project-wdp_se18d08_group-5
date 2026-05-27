import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ENV } from '@/config/env';
import { useAuthStore } from '@stores/authStore';

let socket: Socket | null = null;

/**
 * Singleton socket connection.
 * Connects with JWT auth on handshake.
 */
export function getSocket(): Socket | null {
  return socket;
}

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    if (!socket) {
      socket = io(ENV.SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
    }

    socketRef.current = socket;

    return () => {
      // Don't disconnect on unmount — keep connection alive
    };
  }, [isAuthenticated, accessToken]);

  const joinRoom = useCallback((roomId: string) => {
    socket?.emit('room:join', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socket?.emit('room:leave', { roomId });
  }, []);

  const sendMessage = useCallback((roomId: string, content: string) => {
    socket?.emit('chat:send', { roomId, content });
  }, []);

  const disconnect = useCallback(() => {
    socket?.disconnect();
    socket = null;
  }, []);

  return {
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
    sendMessage,
    disconnect,
    isConnected: socket?.connected ?? false,
  };
}
