import { useState } from 'react';
import { Form, Spinner } from 'react-bootstrap';
import type { ForumComment } from '@/types';
import { formatRelativeTime } from '@utils/formatters';

interface ForumCommentSectionProps {
  comments: ForumComment[];
  isLoading: boolean;
  onAddComment: (text: string) => Promise<unknown>;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
}

export function ForumCommentSection({
  comments,
  isLoading,
  onAddComment,
  isSubmitting,
  isAuthenticated,
  onRequireLogin,
}: ForumCommentSectionProps) {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    if (!commentText.trim()) return;
    try {
      await onAddComment(commentText.trim());
      setCommentText('');
    } catch {
      // Error handled by parent mutation toast
    }
  };

  return (
    <div className="comments-drawer mt-3">
      <h5 className="h6 text-uppercase letter-spacing-1 text-muted mb-3">Comments</h5>

      {isLoading ? (
        <div className="text-center py-3">
          <Spinner animation="border" size="sm" variant="primary" />
        </div>
      ) : comments.length > 0 ? (
        <div className="comments-timeline">
          {comments.map((comment) => {
            const commentStance = comment.stance;
            return (
              <div
                key={comment._id}
                className={`comment-node ${
                  commentStance === 'agree'
                    ? 'agree-left'
                    : commentStance === 'disagree'
                      ? 'disagree-left'
                      : ''
                }`}
              >
                <div className="comment-header-row">
                  <span className="comment-author-name">{comment.author.displayName}</span>
                  {commentStance && (
                    <span className={`comment-stance-pill ${commentStance}`}>
                      {commentStance === 'agree' ? 'Agree' : 'Disagree'}
                    </span>
                  )}
                  <span className="comment-time">{formatRelativeTime(comment.createdAt)}</span>
                </div>
                <div className="comment-message">{comment.content}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="small text-muted py-2 mb-3">No comments yet. Be the first to reply.</p>
      )}

      <Form onSubmit={handleSubmit} className="comment-input-area mt-2">
        <Form.Control
          type="text"
          className="comment-input"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={isAuthenticated ? 'Write a reply...' : 'Sign in to leave a reply...'}
          maxLength={1000}
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="comment-submit-btn"
          disabled={isSubmitting || !commentText.trim()}
        >
          {isSubmitting ? <Spinner animation="border" size="sm" variant="dark" /> : 'Reply'}
        </button>
      </Form>
    </div>
  );
}
