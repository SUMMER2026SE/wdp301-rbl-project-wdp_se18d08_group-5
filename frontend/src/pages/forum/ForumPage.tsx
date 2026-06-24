import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { forumService } from '@services/forumService';
import { useAuthStore } from '@stores/authStore';
import { formatRelativeTime } from '@utils/formatters';
import type { CreateForumTopicRequest, ForumTopic } from '@/types';

function TopicCard({ topic }: { topic: ForumTopic }) {
  return (
    <Card as={Link} to={`/forum/${topic._id}`} className="forum-topic-card h-100 text-decoration-none">
      <Card.Body>
        <div className="d-flex align-items-start justify-content-between gap-3">
          <div className="min-w-0">
            <h4 className="mb-2">{topic.title}</h4>
            {topic.description && <p className="forum-topic-description mb-3">{topic.description}</p>}
          </div>
          <i className="bi bi-chevron-right forum-topic-arrow" aria-hidden="true" />
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2 small">
          <Badge className="bg-proposition">
            <i className="bi bi-hand-thumbs-up-fill me-1" />
            {topic.agreeCount} Agree
          </Badge>
          <Badge className="bg-opposition">
            <i className="bi bi-hand-thumbs-down-fill me-1" />
            {topic.disagreeCount} Disagree
          </Badge>
          <Badge bg="secondary">
            <i className="bi bi-chat-square-text me-1" />
            {topic.postCount} posts
          </Badge>
          <span className="text-muted ms-sm-auto">Active {formatRelativeTime(topic.lastActivityAt)}</span>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function ForumPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForumTopicRequest>({ title: '', description: '' });

  const topicsQuery = useQuery({
    queryKey: ['forum-topics', search],
    queryFn: async () => (await forumService.getTopics({ limit: 30, search: search || undefined })).data,
  });

  const createTopicMutation = useMutation({
    mutationFn: (data: CreateForumTopicRequest) => forumService.createTopic(data),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success('Topic created');
      setShowCreate(false);
      setForm({ title: '', description: '' });
      navigate(`/forum/${response.data.data._id}`);
    },
    onError: () => toast.error('Could not create topic. The title needs at least 8 characters.'),
  });

  function openCreateTopic() {
    if (!isAuthenticated) {
      toast.error('Sign in to create a topic');
      navigate('/login');
      return;
    }
    setShowCreate(true);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function submitTopic(event: FormEvent) {
    event.preventDefault();
    createTopicMutation.mutate(form);
  }

  return (
    <div className="forum-page py-2">
      <section className="forum-hero mb-4">
        <div>
          <span className="forum-kicker">Debate community</span>
          <h1>Forum</h1>
          <p className="mb-0">Start a topic, choose a side, and defend your view with thoughtful arguments.</p>
        </div>
        <Button onClick={openCreateTopic} className="forum-create-button">
          <i className="bi bi-plus-lg me-2" />
          Create topic
        </Button>
      </section>

      <Card className="mb-4">
        <Card.Body>
          <Form onSubmit={submitSearch} className="d-flex gap-2">
            <Form.Control
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search topics..."
              aria-label="Search topics"
            />
            <Button type="submit" variant="outline-primary">
              <i className="bi bi-search me-sm-2" />
              <span className="d-none d-sm-inline">Search</span>
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
        <h2 className="h4 mb-0">Active topics</h2>
        {topicsQuery.data && <span className="text-muted small">{topicsQuery.data.pagination.total} topics</span>}
      </div>

      {topicsQuery.isLoading ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : topicsQuery.isError ? (
        <Alert variant="danger">Could not load topics. Please try again.</Alert>
      ) : topicsQuery.data?.data.length ? (
        <Row className="g-3">
          {topicsQuery.data.data.map((topic) => (
            <Col lg={6} key={topic._id}><TopicCard topic={topic} /></Col>
          ))}
        </Row>
      ) : (
        <Card><Card.Body className="text-center py-5 text-muted">No topics found. Start the next great debate.</Card.Body></Card>
      )}

      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Form onSubmit={submitTopic}>
          <Modal.Header closeButton><Modal.Title>Create a debate topic</Modal.Title></Modal.Header>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Topic title</Form.Label>
              <Form.Control
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                minLength={8}
                maxLength={200}
                placeholder="Example: AI will replace programmers in the future"
                required
                autoFocus
              />
              <Form.Text>At least 8 characters.</Form.Text>
            </Form.Group>
            <Form.Group>
              <Form.Label>Short description <span className="text-muted">(optional)</span></Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                maxLength={1000}
                value={form.description || ''}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Add context or a question for the community to discuss..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={createTopicMutation.isPending}>
              {createTopicMutation.isPending ? 'Creating...' : 'Create topic'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
