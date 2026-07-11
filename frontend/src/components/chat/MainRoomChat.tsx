import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';
import { roomService } from '@services/roomService';
import type { ChatMessage } from '@/types';
import { hasHostControl } from '../../utils/roomPermissions';

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
  const { t } = useTranslation('common');
  const { user } = useAuthStore();
  const messages = useDebateStore((state) => state.messages);
  const viewerChatEnabled = useDebateStore((state) => state.viewerChatEnabled);
  const isTransitioning = useDebateStore((state) => state.isTransitioning);
  const debateRoom = useDebateStore((state) => state.room);
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
  const currentParticipant = participants.find((p: { userId: any }) => {
    const pId = typeof p.userId === 'object' && p.userId?._id ? p.userId._id : p.userId;
    return String(pId) === String(user?._id);
  });
  const myRole = currentParticipant?.roomRole;
  const isChatMuted = Boolean(currentParticipant?.chatMuted);

  const isHost = hasHostControl(roomQuery.data || debateRoom, user?._id);

  const canSend =
    isPrivateRoom ||
    ((isHost || myRole === 'judge' || myRole === 'debater') && !isChatMuted);

  const isLocked = !isPrivateRoom && isTransitioning;

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
    <div className="debate-chat d-flex flex-column h-100" style={{ minHeight: 0 }}>
      <div className="debate-chat-header d-flex align-items-center justify-content-between mb-2 flex-shrink-0">
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
        className="debate-chat-messages flex-grow-1 overflow-auto px-2 py-2"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div className="debate-chat-empty small text-center py-3">
            {isPrivateRoom ? 'No private messages yet.' : 'No messages yet.'}
          </div>
        ) : (
          messages.map((message) => {
            if (isSystemMessage(message)) {
              return (
                <div key={message._id} className="debate-chat-system small fst-italic my-1 px-2">
                  {message.content}
                </div>
              );
            }
            if (isCrossExamMessage(message)) {
              return (
                <div key={message._id} className="debate-chat-cross-exam small my-1 px-2 fst-italic border-start ps-2">
                  {message.content}
                </div>
              );
            }
            const isOwn = message.senderId === user?._id;
            return (
              <div key={message._id} className={`debate-chat-message ${isOwn ? 'is-own' : ''} my-1 px-2 py-1`}>
                <div className="d-flex align-items-baseline gap-2">
                  <strong className="debate-chat-sender small text-capitalize">
                    {message.senderName}
                  </strong>
                  {(() => {
                    let badgeText = message.senderRole?.toUpperCase() || 'UNKNOWN';
                    let customBg = '#6c757d';
                    let customColor = '#ffffff';

                    if (message.senderRole === 'debater') {
                      const participant = participants.find((p: any) => {
                        const uId = typeof p.userId === 'object' ? p.userId?._id : p.userId;
                        return String(uId) === String(message.senderId);
                      });
                      
                      if (participant?.team === 'proposition') {
                        badgeText = 'PROP';
                        customBg = '#007aff'; // vibrant blue
                      } else if (participant?.team === 'opposition') {
                        badgeText = 'OPP';
                        customBg = '#ff3b30'; // vibrant red
                      } else {
                        badgeText = 'DEBATER';
                      }
                    } else if (message.senderRole === 'host' || message.senderRole === 'owner') {
                      badgeText = 'HOST';
                      customBg = '#af52de'; // vibrant purple
                    } else if (message.senderRole === 'judge') {
                      badgeText = 'JUDGE';
                      customBg = '#ffcc00'; // vibrant amber
                      customColor = '#212529'; // dark text for contrast
                    } else if (message.senderRole === 'viewer') {
                      badgeText = 'VIEWER';
                      customBg = '#343a40';
                    }

                    const badgeStyle: React.CSSProperties = { 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      letterSpacing: '0.5px',
                      backgroundColor: customBg,
                      color: customColor,
                      padding: '4px 8px',
                      boxShadow: `0 2px 4px ${customBg}40`,
                      transform: 'translateY(-1px)',
                    };

                    return (
                      <span className="badge rounded-pill text-uppercase" style={badgeStyle}>
                        {badgeText}
                      </span>
                    );
                  })()}
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="debate-chat-content small">{message.content}</div>
              </div>
            );
          })
        )}
      </div>

      {canSend ? (
        <InputGroup className="debate-chat-composer mt-2">
          <Form.Control
            placeholder={isLocked ? 'Chat is locked...' : (isPrivateRoom ? 'Team message...' : 'Type a message...')}
            value={content}
            disabled={sending || isLocked}
            onChange={(event) => setContent(event.target.value)}
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
        <div
          className={`small text-center py-2 border rounded-3 mt-2 ${
            isChatMuted ? 'text-danger border-danger bg-danger bg-opacity-10' : 'text-muted'
          }`}
        >
          {isChatMuted
            ? t('common:components.mainRoomChat.bannedFromChat')
            : myRole === 'viewer'
            ? t('common:components.mainRoomChat.disabledForViewers')
            : t('common:components.mainRoomChat.joinToChat')}
        </div>
      )}
    </div>
  );
}
