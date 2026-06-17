import { useState } from 'react';
import { Alert, Button, ListGroup } from 'react-bootstrap';
import { useDebateStore } from '@stores/debateStore';
import { useAuthStore } from '@stores/authStore';
import { getSocket } from '@hooks/useSocket';
import type { Team } from '@/types';

type PrivateRoomTeam = Team | 'judge';

interface PrivateRoomPanelProps {
  roomId: string;
}

function formatTime(timestamp: string | Date) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function PrivateRoomPanel({ roomId }: PrivateRoomPanelProps) {
  const { user } = useAuthStore();
  const currentPrivateRoom = useDebateStore((s) => s.currentPrivateRoom);
  const privateRoomMessages = useDebateStore((s) => s.privateRoomMessages);
  const setCurrentPrivateRoom = useDebateStore((s) => s.setCurrentPrivateRoom);

  const [content, setContent] = useState('');
  const [joining, setJoining] = useState(false);

  const socket = getSocket();
  const myKey = currentPrivateRoom ? `${roomId}::${currentPrivateRoom}` : null;
  const messages = myKey ? (privateRoomMessages[myKey] || []) : [];

  const handleJoin = async (team: PrivateRoomTeam) => {
    if (!socket) return;
    setJoining(true);
    socket.emit('private-room:join', { roomId, team }, (response: { success: boolean; message?: string }) => {
      setJoining(false);
      if (response.success) {
        setCurrentPrivateRoom(team);
        setContent('');
      } else {
        console.error('Failed to join private room:', response.message);
      }
    });
  };

  const handleLeave = () => {
    if (!socket || !currentPrivateRoom) return;
    socket.emit('private-room:leave', { roomId, team: currentPrivateRoom });
    setCurrentPrivateRoom(null);
    setContent('');
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || !currentPrivateRoom) return;
    socket?.emit('private-chat:send', { roomId, team: currentPrivateRoom, content: trimmed });
    setContent('');
  };

  return (
    <div className="d-flex flex-column h-100" style={{ minHeight: 320 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0">
          <i className="bi bi-door-open me-2" />
          {currentPrivateRoom
            ? `${currentPrivateRoom.charAt(0).toUpperCase() + currentPrivateRoom.slice(1)} Private Room`
            : 'Private Rooms'}
        </h6>
        {currentPrivateRoom && (
          <Button size="sm" variant="outline-danger" onClick={handleLeave}>
            <i className="bi bi-box-arrow-left me-1" />
            Leave
          </Button>
        )}
      </div>

      {!currentPrivateRoom ? (
        <>
          <Alert variant="info" className="mb-2 small py-2">
            Select a private room to join. You can only access rooms your role allows.
          </Alert>
          <ListGroup>
            {(['proposition', 'opposition', 'judge'] as PrivateRoomTeam[]).map((team) => (
              <ListGroup.Item
                key={team}
                action
                onClick={() => handleJoin(team)}
                disabled={joining}
                className="d-flex justify-content-between align-items-center"
              >
                <span className="text-capitalize">
                  <i className={`bi ${team === 'proposition' ? 'bi-arrow-up-circle text-info' : team === 'opposition' ? 'bi-arrow-down-circle text-danger' : 'bi-star text-warning'} me-2`} />
                  {team}
                </span>
                <small className="text-muted">
                  {team === 'proposition'
                    ? 'Proposition team only'
                    : team === 'opposition'
                      ? 'Opposition team only'
                      : 'Judges only'}
                </small>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </>
      ) : (
        <>
          <div
            className="flex-grow-1 overflow-auto px-2 py-2 bg-body-tertiary rounded-3 mb-2"
            style={{ maxHeight: 260 }}
          >
            {messages.length === 0 ? (
              <div className="text-muted small text-center py-3">
                No messages in this private room.
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === user?._id;
                const isSystem = msg.senderId === 'system';
                if (isSystem) {
                  return (
                    <div key={msg._id} className="text-muted small fst-italic text-center py-1">
                      {msg.content}
                    </div>
                  );
                }
                return (
                  <div key={msg._id} className={`my-1 px-2 py-1 rounded-2 ${isOwn ? 'bg-primary bg-opacity-10' : ''}`}>
                    <div className="d-flex align-items-baseline gap-2">
                      <strong className="small">{msg.senderName}</strong>
                      <span className="text-muted" style={{ fontSize: '0.65rem' }}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    <div className="small">{msg.content}</div>
                  </div>
                );
              })
            )}
          </div>
          <div className="d-flex gap-1">
            <input
              className="form-control form-control-sm"
              placeholder="Private message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button size="sm" onClick={handleSend} disabled={!content.trim()}>
              <i className="bi bi-send" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
