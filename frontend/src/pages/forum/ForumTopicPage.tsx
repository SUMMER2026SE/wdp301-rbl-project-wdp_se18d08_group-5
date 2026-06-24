import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Collapse, Form, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { forumService } from '@services/forumService';
import { useAuthStore } from '@stores/authStore';
import { uploadImage, validateImageFile } from '@services/uploadService';
import { formatRelativeTime } from '@utils/formatters';
import type { ForumPost, ForumStance } from '@/types';

interface PostCardProps {
  post: ForumPost;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  onChanged: () => void;
}

function PostCard({ post, isAuthenticated, onRequireLogin, onChanged }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const commentsQuery = useQuery({
    queryKey: ['forum-comments', post._id],
    queryFn: async () => (await forumService.getComments(post._id)).data.data,
    enabled: showComments,
  });
  const commentMutation = useMutation({
    mutationFn: () => forumService.createComment(post._id, comment),
    onSuccess: () => {
      setComment('');
      void commentsQuery.refetch();
      onChanged();
    },
    onError: () => toast.error('Choose a side before commenting'),
  });
  const likeMutation = useMutation({
    mutationFn: () => forumService.toggleLike(post._id),
    onSuccess: onChanged,
    onError: () => toast.error('Could not update the reaction'),
  });

  function handleLike() {
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    likeMutation.mutate();
  }

  function handleCommentClick() {
    if (!showComments) setShowComments(true);
    if (!isAuthenticated) onRequireLogin();
  }

  function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (!comment.trim()) return;
    commentMutation.mutate();
  }

  return (
    <Card className="forum-post-card mb-3">
      <Card.Body>
        <div className="d-flex align-items-center gap-2 mb-3">
          {post.author.avatar ? (
            <img className="forum-avatar" src={post.author.avatar} alt="" />
          ) : (
            <span className="forum-avatar forum-avatar-fallback"><i className="bi bi-person-fill" /></span>
          )}
          <div className="min-w-0">
            <Link to={`/profile/${post.author._id}`} className="fw-bold text-decoration-none">{post.author.displayName}</Link>
            <div className="text-muted small">@{post.author.username} · {formatRelativeTime(post.createdAt)}</div>
          </div>
        </div>
        <p className="forum-post-content">{post.opinion}</p>
        {(post.evidenceText || post.evidenceImageUrl) && (
          <section className="forum-post-evidence">
            <span className="forum-evidence-label"><i className="bi bi-journal-text me-1" />Evidence</span>
            {post.evidenceText && <p className="mb-0">{post.evidenceText}</p>}
            {post.evidenceImageUrl && (
              <a href={post.evidenceImageUrl} target="_blank" rel="noreferrer" className="d-inline-block mt-2">
                <img className="forum-evidence-image" src={post.evidenceImageUrl} alt="Evidence supplied with this post" />
              </a>
            )}
          </section>
        )}
        <div className="d-flex align-items-center gap-2 pt-2 border-top">
          <Button
            type="button"
            variant={post.isLiked ? 'primary' : 'outline-primary'}
            size="sm"
            onClick={handleLike}
            disabled={likeMutation.isPending}
          >
            <i className={`bi bi-heart${post.isLiked ? '-fill' : ''} me-1`} />
            {post.likeCount}
          </Button>
          <Button type="button" variant="outline-secondary" size="sm" onClick={handleCommentClick}>
            <i className="bi bi-chat-left-text me-1" />
            {post.commentCount}
          </Button>
        </div>

        <Collapse in={showComments}>
          <div className="forum-comments">
            {commentsQuery.isLoading ? (
              <div className="text-muted small py-2">Loading comments...</div>
            ) : commentsQuery.data?.length ? (
              <div className="mb-3">
                {commentsQuery.data.map((item) => (
                  <div className="forum-comment" key={item._id}>
                    <strong>{item.author.displayName}</strong>
                    <span className={`forum-comment-stance forum-comment-stance-${item.stance || 'unknown'}`}>
                      ({item.stance === 'agree' ? 'Agree' : item.stance === 'disagree' ? 'Disagree' : 'No side'})
                    </span>
                    <span className="text-muted small ms-2">{formatRelativeTime(item.createdAt)}</span>
                    <div>{item.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted small py-2">No comments yet.</div>
            )}
            <Form onSubmit={submitComment} className="d-flex gap-2">
              <Form.Control
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Write a comment..."
                maxLength={1000}
              />
              <Button type="submit" size="sm" disabled={commentMutation.isPending}>Send</Button>
            </Form>
          </div>
        </Collapse>
      </Card.Body>
    </Card>
  );
}

interface StanceColumnProps {
  stance: ForumStance;
  count: number;
  posts: ForumPost[];
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  onChanged: () => void;
}

function StanceColumn({ stance, count, posts, isAuthenticated, onRequireLogin, onChanged }: StanceColumnProps) {
  const isAgree = stance === 'agree';
  return (
    <Col lg={6}>
      <section className={`forum-stance-column ${isAgree ? 'forum-stance-agree' : 'forum-stance-disagree'}`}>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
          <h2 className="h5 mb-0">
            <i className={`bi ${isAgree ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-down-fill'} me-2`} />
            {isAgree ? 'Agree side' : 'Disagree side'}
          </h2>
          <Badge className={isAgree ? 'bg-proposition' : 'bg-opposition'}>{count} members</Badge>
        </div>
        {posts.length ? posts.map((post) => (
          <PostCard key={post._id} post={post} isAuthenticated={isAuthenticated} onRequireLogin={onRequireLogin} onChanged={onChanged} />
        )) : (
          <Card className="forum-empty-posts"><Card.Body className="text-muted text-center py-4">No posts from this side yet.</Card.Body></Card>
        )}
      </section>
    </Col>
  );
}

export default function ForumTopicPage() {
  const { topicId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [opinion, setOpinion] = useState('');
  const [evidenceText, setEvidenceText] = useState('');
  const [evidenceImageFile, setEvidenceImageFile] = useState<File | null>(null);
  const [evidenceImagePreview, setEvidenceImagePreview] = useState('');

  useEffect(() => () => {
    if (evidenceImagePreview) URL.revokeObjectURL(evidenceImagePreview);
  }, [evidenceImagePreview]);

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
      toast.success('Your side has been selected');
      refreshTopic();
    },
    onError: () => toast.error('Could not save your side'),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      let evidenceImageUrl = '';
      if (evidenceImageFile) {
        const uploadedImage = await uploadImage(evidenceImageFile);
        evidenceImageUrl = uploadedImage.url || '';
        if (!evidenceImageUrl) throw new Error('Image upload did not return a URL');
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
      toast.success('Post published');
      refreshTopic();
    },
    onError: () => toast.error('Could not publish your post. Check the image and try again.'),
  });

  function requireLogin() {
    toast.error('Sign in to join the discussion');
    navigate('/login');
  }

  function selectStance(stance: ForumStance) {
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

  if (topicQuery.isLoading) return <div className="text-center py-5"><Spinner animation="border" /></div>;
  if (topicQuery.isError || !topicQuery.data) return <Alert variant="danger">This topic could not be found.</Alert>;

  const { topic, userStance, posts } = topicQuery.data;
  const stanceLabel = userStance === 'agree' ? 'Agree' : 'Disagree';

  return (
    <div className="forum-topic-page py-2">
      <Link to="/forum" className="btn btn-outline-secondary btn-sm mb-3"><i className="bi bi-arrow-left me-2" />Back to forum</Link>
      <Card className="forum-topic-header mb-4">
        <Card.Body>
          <span className="forum-kicker">Debate topic</span>
          <h1 className="mt-2">{topic.title}</h1>
          {topic.description && <p className="forum-topic-description mb-3">{topic.description}</p>}
          <div className="d-flex flex-wrap gap-2">
            <Badge className="bg-proposition"><i className="bi bi-hand-thumbs-up-fill me-1" />{topic.agreeCount} Agree</Badge>
            <Badge className="bg-opposition"><i className="bi bi-hand-thumbs-down-fill me-1" />{topic.disagreeCount} Disagree</Badge>
            <Badge bg="secondary"><i className="bi bi-chat-square-text me-1" />{topic.postCount} posts</Badge>
          </div>
        </Card.Body>
      </Card>

      <Card className="forum-join-card mb-4">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <div>
              <h2 className="h5 mb-1">Choose a side before posting</h2>
              {userStance ? (
                <p className="mb-0">I am on the <strong className={userStance === 'agree' ? 'team-proposition' : 'team-opposition'}>{stanceLabel}</strong> side.</p>
              ) : (
                <p className="text-muted mb-0">Choose your position. You can change sides later.</p>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button
                variant={userStance === 'agree' ? 'primary' : 'outline-primary'}
                onClick={() => selectStance('agree')}
                disabled={stanceMutation.isPending}
              >
                <i className="bi bi-hand-thumbs-up me-2" />Agree
              </Button>
              <Button
                variant={userStance === 'disagree' ? 'danger' : 'outline-danger'}
                onClick={() => selectStance('disagree')}
                disabled={stanceMutation.isPending}
              >
                <i className="bi bi-hand-thumbs-down me-2" />Disagree
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {userStance ? (
        <Card className="forum-compose-card mb-4">
          <Card.Body>
            <Form onSubmit={submitPost}>
              <Form.Label className="fw-bold mb-3">Share the case for the {stanceLabel} side</Form.Label>
              <div className="forum-compose-grid">
                <section className="forum-compose-section forum-opinion-section">
                  <Form.Label htmlFor="forum-opinion" className="forum-compose-label">
                    <i className="bi bi-chat-quote me-2" />Opinion
                  </Form.Label>
                  <Form.Text className="d-block mb-2">State your position or argument.</Form.Text>
                  <Form.Control
                    id="forum-opinion"
                    as="textarea"
                    rows={5}
                    value={opinion}
                    onChange={(event) => setOpinion(event.target.value)}
                    placeholder="Write your opinion or rebuttal..."
                    maxLength={2000}
                    required
                  />
                  <div className="text-muted small mt-2">{opinion.length}/2000</div>
                </section>

                <section className="forum-compose-section forum-evidence-section">
                  <Form.Label htmlFor="forum-evidence" className="forum-compose-label">
                    <i className="bi bi-journal-text me-2" />Evidence
                  </Form.Label>
                  <Form.Text className="d-block mb-2">Add a source, fact, example, or an image from your device.</Form.Text>
                  <Form.Control
                    id="forum-evidence"
                    as="textarea"
                    rows={2}
                    value={evidenceText}
                    onChange={(event) => setEvidenceText(event.target.value)}
                    placeholder="Add supporting evidence (optional)..."
                    maxLength={2000}
                  />
                  <Form.Group className="mt-3">
                    <Form.Label htmlFor="forum-evidence-image" className="small fw-bold">Evidence image <span className="text-muted">(optional)</span></Form.Label>
                    <Form.Control
                      id="forum-evidence-image"
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleEvidenceImageChange}
                      disabled={postMutation.isPending}
                    />
                    <Form.Text>JPG, PNG, GIF, or WebP — up to 5 MB. The image uploads when you publish.</Form.Text>
                  </Form.Group>
                  {evidenceImagePreview && (
                    <div className="forum-evidence-preview">
                      <img src={evidenceImagePreview} alt="Selected evidence preview" />
                      <Button type="button" size="sm" variant="outline-danger" onClick={clearEvidenceImage} disabled={postMutation.isPending}>
                        <i className="bi bi-x-lg me-1" />Remove image
                      </Button>
                    </div>
                  )}
                </section>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2 gap-3">
                <span className="text-muted small">Evidence is optional, but it makes your argument stronger.</span>
                <Button type="submit" disabled={postMutation.isPending || !opinion.trim()}>
                  <i className="bi bi-send me-2" />{postMutation.isPending ? (evidenceImageFile ? 'Uploading image...' : 'Publishing...') : 'Publish post'}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="info" className="mb-4"><i className="bi bi-info-circle me-2" />Choose a side before you can publish a post.</Alert>
      )}

      <Row className="g-4">
        <StanceColumn stance="agree" count={topic.agreeCount} posts={posts.agree} isAuthenticated={isAuthenticated} onRequireLogin={requireLogin} onChanged={refreshTopic} />
        <StanceColumn stance="disagree" count={topic.disagreeCount} posts={posts.disagree} isAuthenticated={isAuthenticated} onRequireLogin={requireLogin} onChanged={refreshTopic} />
      </Row>
    </div>
  );
}
