import { Col, Form, Row } from 'react-bootstrap';
import type { RankTier } from '@/types';

interface LeaderboardSearchFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTier: 'All' | RankTier;
  onTierChange: (tier: 'All' | RankTier) => void;
}

const TIER_LIST: ('All' | RankTier)[] = [
  'All',
  'GrandMaster',
  'Master',
  'Expert',
  'Advanced',
  'Debater',
  'Novice',
];

export function LeaderboardSearchFilter({
  searchQuery,
  onSearchChange,
  selectedTier,
  onTierChange,
}: LeaderboardSearchFilterProps) {
  return (
    <div className="leaderboard-filter-card">
      <Row className="g-3 align-items-center">
        {/* Search */}
        <Col md={5} lg={4}>
          <div className="search-input-wrapper">
            <i className="bi bi-search search-input-icon" />
            <Form.Control
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search competitor by name..."
              className="forum-search-control"
            />
          </div>
        </Col>

        {/* Tier filtering tags */}
        <Col
          md={7}
          lg={8}
          className="d-flex flex-wrap gap-2 align-items-center justify-content-md-end"
        >
          <span className="small text-muted me-1 d-none d-lg-inline">Tier Filter:</span>
          {TIER_LIST.map((tier) => (
            <button
              key={tier}
              type="button"
              className={`tier-filter-badge ${selectedTier === tier ? 'active' : ''}`}
              onClick={() => onTierChange(tier)}
            >
              {tier}
            </button>
          ))}
        </Col>
      </Row>
    </div>
  );
}
