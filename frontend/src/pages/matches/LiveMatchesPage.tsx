import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Badge, Button, ButtonGroup, Card, Col, Container, Form, Modal, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { roomService } from '@services/roomService';
import type { DebateFormat, DebateRoom, RoomStatus, RoomType } from '@/types';

export default function LiveMatchesPage() {
  const navigate = useNavigate();
  const [format, setFormat] = useState<DebateFormat | ''>('');
  const [roomType, setRoomType] = useState<RoomType | ''>('');
  const [status, setStatus] = useState<RoomStatus | ''>('');
  const [selectedRoom, setSelectedRoom] = useState<DebateRoom | null>(null);
  const [password, setPassword] = useState('');

  const roomsQuery = useQuery({
    queryKey: ['rooms', { format, roomType, status }],
    queryFn: async () => (await roomService.getAll({
      format: format || undefined,
      roomType: roomType || undefined,
      status: status || undefined,
      limit: 24,
    })).data.data,
  });

  const joinMutation = useMutation({
    mutationFn: () => roomService.join(selectedRoom!._id, password),
    onSuccess: () => {
      const room = selectedRoom!;
      toast.success(room.status === 'active' || room.status === 'paused' ? 'Joined as viewer' : 'Joined room');
      navigate(room.status === 'active' || room.status === 'paused' ? `/debate/${room._id}` : `/rooms/${room._id}/lobby`);
    },
    onError: () => toast.error('Could not join room'),
  });

  function openJoin(room: DebateRoom) {
    setSelectedRoom(room);
    setPassword('');
  }

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
        <h2 className="mb-0">
          <i className="bi bi-broadcast me-2" />
          Live Matches
        </h2>
        <Button onClick={() => navigate('/rooms/create')}>
          <i className="bi bi-plus-lg me-2" />
          Create Room
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
          <div>
            <Form.Label>Format</Form.Label>
            <ButtonGroup>
              {(['', '1v1', '3v3'] as Array<DebateFormat | ''>).map((item) => (
                <Button key={item || 'all'} variant={format === item ? 'primary' : 'outline-primary'} onClick={() => setFormat(item)}>
                  {item || 'All'}
                </Button>
              ))}
            </ButtonGroup>
          </div>
          <div>
            <Form.Label>Type</Form.Label>
            <Form.Select value={roomType} onChange={(event) => setRoomType(event.target.value as RoomType | '')}>
              <option value="">All</option>
              <option value="custom">Custom</option>
              <option value="rank">Rank</option>
            </Form.Select>
          </div>
          <div>
            <Form.Label>Status</Form.Label>
            <Form.Select value={status} onChange={(event) => setStatus(event.target.value as RoomStatus | '')}>
              <option value="">Open and live</option>
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </Form.Select>
          </div>
        </Card.Body>
      </Card>

      {roomsQuery.isLoading ? (
        <Spinner animation="border" />
      ) : (
        <Row className="g-3">
          {(roomsQuery.data || []).map((room) => (
            <Col md={6} xl={4} key={room._id}>
              <Card className="h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between gap-2 mb-2">
                    <Card.Title className="mb-0">{room.title || 'Untitled room'}</Card.Title>
                    <Badge bg={room.status === 'active' ? 'success' : 'secondary'}>{room.status}</Badge>
                  </div>
                  <div className="text-muted small mb-3">{room.motion || 'No motion yet'}</div>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <Badge bg="info">{room.format}</Badge>
                    <Badge bg="secondary">{room.roomType}</Badge>
                    {room.isPrivate && <Badge bg="warning">Private</Badge>}
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted small">{room.participants.length} participants</span>
                    {room.status === 'active' || room.status === 'paused' ? (
                      <Button size="sm" variant="outline-primary" onClick={() => openJoin(room)}>
                        Watch
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => openJoin(room)}>
                        Join
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal show={Boolean(selectedRoom)} onHide={() => setSelectedRoom(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Join Room</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRoom?.isPrivate && (
            <Form.Group>
              <Form.Label>Password</Form.Label>
              <Form.Control value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />
            </Form.Group>
          )}
          {!selectedRoom?.isPrivate && (
            <p className="mb-0">
              {selectedRoom?.status === 'active' || selectedRoom?.status === 'paused' ? 'Watch' : 'Join'}{' '}
              {selectedRoom?.title || 'this room'}?
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setSelectedRoom(null)}>Cancel</Button>
          <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
            {selectedRoom?.status === 'active' || selectedRoom?.status === 'paused' ? 'Watch' : 'Join'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
