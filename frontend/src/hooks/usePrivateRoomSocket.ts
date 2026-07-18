import { useEffect, useState } from 'react';
import { useSocket } from './useSocket';
import type { ChatMessage } from '@/types';

export type PrivateRoomTeam = 'proposition' | 'opposition' | 'judge';

interface PrivateRoomJoinPayload {
  roomId: string;
  team: PrivateRoomTeam;
  participantCount: number;
  messageHistory?: ChatMessage[];
  participants?: string[];
}

interface PrivateRoomParticipantUpdate {
  type: 'joined' | 'left';
  userId: string;
  username?: string;
  team: PrivateRoomTeam;
  participantCount: number;
  participants?: string[];
}

interface UsePrivateRoomSocketResult {
  joined: boolean;
  participantCount: number;
  participantUserIds: string[];
  messages: ChatMessage[];
  error: string | null;
  sendMessage: (content: string) => void;
  leave: () => void;
}

export function usePrivateRoomSocket(
  roomId: string | undefined,
  team: PrivateRoomTeam | null,
): UsePrivateRoomSocketResult {
  const [joined, setJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [participantUserIds, setParticipantUserIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    if (!roomId || !team || !socket) return;

    setError(null);
    setJoined(false);
    setParticipantCount(0);
    setParticipantUserIds([]);
    setMessages([]);

    let cancelled = false;
    const safeEmitJoin = () => {
      if (cancelled || !socket.connected) return;
      socket.emit(
        'private-room:join',
        { roomId, team },
        (response: { success: boolean; message?: string }) => {
          if (cancelled) return;
          if (!response.success) {
            setError(response.message || 'Failed to join private room');
            setJoined(false);
          }
        },
      );
    };

    if (socket.connected) {
      safeEmitJoin();
    } else {
      socket.once('connect', safeEmitJoin);
    }

    const handleJoined = (data: PrivateRoomJoinPayload) => {
      if (data.roomId !== roomId || data.team !== team) return;
      setJoined(true);
      setParticipantCount(data.participantCount);
      setMessages(data.messageHistory || []);
      if (data.participants) {
        setParticipantUserIds(data.participants);
      }
    };

    const handleParticipantUpdate = (data: PrivateRoomParticipantUpdate) => {
      if (data.team !== team) return;
      setParticipantCount(data.participantCount);
      if (data.participants) {
        setParticipantUserIds(data.participants);
      } else {
        setParticipantUserIds((prev) => {
          if (data.type === 'joined' && !prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          if (data.type === 'left') {
            return prev.filter((id) => id !== data.userId);
          }
          return prev;
        });
      }
    };

    const handleMessage = (msg: ChatMessage & { team?: PrivateRoomTeam }) => {
      if (msg.team !== team) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    };

    const handleError = (data: { message: string }) => {
      setError(data.message);
    };

    const handleLeft = () => {
      setJoined(false);
      setMessages([]);
      setParticipantCount(0);
      setParticipantUserIds([]);
    };

    socket.on('private-room:joined', handleJoined);
    socket.on('private-room:participant-update', handleParticipantUpdate);
    socket.on('private-chat:message', handleMessage);
    socket.on('private-room:error', handleError);
    socket.on('private-room:left', handleLeft);

    return () => {
      cancelled = true;
      socket.off('connect', safeEmitJoin);
      if (socket.connected) {
        socket.emit('private-room:leave', { roomId, team });
      }
      socket.off('private-room:joined', handleJoined);
      socket.off('private-room:participant-update', handleParticipantUpdate);
      socket.off('private-chat:message', handleMessage);
      socket.off('private-room:error', handleError);
      socket.off('private-room:left', handleLeft);
    };
  }, [roomId, team, socket]);

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || !roomId || !team || !socket) return;
    socket.emit('private-chat:send', { roomId, team, content: trimmed });
  };

  const leave = () => {
    if (!roomId || !team || !socket) return;
    socket.emit('private-room:leave', { roomId, team });
  };

  return {
    joined,
    participantCount,
    participantUserIds,
    messages,
    error,
    sendMessage,
    leave,
  };
}
