import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Alert, Col, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { forumService } from '@services/forumService';
import { useAuthStore } from '@stores/authStore';
import type { CreateForumTopicRequest } from '@/types';

// Import custom components
import { ForumPageHeader } from '../../components/forum/ForumPageHeader';
import { ForumStatsWidget } from '../../components/forum/ForumStatsWidget';
import { ForumTopicCard } from '../../components/forum/ForumTopicCard';
import { CreateTopicModal } from '../../components/forum/CreateTopicModal';
import { ForumEmptyState } from '../../components/forum/ForumEmptyState';

// Import CSS
import '../../styles/forum.css';

export default function ForumPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [sortValue, setSortValue] = useState('activity');
  const [activeFilter, setActiveFilter] = useState<'all' | 'popular' | 'balanced'>('all');

  const topicsQuery = useQuery({
    queryKey: ['forum-topics', search],
    queryFn: async () =>
      (await forumService.getTopics({ limit: 100, search: search || undefined })).data,
  });

  const createTopicMutation = useMutation({
    mutationFn: (data: CreateForumTopicRequest) => forumService.createTopic(data),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success('Topic created successfully');
      setShowCreate(false);
      navigate(`/forum/${response.data.data._id}`);
    },
    onError: () => toast.error('Could not create topic. The title needs at least 8 characters.'),
  });

  function openCreateTopic() {
    if (!isAuthenticated) {
      toast.error('Sign in to create a debate topic');
      navigate('/login');
      return;
    }
    setShowCreate(true);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function submitTopic(data: CreateForumTopicRequest) {
    createTopicMutation.mutate(data);
  }

  // Get raw topics list
  const rawTopics = topicsQuery.data?.data || [];

  // Filter topics
  let processedTopics = rawTopics;
  if (activeFilter === 'popular') {
    // Popular/Hot: high activity in terms of posts or votes
    processedTopics = rawTopics.filter(
      (t) => t.postCount >= 3 || t.agreeCount + t.disagreeCount >= 5,
    );
  } else if (activeFilter === 'balanced') {
    // Controversial: close split between agree/disagree and has votes
    processedTopics = rawTopics.filter((t) => {
      const total = t.agreeCount + t.disagreeCount;
      if (total === 0) return false;
      const diff = Math.abs(t.agreeCount - t.disagreeCount);
      return diff / total <= 0.45; // difference within 45% of total votes
    });
  }

  // Sort topics
  processedTopics = [...processedTopics].sort((a, b) => {
    if (sortValue === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortValue === 'posts') {
      return b.postCount - a.postCount;
    }
    if (sortValue === 'votes') {
      return b.agreeCount + b.disagreeCount - (a.agreeCount + a.disagreeCount);
    }
    // Default: activity
    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });

  return (
    <div className="forum-page-container">
      <ForumPageHeader
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onSearchSubmit={submitSearch}
        onOpenCreate={openCreateTopic}
        sortValue={sortValue}
        onSortChange={setSortValue}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {topicsQuery.isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2 small">Loading debate topics...</p>
        </div>
      ) : topicsQuery.isError ? (
        <Alert variant="danger" className="border border-danger bg-dark text-danger">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          Could not load topics. Please check your connection and try again.
        </Alert>
      ) : (
        <Row className="g-4">
          {/* Main content list */}
          <Col lg={8} xl={9}>
            <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
              <h2 className="h5 text-white mb-0" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {activeFilter === 'all'
                  ? 'Active Debates'
                  : activeFilter === 'popular'
                    ? 'Hot Debates'
                    : 'Controversial Debates'}
              </h2>
              <span className="badge bg-dark border border-secondary text-secondary">
                {processedTopics.length} {processedTopics.length === 1 ? 'topic' : 'topics'}
              </span>
            </div>

            {processedTopics.length > 0 ? (
              <Row className="g-3">
                {processedTopics.map((topic) => (
                  <Col md={12} xl={6} key={topic._id}>
                    <ForumTopicCard topic={topic} />
                  </Col>
                ))}
              </Row>
            ) : (
              <ForumEmptyState
                title="No Debates Found"
                description={
                  search
                    ? `We couldn't find any topics matching "${search}". Try looking for other debate keywords.`
                    : 'There are no topics in this category yet. Be the pioneer and launch the first debate.'
                }
                actionButton={
                  <button
                    type="button"
                    onClick={openCreateTopic}
                    className="btn btn-outline-primary px-4"
                  >
                    Launch a Topic
                  </button>
                }
              />
            )}
          </Col>

          {/* Stats Sidebar */}
          <Col lg={4} xl={3}>
            <div className="h5 text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Stats Panel
            </div>
            <ForumStatsWidget topics={rawTopics} />
          </Col>
        </Row>
      )}

      <CreateTopicModal
        show={showCreate}
        onHide={() => setShowCreate(false)}
        onSubmit={submitTopic}
        isPending={createTopicMutation.isPending}
      />
    </div>
  );
}
