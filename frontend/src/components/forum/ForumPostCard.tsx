import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forumService } from '@services/forumService';
import { formatRelativeTime } from '@utils/formatters';
import type { ForumPost } from '@/types';
import { ForumCommentSection } from './ForumCommentSection';

interface ForumPostCardProps {
  post: ForumPost;
  isAuthenticated: boolean;
  onRequireLogin: () => void;
  onChanged: () => void;
}

export function ForumPostCard({
  post,
  isAuthenticated,
  onRequireLogin,
  onChanged,
}: ForumPostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const isAgree = post.stance === 'agree';

  const commentsQuery = useQuery({
    queryKey: ['forum-comments', post._id],
    queryFn: async () => (await forumService.getComments(post._id)).data.data,
    enabled: showComments,
  });

  const likeMutation = useMutation({
    mutationFn: () => forumService.toggleLike(post._id),
    onSuccess: onChanged,
    onError: () => toast.error('Could not update your reaction'),
  });

  const commentMutation = useMutation({
    mutationFn: (commentText: string) => forumService.createComment(post._id, commentText),
    onSuccess: () => {
      void commentsQuery.refetch();
      onChanged();
    },
    onError: () => toast.error('Choose a side before commenting'),
  });

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!isAuthenticated) {
      onRequireLogin();
      return;
    }
    likeMutation.mutate();
  }

  function handleCommentClick(e: React.MouseEvent) {
    e.preventDefault();
    setShowComments(!showComments);
    if (!isAuthenticated) {
      onRequireLogin();
    }
  }

  function handleAddComment(content: string) {
    return commentMutation.mutateAsync(content);
  }

  return (
    <div className={`forum-post-premium mb-3 ${isAgree ? 'agree-accent' : 'disagree-accent'}`}>
      <div className="author-meta">
        <div className="author-avatar-wrapper">
          {post.author.avatar ? (
            <img className="author-img" src={post.author.avatar} alt={post.author.displayName} />
          ) : (
            <div className="author-img d-flex align-items-center justify-content-center bg-dark text-primary">
              <i className="bi bi-person-fill" />
            </div>
          )}
        </div>
        <div className="author-details">
          <Link to={`/profile/${post.author._id}`} className="author-name">
            {post.author.displayName}
          </Link>
          <span className="author-username">@{post.author.username}</span>
        </div>
        <span className="post-timestamp">{formatRelativeTime(post.createdAt)}</span>
      </div>

      <div className="opinion-body">{post.opinion}</div>

      {(post.evidenceText || post.evidenceImageUrl) && (
        <div className="evidence-container">
          <div className="evidence-header">
            <i className="bi bi-journal-bookmark-fill" /> Supporting Evidence
          </div>
          {post.evidenceText && <p className="evidence-txt">{post.evidenceText}</p>}
          {post.evidenceImageUrl && (
            <div className="evidence-media">
              <a
                href={post.evidenceImageUrl}
                target="_blank"
                rel="noreferrer"
                className="d-block text-center bg-black-20"
              >
                <img src={post.evidenceImageUrl} alt="Supplied evidence" />
              </a>
            </div>
          )}
        </div>
      )}

      <div className="post-actions-strip">
        <button
          type="button"
          className={`post-action-btn ${post.isLiked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={likeMutation.isPending}
        >
          <i className={`bi bi-heart${post.isLiked ? '-fill' : ''}`} />
          <span>{post.likeCount} Likes</span>
        </button>

        <button type="button" className="post-action-btn" onClick={handleCommentClick}>
          <i className="bi bi-chat-left-text" />
          <span>{post.commentCount} Comments</span>
        </button>
      </div>

      {showComments && (
        <ForumCommentSection
          comments={commentsQuery.data || []}
          isLoading={commentsQuery.isLoading}
          onAddComment={handleAddComment}
          isSubmitting={commentMutation.isPending}
          isAuthenticated={isAuthenticated}
          onRequireLogin={onRequireLogin}
        />
      )}
    </div>
  );
}
