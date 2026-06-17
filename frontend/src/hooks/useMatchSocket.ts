import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSocket } from './useSocket';
import type { Team } from '@/types';

interface MatchFoundPayload {
  roomId: string;
  team: Team;
  opponents: Array<{ userId: string; username: string }>;
}

/**
 * Listens for the `match:found` event and routes the user to the new room.
 * Used by the rank queue page.
 */
export function useMatchSocket() {
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleMatchFound = (data: MatchFoundPayload) => {
      toast.success('Match found! Joining your debate room…');
      navigate(`/debate/${data.roomId}`);
    };

    socket.on('match:found', handleMatchFound);

    return () => {
      socket.off('match:found', handleMatchFound);
    };
  }, [navigate]);
}
