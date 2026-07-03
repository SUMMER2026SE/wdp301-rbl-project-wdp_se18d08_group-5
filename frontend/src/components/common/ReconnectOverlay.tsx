import { useEffect, useState } from 'react';
import { Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { getSocket } from '@hooks/useSocket';
import { useDebateStore } from '@stores/debateStore';

/**
 * Overlay shown when the socket is disconnected. Re-renders the room
 * state once `room:state-restore` arrives.
 */
export function ReconnectOverlay() {
  const { t } = useTranslation('common');
  const [isConnected, setIsConnected] = useState<boolean>(
    () => getSocket()?.connected ?? false,
  );
  const [hasEverConnected, setHasEverConnected] = useState<boolean>(
    () => getSocket()?.connected ?? false,
  );
  const setRoom = useDebateStore((state) => state.setRoom);
  const setParticipants = useDebateStore((state) => state.setParticipants);
  const setMessages = useDebateStore((state) => state.setMessages);
  const setPhase = useDebateStore((state) => state.setPhase);
  const setTimeRemaining = useDebateStore((state) => state.setTimeRemaining);
  const setPaused = useDebateStore((state) => state.setPaused);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => {
      setIsConnected(true);
      setHasEverConnected(true);
    };
    const onDisconnect = () => setIsConnected(false);
    const onRestore = (data: any) => {
      if (!data?.found) return;
      if (data.room) setRoom(data.room);
      if (data.participants) setParticipants(data.participants);
      if (typeof data.timeRemaining === 'number') setTimeRemaining(data.timeRemaining);
      if (typeof data.isPaused === 'boolean') setPaused(data.isPaused);
      if (data.currentPhase) setPhase(data.currentPhase);
      if (Array.isArray(data.messages)) setMessages(data.messages);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state-restore', onRestore);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state-restore', onRestore);
    };
  }, [setMessages, setParticipants, setPaused, setPhase, setRoom, setTimeRemaining]);

  // Don't show the overlay until the socket has connected at least once.
  // Showing it on the very first mount (when the singleton may not yet be
  // ready) was leaving a full-screen dark backdrop covering the debate page
  // and making it look like a black screen.
  if (!hasEverConnected || isConnected) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(8, 12, 24, 0.85)', zIndex: 1080 }}
    >
      <div className="text-center p-4 rounded-3" style={{ background: 'rgba(13, 17, 36, 0.95)' }}>
        <Spinner animation="border" variant="primary" />
        <div className="mt-3 fw-semibold">{t('common:components.reconnectOverlay.reconnecting')}</div>
        <div className="text-muted small">{t('common:components.reconnectOverlay.restoring')}</div>
      </div>
    </div>
  );
}
