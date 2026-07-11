import React from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';

interface ForumPageHeaderProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onOpenCreate: () => void;
  sortValue: string;
  onSortChange: (value: string) => void;
  activeFilter: 'all' | 'popular' | 'balanced';
  onFilterChange: (filter: 'all' | 'popular' | 'balanced') => void;
}

export function ForumPageHeader({
  searchInput,
  onSearchChange,
  onSearchSubmit,
  onOpenCreate,
  sortValue,
  onSortChange,
  activeFilter,
  onFilterChange,
}: ForumPageHeaderProps) {
  return (
    <div className="forum-header-wrapper mb-4">
      {/* Glass Hero */}
      <section className="forum-hero-section">
        <div className="forum-hero-content d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
          <div>
            <div className="forum-hero-badge">
              <i className="bi bi-shield-fill-check" /> Public Arena
            </div>
            <h1 className="forum-hero-title">Debate Forums</h1>
            <p className="forum-hero-desc">
              Voice your stance, present strong evidence, and challenge opponents. Real-time
              community voting decides which side prevails.
            </p>
          </div>
          <div>
            <Button
              onClick={onOpenCreate}
              className="px-4 py-2 text-black fw-bold d-flex align-items-center gap-2"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'var(--bs-primary)',
                border: 'none',
                boxShadow: '0 0 15px rgba(0, 245, 255, 0.4)',
              }}
            >
              <i className="bi bi-plus-lg fs-5" />
              Create Topic
            </Button>
          </div>
        </div>
      </section>

      {/* Control Panel */}
      <div className="forum-controls-wrapper">
        <Row className="g-3 align-items-center">
          <Col md={6}>
            <Form onSubmit={onSearchSubmit} className="d-flex gap-2">
              <div className="search-input-wrapper">
                <i className="bi bi-search search-input-icon" />
                <Form.Control
                  value={searchInput}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search topics by title or keyword..."
                  aria-label="Search topics"
                  className="forum-search-control"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                className="text-black fw-bold px-3 d-flex align-items-center gap-1"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Search
              </Button>
            </Form>
          </Col>

          <Col md={6} className="d-flex flex-wrap align-items-center justify-content-md-end gap-3">
            {/* Quick Filters */}
            <div className="d-flex gap-2 align-items-center">
              <button
                type="button"
                className={`filter-badge-pill ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => onFilterChange('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-badge-pill ${activeFilter === 'popular' ? 'active' : ''}`}
                onClick={() => onFilterChange('popular')}
              >
                Hot
              </button>
              <button
                type="button"
                className={`filter-badge-pill ${activeFilter === 'balanced' ? 'active' : ''}`}
                onClick={() => onFilterChange('balanced')}
              >
                Controversial
              </button>
            </div>

            {/* Sorting Dropdown */}
            <div className="d-flex align-items-center gap-2">
              <label htmlFor="forum-sort" className="small text-muted text-nowrap mb-0">
                Sort:
              </label>
              <Form.Select
                id="forum-sort"
                size="sm"
                value={sortValue}
                onChange={(e) => onSortChange(e.target.value)}
                className="bg-dark text-white border-secondary rounded"
                style={{ width: '130px', cursor: 'pointer' }}
              >
                <option value="activity">Active</option>
                <option value="newest">Newest</option>
                <option value="posts">Most Posts</option>
                <option value="votes">Most Votes</option>
              </Form.Select>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  );
}
