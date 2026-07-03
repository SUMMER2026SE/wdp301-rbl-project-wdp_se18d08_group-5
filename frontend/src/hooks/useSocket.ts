import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ENV } from '@/config/env';
import { useAuthStore } from '@stores/authStore';

let socket: Socket | null = null;
let socketToken: string | null = null;

/**
 * Singleton socket connection.
 * Connects with JWT auth on handshake.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Internal helper used by `useSocket` and the global initializer.
 * Creates the singleton if it doesn't exist OR if the auth token has changed
 * (token rotation on login/logout in the same tab).
 */
function ensureSocket(accessToken: string): Socket {
  // If we already have a socket for the same token, reuse it.
  if (socket && socketToken === accessToken && socket.connected) {
    return socket;
  }
  // If token changed or socket is stale, tear down the old socket.
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
    socketToken = null;
  }
  socket = io(ENV.SOCKET_URL, {
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
  socketToken = accessToken;
  return socket;
}

/**
 * Hook used by components that want to *use* an already-connected socket.
 * It does NOT initialize the connection on its own — `useSocketConnection`
 * (called from App) takes care of that. This way, every page that needs
 * realtime data can rely on the singleton without re-creating it.
 */
export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const [activeSocket, setActiveSocket] = useState<Socket | null>(socket);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setActiveSocket(null);
      return;
    }
    const s = ensureSocket(accessToken);
    setActiveSocket(s);
  }, [isAuthenticated, accessToken]);

  const joinRoom = useCallback((roomId: string) => {
    socket?.emit('join-room', { roomId });
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    socket?.emit('leave-room', { roomId });
  }, []);

  const sendMessage = useCallback((roomId: string, content: string) => {
    socket?.emit('chat:send', { roomId, content });
  }, []);

  const disconnect = useCallback(() => {
    socket?.disconnect();
    socket = null;
    setActiveSocket(null);
  }, []);

  return {
    socket: activeSocket,
    joinRoom,
    leaveRoom,
    sendMessage,
    disconnect,
    isConnected: activeSocket?.connected ?? false,
  };
}

/**
 * Initialize the singleton socket connection as soon as the user is
 * authenticated. Mount this from <App /> (or MainLayout) so every page
 * — including the room lobby and live-matches — can use realtime events
 * without each component having to bootstrap the socket itself.
 *
 * It is safe to call from multiple components: the singleton is created
 * exactly once.
 */
export function useSocketConnection() {
  const { accessToken, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      return;
    }
    ensureSocket(accessToken);
  }, [isAuthenticated, accessToken]);
}
