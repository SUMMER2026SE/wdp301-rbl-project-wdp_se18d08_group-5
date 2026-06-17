import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Form, InputGroup } from 'react-bootstrap';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';
import type { ChatMessage } from '@/types';

interface ViewerChatProps {
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

/**
 * Viewer chat — only visible to Host and Viewer.
 * Viewers can send messages here; Host can only read.
 * Stored separately from main debate chat.
 */
export function ViewerChat({ roomId }: ViewerChatProps) {
  const { user } = useAuthStore();
  const viewerChatMessages = useDebateStore((state) => state.viewerChatMessages);
  const addViewerChatMessage = useDebateStore((state) => state.addViewerChatMessage);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const currentParticipant = useDebateStore((s) =>
    s.participants.find((p) => p.userId === user?._id),
  );
  const isViewer = currentParticipant?.roomRole === 'viewer';
  const isHost = currentParticipant?.roomRole === 'host';

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [viewerChatMessages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleViewerMessage = (message: ChatMessage) => {
      addViewerChatMessage(message);
    };

    socket.on('viewer-chat:message', handleViewerMessage);
    return () => {
      socket.off('viewer-chat:message', handleViewerMessage);
    };
  }, [addViewerChatMessage]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const socket = getSocket();
    if (!socket) return;
    setSending(true);
    socket.emit('viewer-chat:send', { roomId, content: trimmed });
    setContent('');
    window.setTimeout(() => setSending(false), 300);
  };

  return (
    <div className="d-flex flex-column h-100" style={{ minHeight: 280 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">
          <i className="bi bi-people me-2" />
          Viewer Chat
        </h6>
        <Badge bg="info">
          {isViewer ? 'You are a viewer' : 'Host'}
        </Badge>
      </div>

      <div
        ref={listRef}
        className="flex-grow-1 overflow-auto px-2 py-2 rounded-3"
        style={{ maxHeight: 280, background: '#ffffff', color: '#1c1c1c' }}
      >
        {viewerChatMessages.length === 0 ? (
          <div className="small text-center py-3" style={{ color: '#888888' }}>
            No viewer messages yet.
          </div>
        ) : (
          viewerChatMessages.map((message) => {
            if (isSystemMessage(message)) {
              return (
                <div key={message._id} className="small fst-italic my-1 px-2" style={{ color: '#666666' }}>
                  {message.content}
                </div>
              );
            }
            const isOwn = message.senderId === user?._id;
            return (
              <div key={message._id} className={`my-1 px-2 py-1 rounded-2`} style={{ background: isOwn ? 'rgba(13, 202, 240, 0.08)' : 'rgba(0, 0, 0, 0.03)' }}>
                <div className="d-flex align-items-baseline gap-2">
                  <strong className="small text-capitalize" style={{ color: isOwn ? '#0dcaf0' : '#333333' }}>
                    {message.senderName}
                  </strong>
                  <Badge bg="dark" pill style={{ fontSize: '0.6rem' }}>
                    viewer
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

      {isViewer ? (
        <InputGroup className="mt-2">
          <Form.Control
            placeholder="Chat as a viewer..."
            value={content}
            disabled={sending}
            onChange={(event) => setContent(event.target.value)}
            style={{ background: '#ffffff', color: '#1c1c1c', border: '1px solid #ced4da' }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend} disabled={!content.trim() || sending}>
            <i className="bi bi-send" />
          </Button>
        </InputGroup>
      ) : isHost ? (
        <div className="text-muted small text-center py-2 border rounded-3 mt-2">
          Host view only — viewers can chat here
        </div>
      ) : null}
    </div>
  );
}
