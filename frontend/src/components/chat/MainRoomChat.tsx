import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';
import { roomService } from '@services/roomService';
import type { ChatMessage } from '@/types';

interface MainRoomChatProps {
  roomId: string;
  /** If true, this is a private room panel — always allow input for participants */
  isPrivateRoom?: boolean;
}

function formatTime(timestamp: string | Date) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSystemMessage(message: ChatMessage) {
  return message.type === 'system' || message.senderId === 'system';
}

function isCrossExamMessage(message: ChatMessage) {
  return message.type === 'cross-exam';
}

/**
 * Main room debate chat.
 * - host / judge / debater: can read + write
 * - viewer: read-only (input hidden)
 */
export function MainRoomChat({ roomId, isPrivateRoom = false }: MainRoomChatProps) {
  const { user } = useAuthStore();
  const messages = useDebateStore((state) => state.messages);
  const viewerChatEnabled = useDebateStore((state) => state.viewerChatEnabled);
  const isTransitioning = useDebateStore((state) => state.isTransitioning);
  const turnStatus = useDebateStore((state) => state.turnStatus);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Fetch room data as a fallback so we can show the chat input even if the
  // socket store hasn't populated participants yet (e.g., right after
  // reload, before server sends the first `room:joined` payload).
  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const storeParticipants = useDebateStore((s) => s.participants);
  const restParticipants = roomQuery.data?.participants || [];
  const participants = storeParticipants.length > 0 ? storeParticipants : restParticipants;
  const currentParticipant = participants.find((p: { userId: string }) => p.userId === user?._id);
  const myRole = currentParticipant?.roomRole;
  const canSend =
    isPrivateRoom ||
    (myRole === 'host' || myRole === 'judge' || myRole === 'debater');

  const isLocked = !isPrivateRoom && (isTransitioning || turnStatus === 'waiting_to_start');

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const socket = getSocket();
    if (!socket) return;
    setSending(true);
    socket.emit('chat:send', { roomId, content: trimmed, type: 'chat', scope: isPrivateRoom ? 'private' : 'main' });
    setContent('');
    window.setTimeout(() => setSending(false), 300);
  };

  return (
    <div className="d-flex flex-column h-100" style={{ minHeight: 320 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">
          <i className="bi bi-chat-dots me-2" />
          {isPrivateRoom ? 'Private Team Chat' : 'Main Room Chat'}
        </h6>
        {!isPrivateRoom && (
          <Badge bg={viewerChatEnabled ? 'success' : 'secondary'}>
            Viewer {viewerChatEnabled ? 'on' : 'off'}
          </Badge>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-grow-1 overflow-auto px-2 py-2 rounded-3"
        style={{ maxHeight: 320, background: '#ffffff', color: '#1c1c1c' }}
      >
        {messages.length === 0 ? (
          <div className="small text-center py-3" style={{ color: '#888888' }}>
            {isPrivateRoom ? 'No private messages yet.' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((message) => {
            if (isSystemMessage(message)) {
              return (
                <div key={message._id} className="small fst-italic my-1 px-2" style={{ color: '#666666' }}>
                  {message.content}
                </div>
              );
            }
            if (isCrossExamMessage(message)) {
              return (
                <div key={message._id} className="small my-1 px-2 fst-italic border-start ps-2" style={{ color: '#0d6efd', borderColor: '#0d6efd' }}>
                  {message.content}
                </div>
              );
            }
            const isOwn = message.senderId === user?._id;
            return (
              <div key={message._id} className={`my-1 px-2 py-1 rounded-2`} style={{ background: isOwn ? 'rgba(13, 110, 253, 0.08)' : 'rgba(0, 0, 0, 0.03)' }}>
                <div className="d-flex align-items-baseline gap-2">
                  <strong className="small text-capitalize" style={{ color: isOwn ? '#0d6efd' : '#333333' }}>
                    {message.senderName}
                  </strong>
                  <Badge bg="secondary" pill className="text-uppercase" style={{ fontSize: '0.6rem' }}>
                    {message.senderRole}
                  </Badge>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="small" style={{ color: '#1c1c1c' }}>{message.content}</div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <InputGroup className="mt-2">
          <Form.Control
            placeholder={isLocked ? 'Chat is locked...' : (isPrivateRoom ? 'Team message...' : 'Type a message...')}
            value={content}
            disabled={sending || isLocked}
            onChange={(event) => setContent(event.target.value)}
            style={{ background: '#ffffff', color: '#1c1c1c', border: '1px solid #ced4da' }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!content.trim() || sending || isLocked}>
            <i className="bi bi-send" />
          </Button>
        </InputGroup>
      ) : (
        <div className="text-muted small text-center py-2 border rounded-3 mt-2">
          {myRole === 'viewer' ? 'Chat disabled for viewers' : 'Join as a participant to chat'}
        </div>
      )}
    </div>
  );
}
