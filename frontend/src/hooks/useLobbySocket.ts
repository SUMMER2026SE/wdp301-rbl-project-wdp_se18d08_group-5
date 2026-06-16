import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from './useSocket';
import { useDebateStore } from '@stores/debateStore';

/**
 * Lobby realtime hook. Joins the room channel on mount, listens for
 * server broadcasts about room state changes and debate start, and
 * keeps the local cache in sync.
 *
 * - `room:state-updated` → invalidate (handled by caller via callback)
 * - `room:participant-update` → invalidate
 * - `debate:started` → auto-navigate to the live debate page
 *
 * The hook retries `room:join` whenever the underlying socket reconnects
 * so a transient disconnect never leaves the client out of the channel.
 */
export function useLobbySocket(
  roomId: string | undefined,
  onRoomStateUpdated?: () => void,
) {
  const navigate = useNavigate();
  const setRoom = useDebateStore((state) => state.setRoom);
  const setParticipants = useDebateStore((state) => state.setParticipants);

  useEffect(() => {
    if (!roomId) return;

    const handleStateUpdated = (data: {
      roomId: string;
      room?: unknown;
      status?: string;
      currentPhase?: string;
      participants?: unknown;
    }) => {
      if (data.roomId !== roomId) return;
      if (data.room) {
        setRoom(data.room as never);
      }
      if (data.participants) {
        setParticipants(data.participants as never);
      }
      onRoomStateUpdated?.();
    };

    const handleDebateStarted = (data: { roomId: string }) => {
      if (data.roomId !== roomId) return;
      navigate(`/debate/${roomId}`);
    };

    const handleParticipantUpdate = (data: { roomId?: string }) => {
      if (data?.roomId && data.roomId !== roomId) return;
      onRoomStateUpdated?.();
    };

    const joinChannel = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      socket.emit('room:join', { roomId });
    };

    const attach = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      joinChannel(socket);
      socket.on('room:state-updated', handleStateUpdated);
      socket.on('debate:started', handleDebateStarted);
      socket.on('room:participant-update', handleParticipantUpdate);
    };

    const detach = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      socket.emit('room:leave', { roomId });
      socket.off('room:state-updated', handleStateUpdated);
      socket.off('debate:started', handleDebateStarted);
      socket.off('room:participant-update', handleParticipantUpdate);
    };

    const socket = getSocket();
    attach(socket);

    const handleConnect = () => joinChannel(socket);
    socket?.on('connect', handleConnect);

    return () => {
      socket?.off('connect', handleConnect);
      detach(socket);
    };
  }, [navigate, onRoomStateUpdated, roomId, setParticipants, setRoom]);
}
