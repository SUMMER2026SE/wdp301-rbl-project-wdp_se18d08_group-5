import { useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDebateStore } from '@stores/debateStore';
import { roomService } from '@services/roomService';
import { useSocket } from '@hooks/useSocket';

const DEBATE_ROOM_STORAGE_KEY = 'current_debate_room';

interface StoredDebateRoom {
  roomId: string;
  roomName: string;
  isLobby?: boolean;
}

export function useDebateRoomTracker(roomId?: string, roomName?: string, isLobby?: boolean) {
  const { room } = useDebateStore();

  useEffect(() => {
    if (roomId && roomName) {
      localStorage.setItem(
        DEBATE_ROOM_STORAGE_KEY,
        JSON.stringify({ roomId, roomName, isLobby })
      );
    } else if (roomId) {
      localStorage.setItem(
        DEBATE_ROOM_STORAGE_KEY,
        JSON.stringify({ roomId, roomName: room?.title || 'Debate Room', isLobby })
      );
    }
  }, [roomId, roomName, room, isLobby]);

  useEffect(() => {
    return () => {
      // Only clear if we're not in a debate room anymore
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/debate/') && !currentPath.includes('/lobby')) {
        // Don't clear here - the banner will handle showing/hiding
      }
    };
  }, []);
}

export function clearDebateRoomFromStorage() {
  localStorage.removeItem(DEBATE_ROOM_STORAGE_KEY);
}

export function getStoredDebateRoom(): StoredDebateRoom | null {
  try {
    const stored = localStorage.getItem(DEBATE_ROOM_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredDebateRoom;
    }
  } catch {
    // ignore
  }
  return null;
}

export function ReturnToDebateBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { room, winnerResult } = useDebateStore();
  const [storedRoom, setStoredRoom] = useState<StoredDebateRoom | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const isOnRoomPage = location.pathname.includes('/debate/') || location.pathname.includes('/lobby');
  const isOnResultPage = location.pathname.includes('/replay/') || location.pathname.includes('/result');
  const { socket } = useSocket();

  useEffect(() => {
    if (isOnRoomPage || isOnResultPage) {
      clearDebateRoomFromStorage();
      setStoredRoom(null);
      return;
    }

    const stored = getStoredDebateRoom();
    if (stored) {
      // Validate with backend if the room is still active
      roomService.getById(stored.roomId)
        .then((res) => {
          const roomData = res.data.data;
          if (!roomData || ['completed', 'deleted'].includes(roomData.status)) {
            clearDebateRoomFromStorage();
            setStoredRoom(null);
          } else {
            setStoredRoom(stored);
          }
        })
        .catch(() => {
          clearDebateRoomFromStorage();
          setStoredRoom(null);
        });
    } else {
      setStoredRoom(null);
    }
  }, [location.pathname, isOnRoomPage, isOnResultPage]);

  useEffect(() => {
    // Clear banner when debate ends
    if (winnerResult || room?.status === 'completed' || isOnResultPage) {
      clearDebateRoomFromStorage();
      setStoredRoom(null);
      setDismissed(true);
    }
  }, [winnerResult, room?.status, isOnResultPage]);

  useEffect(() => {
    // Clear when navigating to the debate room
    if (isOnRoomPage) {
      clearDebateRoomFromStorage();
      setStoredRoom(null);
      setDismissed(false);
    }
  }, [location.pathname, isOnRoomPage]);

  // Listen for real-time debate end events to immediately dismiss the banner
  useEffect(() => {
    if (!socket) return;

    const handleDebateEnded = (data: { roomId: string }) => {
      const stored = getStoredDebateRoom();
      if (stored && stored.roomId === data.roomId) {
        clearDebateRoomFromStorage();
        setStoredRoom(null);
        setDismissed(true);
      }
    };

    const handleRoomUpdate = (data: { action: string; roomId: string }) => {
      if (data.action === 'completed' || data.action === 'delete') {
        const stored = getStoredDebateRoom();
        if (stored && stored.roomId === data.roomId) {
          clearDebateRoomFromStorage();
          setStoredRoom(null);
          setDismissed(true);
        }
      }
    };

    socket.on('debate:ended', handleDebateEnded);
    socket.on('room:update', handleRoomUpdate);

    return () => {
      socket.off('debate:ended', handleDebateEnded);
      socket.off('room:update', handleRoomUpdate);
    };
  }, [socket]);

  // Belt-and-suspenders: when we land on the replay/result page, always wipe
  // the stored debate-room reference so the banner can never resurface here.
  useEffect(() => {
    if (isOnResultPage) {
      clearDebateRoomFromStorage();
      setStoredRoom(null);
      setDismissed(true);
    }
  }, [isOnResultPage]);

  // Don't show if:
  // - We're already on a debate or lobby page
  // - We're on the replay page (debate has ended)
  // - No stored debate room
  // - Banner was dismissed
  // - User is not authenticated
  if (isOnRoomPage || isOnResultPage || !storedRoom || dismissed) {
    return null;
  }

  const handleReturn = () => {
    if (storedRoom.isLobby) {
      navigate(`/rooms/${storedRoom.roomId}/lobby`);
    } else {
      navigate(`/debate/${storedRoom.roomId}`);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 d-flex align-items-center justify-content-center gap-3 py-2 px-3"
      style={{
        zIndex: 9999,
        background: 'rgba(10, 10, 20, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 245, 255, 0.3)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <i className="bi bi-broadcast" style={{ color: '#00f5ff', fontSize: '1.2rem' }}></i>

      <span className="text-white" style={{ fontSize: '0.95rem' }}>
        Return to debate room:{' '}
        <strong style={{ color: '#00f5ff' }}>{storedRoom.roomName}</strong>
      </span>

      <Button
        size="sm"
        onClick={handleReturn}
        style={{
          background: 'linear-gradient(135deg, #00f5ff 0%, #0099cc 100%)',
          border: 'none',
          color: '#000',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          padding: '0.35rem 1rem',
          borderRadius: '20px',
          boxShadow: '0 2px 10px rgba(0, 245, 255, 0.4)',
        }}
      >
        Return
      </Button>

      <button
        onClick={handleDismiss}
        className="btn-close btn-close-white"
        aria-label="Close"
        style={{
          opacity: 0.6,
          marginLeft: '0.5rem',
        }}
      ></button>
    </div>
  );
}
