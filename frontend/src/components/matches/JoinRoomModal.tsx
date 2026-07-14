import { Button as RBButton, Form, Modal, Spinner } from 'react-bootstrap';
const Button = RBButton as any;
import type { DebateRoom } from '@/types';

interface JoinRoomModalProps {
  room: DebateRoom | null;
  onHide: () => void;
  onConfirm: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  isPending: boolean;
}

export function JoinRoomModal({
  room,
  onHide,
  onConfirm,
  password,
  onPasswordChange,
  isPending,
}: JoinRoomModalProps) {
  if (!room) return null;

  const isLive = room.status === 'active' || room.status === 'paused';

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm();
  };

  return (
    <Modal show={Boolean(room)} onHide={onHide} centered contentClassName="forum-modal-content">
      <Form onSubmit={handleConfirmSubmit}>
        <Modal.Header closeButton className="forum-modal-header">
          <Modal.Title className="h5 text-white">
            {isLive ? 'Watch Debate Match' : 'Join Match Lobby'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="forum-modal-body text-white">
          {room.isPrivate ? (
            <Form.Group>
              <Form.Label className="small fw-bold">Private Room Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Enter password to enter..."
                autoFocus
                className="compose-text-area"
                required
              />
              <Form.Text className="text-muted">
                This room is password protected. Enter the password key.
              </Form.Text>
            </Form.Group>
          ) : (
            <p className="mb-0">
              Are you sure you want to {isLive ? 'spectate' : 'join'} the room{' '}
              <strong>"{room.title || 'Untitled room'}"</strong>?
            </p>
          )}
        </Modal.Body>
        <Modal.Footer className="forum-modal-footer">
          <Button variant="outline-secondary" onClick={onHide} className="px-4 py-2 border-0">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="px-4 py-2 text-black fw-bold"
            disabled={isPending}
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            {isPending ? (
              <Spinner animation="border" size="sm" variant="dark" />
            ) : isLive ? (
              'Spectate'
            ) : (
              'Join Lobby'
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
