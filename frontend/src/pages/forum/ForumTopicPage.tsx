import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { forumService } from '@services/forumService';
import { useAuthStore } from '@stores/authStore';
import { uploadImage, validateImageFile } from '@services/uploadService';
import type { ForumStance } from '@/types';

// Import custom components
import { ForumStancePoll } from '../../components/forum/ForumStancePoll';
import { StanceToggle } from '../../components/forum/StanceToggle';
import { ForumPostCard } from '../../components/forum/ForumPostCard';

// Import CSS
import '../../styles/forum.css';

export default function ForumTopicPage() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [opinion, setOpinion] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceImageFile, setEvidenceImageFile] = useState<File | null>(null);
  const [evidenceImagePreview, setEvidenceImagePreview] = useState('');

  useEffect(
    () => () => {
      if (evidenceImagePreview) URL.revokeObjectURL(evidenceImagePreview);
    },
    [evidenceImagePreview],
  );

  const topicQuery = useQuery({
    queryKey: ['forum-topic', topicId],
    queryFn: async () => (await forumService.getTopic(topicId)).data.data,
    enabled: Boolean(topicId),
  });

  const refreshTopic = () => {
    void queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] });
    void queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
  };

  const stanceMutation = useMutation({
    mutationFn: (stance: ForumStance) => forumService.selectStance(topicId, stance),
    onSuccess: () => {
      toast.success('Your stance has been recorded');
      refreshTopic();
    },
    onError: () => toast.error('Could not record your stance'),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      let evidenceImageUrl = '';
      if (evidenceImageFile) {
        const uploadedImage = await uploadImage(evidenceImageFile);
        evidenceImageUrl = uploadedImage.url || '';
        if (!evidenceImageUrl) throw new Error('Image upload failed');
      }

      return forumService.createPost(topicId, {
        opinion: opinion.trim(),
        evidenceText: evidenceText.trim(),
        evidenceImageUrl,
      });
    },
    onSuccess: () => {
      setOpinion('');
      setEvidenceText('');
      clearEvidenceImage();
      toast.success('Post published successfully');
      refreshTopic();
    },
    onError: () => toast.error('Could not publish post. Check the file format and size.'),
  });

  function requireLogin() {
    toast.error('Sign in to participate in the debate');
    navigate('/login');
  }

  function handleSelectStance(stance: ForumStance) {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }
    stanceMutation.mutate(stance);
  }

  function submitPost(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      requireLogin();
      return;
    }
    if (!opinion.trim()) return;
    postMutation.mutate();
  }

  function handleEvidenceImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || 'This image cannot be uploaded');
      event.target.value = '';
      return;
    }

    setEvidenceImageFile(file);
    setEvidenceImagePreview(URL.createObjectURL(file));
  }

  function clearEvidenceImage() {
    setEvidenceImageFile(null);
    setEvidenceImagePreview('');
  }

  if (topicQuery.isLoading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="text-muted mt-2 small">Loading debate details...</p>
      </div>
    );
  }

  if (topicQuery.isError || !topicQuery.data) {
    return (
      <div className="forum-page-container">
        <Alert variant="danger" className="border border-danger bg-dark text-danger">
          <i className="bi bi-exclamation-octagon-fill me-2" />
          The requested debate topic could not be found.
        </Alert>
        <Link to="/forum" className="btn btn-outline-secondary btn-sm">
          <i className="bi bi-arrow-left me-2" /> Back to Forums
        </Link>
      </div>
    );
  }

  const { topic, userStance, posts } = topicQuery.data;
  const isAgreeStance = userStance === 'agree';

  return (
    <div className="forum-page-container">
      {/* Back Button */}
      <Link to="/forum" className="btn btn-outline-secondary btn-sm mb-3">
        <i className="bi bi-arrow-left me-2" /> Back to Forums
      </Link>

      {/* Glass Header Card */}
      <Card className="topic-header-card mb-4 border border-secondary text-white">
        <Card.Body className="p-0">
          <div className="forum-hero-badge">
            <i className="bi bi-chat-quote-fill" /> Topic Detail
          </div>
          <h1 className="mt-2 text-white h3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            {topic.title}
          </h1>
          {topic.description && <p className="forum-topic-desc mt-2 mb-0">{topic.description}</p>}

          {/* Stance breakdown visual */}
          <ForumStancePoll
            agreeCount={topic.agreeCount}
            disagreeCount={topic.disagreeCount}
            userStance={userStance}
          />
        </Card.Body>
      </Card>

      {/* Choice Selector */}
      <StanceToggle
        userStance={userStance}
        onSelectStance={handleSelectStance}
        isPending={stanceMutation.isPending}
      />

      {/* Post Composing Panel */}
      {userStance ? (
        <Card className={`compose-card-premium mb-4 ${!isAgreeStance ? 'disagree-form' : ''}`}>
          <Card.Body className="p-0">
            <Form onSubmit={submitPost}>
              <h3
                className="h6 text-uppercase fw-bold mb-3 text-white"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Present Your Case ({isAgreeStance ? 'Proposition' : 'Opposition'} Side)
              </h3>

              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label htmlFor="forum-opinion" className="compose-label">
                      <i className="bi bi-chat-right-quote-fill text-primary" /> Opinion
                    </Form.Label>
                    <Form.Control
                      id="forum-opinion"
                      as="textarea"
                      rows={5}
                      value={opinion}
                      onChange={(event) => setOpinion(event.target.value)}
                      placeholder="Explain your stance with reasoned arguments..."
                      maxLength={2000}
                      required
                      className="compose-text-area"
                    />
                    <div className="text-end small text-muted mt-1">{opinion.length}/2000</div>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label htmlFor="forum-evidence" className="compose-label">
                      <i className="bi bi-file-earmark-text-fill text-secondary" /> Evidence Text
                    </Form.Label>
                    <Form.Control
                      id="forum-evidence"
                      as="textarea"
                      rows={2}
                      value={evidenceText}
                      onChange={(event) => setEvidenceText(event.target.value)}
                      placeholder="Add research papers, citations, or references (optional)..."
                      maxLength={2000}
                      className="compose-text-area"
                    />
                  </Form.Group>

                  <Form.Group>
                    <Form.Label htmlFor="forum-evidence-image" className="compose-label">
                      <i className="bi bi-image text-info" /> Supporting Image
                    </Form.Label>
                    <Form.Control
                      id="forum-evidence-image"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleEvidenceImageChange}
                      disabled={postMutation.isPending}
                      className="form-control bg-dark border-secondary text-white"
                      style={{ fontSize: '0.85rem' }}
                    />
                    <Form.Text className="text-muted small">
                      Supports JPG, PNG, GIF, WebP (Max 5MB).
                    </Form.Text>
                  </Form.Group>

                  {evidenceImagePreview && (
                    <div className="compose-image-preview-box">
                      <img src={evidenceImagePreview} alt="Preview of uploaded evidence" />
                      <button
                        type="button"
                        className="compose-image-remove-overlay"
                        onClick={clearEvidenceImage}
                        disabled={postMutation.isPending}
                      >
                        <i className="bi bi-x-circle-fill me-1" /> Remove
                      </button>
                    </div>
                  )}
                </Col>
              </Row>

              <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top border-secondary">
                <span className="small text-muted d-none d-sm-inline">
                  Provide evidence to make your argument more convincing.
                </span>
                <Button
                  type="submit"
                  disabled={postMutation.isPending || !opinion.trim()}
                  className="px-4 text-black fw-bold"
                  style={{
                    background: isAgreeStance
                      ? 'var(--color-proposition)'
                      : 'var(--color-opposition)',
                    boxShadow: isAgreeStance
                      ? '0 0 10px rgba(0, 245, 255, 0.3)'
                      : '0 0 10px rgba(255, 0, 110, 0.3)',
                    border: 'none',
                    fontFamily: 'Orbitron, sans-serif',
                  }}
                >
                  {postMutation.isPending ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill me-2" /> Publish Opinion
                    </>
                  )}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="info" className="mb-4 bg-dark border-info text-info">
          <i className="bi bi-info-circle-fill me-2" />
          Please select either the <strong>Agree</strong> or <strong>Disagree</strong> side above to
          start posting.
        </Alert>
      )}

      {/* Battleground Side-by-Side Opinion Columns */}
      <Row className="g-4">
        {/* Agree side */}
        <Col lg={6}>
          <div className="battleground-column agree-side">
            <div className="column-header agree-text">
              <span>
                <i className="bi bi-shield-fill-check me-2" /> Proposition Side
              </span>
              <span className="badge bg-dark text-proposition border border-info">
                {topic.agreeCount} members
              </span>
            </div>

            {posts.agree.length > 0 ? (
              posts.agree.map((post) => (
                <ForumPostCard
                  key={post._id}
                  post={post}
                  isAuthenticated={isAuthenticated}
                  onRequireLogin={requireLogin}
                  onChanged={refreshTopic}
                />
              ))
            ) : (
              <p className="small text-muted text-center py-5">
                No arguments posted by the Proposition side yet.
              </p>
            )}
          </div>
        </Col>

        {/* Disagree side */}
        <Col lg={6}>
          <div className="battleground-column disagree-side">
            <div className="column-header disagree-text">
              <span>
                <i className="bi bi-shield-fill-x me-2" /> Opposition Side
              </span>
              <span className="badge bg-dark text-opposition border border-danger">
                {topic.disagreeCount} members
              </span>
            </div>

            {posts.disagree.length > 0 ? (
              posts.disagree.map((post) => (
                <ForumPostCard
                  key={post._id}
                  post={post}
                  isAuthenticated={isAuthenticated}
                  onRequireLogin={requireLogin}
                  onChanged={refreshTopic}
                />
              ))
            ) : (
              <p className="small text-muted text-center py-5">
                No arguments posted by the Opposition side yet.
              </p>
            )}
          </div>
        </Col>
      </Row>
    </div>
  );
}
