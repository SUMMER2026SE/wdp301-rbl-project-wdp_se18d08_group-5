import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from './useSocket';
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
  const { socket } = useSocket();

  useEffect(() => {
    if (!roomId || !socket) return;

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

    const joinChannel = () => {
      if (socket.connected) {
        socket.emit('room:join', { roomId });
      }
    };

    const attach = () => {
      // If the socket is already connected, join immediately. Otherwise wait
      // for the 'connect' event before emitting — `socket.emit` while
      // disconnected buffers the event, but if the buffer overflows or the
      // socket is mid-reconnect, the server may never receive `room:join`
      // and the participant will miss `debate:started` broadcasts.
      joinChannel();
      socket.on('room:state-updated', handleStateUpdated);
      socket.on('debate:started', handleDebateStarted);
      socket.on('room:participant-update', handleParticipantUpdate);
    };

    const detach = () => {
      socket.off('room:state-updated', handleStateUpdated);
      socket.off('debate:started', handleDebateStarted);
      socket.off('room:participant-update', handleParticipantUpdate);
      // Leave the room channel so the next page (DebateRoomPage) can rejoin
      // cleanly. Without this, the socket stays subscribed to the lobby
      // channel and the next emit('join-room') may race against stale state.
      if (socket.connected) {
        socket.emit('leave-room', { roomId });
      }
    };

    attach();

    const handleConnect = () => joinChannel();
    socket.on('connect', handleConnect);

    return () => {
      socket.off('connect', handleConnect);
      detach();
    };
  }, [navigate, onRoomStateUpdated, roomId, setParticipants, setRoom, socket]);
}
