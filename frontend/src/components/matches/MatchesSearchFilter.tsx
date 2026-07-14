import { Button as RBButton, ButtonGroup, Col, Form, Row } from 'react-bootstrap';
const Button = RBButton as any;
import type { DebateFormat, RoomStatus, RoomType } from '@/types';

interface MatchesSearchFilterProps {
  format: DebateFormat | '';
  onFormatChange: (format: DebateFormat | '') => void;
  roomType: RoomType | '';
  onRoomTypeChange: (type: RoomType | '') => void;
  status: RoomStatus | 'all' | '';
  onStatusChange: (status: RoomStatus | 'all' | '') => void;
}

export function MatchesSearchFilter({
  format,
  onFormatChange,
  roomType,
  onRoomTypeChange,
  status,
  onStatusChange,
}: MatchesSearchFilterProps) {
  return (
    <div className="matches-controls-wrapper mb-4">
      <Row className="g-3">
        {/* Format Select (1v1, 3v3) */}
        <Col md={4} lg={3}>
          <span className="filter-group-title">Match Format</span>
          <ButtonGroup className="w-100">
            {(['', '1v1', '3v3'] as Array<DebateFormat | ''>).map((item) => (
              <Button
                key={item || 'all'}
                variant={format === item ? 'primary' : 'outline-primary'}
                onClick={() => onFormatChange(item)}
                className={format === item ? 'text-black fw-bold' : 'text-primary'}
                style={{ fontSize: '0.85rem' }}
              >
                {item || 'All'}
              </Button>
            ))}
          </ButtonGroup>
        </Col>

        {/* Room Type (Custom, Rank) */}
        <Col sm={6} md={4} lg={3}>
          <span className="filter-group-title">Match Type</span>
          <Form.Select
            value={roomType}
            onChange={(e) => onRoomTypeChange(e.target.value as RoomType | '')}
            className="bg-dark text-white border-secondary rounded"
            style={{ cursor: 'pointer' }}
          >
            <option value="">All Types</option>
            <option value="custom">Custom Rooms</option>
            <option value="rank">Competitive Rank</option>
          </Form.Select>
        </Col>

        {/* Status */}
        <Col sm={6} md={4} lg={3} className="ms-md-auto">
          <span className="filter-group-title">Broadcast Status</span>
          <Form.Select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as RoomStatus | 'all' | '')}
            className="bg-dark text-white border-secondary rounded"
            style={{ cursor: 'pointer' }}
          >
            <option value="all">All Stages</option>
            <option value="open-live">Open & Live</option>
            <option value="waiting">Waiting Lobby</option>
            <option value="ready">Ready to Start</option>
            <option value="active">Active Debate</option>
            <option value="paused">Paused Room</option>
            <option value="completed">Completed Matches</option>
          </Form.Select>
        </Col>
      </Row>
    </div>
  );
}
