import { useEffect, useRef, useState } from 'react';
import { Badge, Button as RBButton, Form, InputGroup } from 'react-bootstrap';
const Button = RBButton as any;
import { useTranslation } from 'react-i18next';
import { useDebateStore } from '@stores/debateStore';
import { getSocket } from '@hooks/useSocket';
import type { ChatMessage } from '@/types';

interface ChatPanelProps {
  roomId: string;
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
 * Chat panel for a debate room. Server-authoritative:
 * - Listens to `chat:message` to populate
 * - Sends via `chat:send` (toxic check is performed server-side)
 * - Auto-scrolls to latest message
 * - System messages are styled differently
 */
export function ChatPanel({ roomId }: ChatPanelProps) {
  const { t } = useTranslation('common');
  const messages = useDebateStore((state) => state.messages);
  const viewerChatEnabled = useDebateStore((state) => state.viewerChatEnabled);
  const participants = useDebateStore((state) => state.participants);
  const setMessages = useDebateStore((state) => state.setMessages);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSend = viewerChatEnabled;

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
    socket.emit('chat:send', { roomId, content: trimmed, type: 'chat' });
    setContent('');
    // brief lockout to prevent double-send; the server will broadcast back via chat:message
    window.setTimeout(() => setSending(false), 200);
  };

  return (
    <div className="d-flex flex-column h-100" style={{ minHeight: 360 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">
          <i className="bi bi-chat-dots me-2" />
          Room Chat
        </h6>
        <Badge bg={viewerChatEnabled ? 'success' : 'secondary'}>
          {viewerChatEnabled ? 'Viewer chat on' : 'Viewer chat off'}
        </Badge>
      </div>

      <div
        ref={listRef}
        className="flex-grow-1 overflow-auto px-2 py-2 bg-body-tertiary rounded-3"
        style={{ maxHeight: 360 }}
      >
        {messages.length === 0 ? (
          <div className="text-muted small text-center py-3">{t('common:components.chatPanel.noMessages')}</div>
        ) : (
          messages.map((message) => {
            if (isSystemMessage(message)) {
              return (
                <div key={message._id} className="text-muted small fst-italic my-1">
                  {message.content}
                </div>
              );
            }
            if (isCrossExamMessage(message)) {
              return (
                <div key={message._id} className="small my-1 text-info fst-italic">
                  {message.content}
                </div>
              );
            }
            return (
              <div key={message._id} className="my-1">
                <div className="d-flex align-items-baseline gap-2">
                  <strong className="small text-capitalize">
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
                <div className="small">{message.content}</div>
              </div>
            );
          })
        )}
      </div>

      <InputGroup className="mt-2">
        <Form.Control
          placeholder={canSend ? 'Type a message...' : 'Chat is disabled'}
          value={content}
          disabled={!canSend || sending}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={!canSend || !content.trim() || sending}>
          <i className="bi bi-send" />
        </Button>
      </InputGroup>
      <button
        type="button"
        className="btn btn-link btn-sm align-self-end p-0 mt-1"
        onClick={() => setMessages([])}
        title="Clear local cache"
      >
        {t('actions.clear', 'Clear local')}
      </button>
    </div>
  );
}
