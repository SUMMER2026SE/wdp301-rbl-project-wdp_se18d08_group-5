import api from './api';
import type {
  ApiResponse,
  CreateForumPostRequest,
  CreateForumTopicRequest,
  ForumComment,
  ForumPost,
  ForumStance,
  ForumTopic,
  ForumTopicDetail,
  PaginatedResponse,
} from '@/types';

export const forumService = {
  getTopics(params?: { page?: number; limit?: number; search?: string }) {
    return api.get<PaginatedResponse<ForumTopic>>('/forum/topics', { params });
  },

  getTopic(topicId: string) {
    return api.get<ApiResponse<ForumTopicDetail>>(`/forum/topics/${topicId}`);
  },

  createTopic(data: CreateForumTopicRequest) {
    return api.post<ApiResponse<ForumTopic>>('/forum/topics', data);
  },

  selectStance(topicId: string, stance: ForumStance) {
    return api.put<ApiResponse<{ stance: ForumStance; agreeCount: number; disagreeCount: number }>>(
      `/forum/topics/${topicId}/stance`,
      { stance },
    );
  },

  createPost(topicId: string, data: CreateForumPostRequest) {
    return api.post<ApiResponse<ForumPost>>(`/forum/topics/${topicId}/posts`, data);
  },

  toggleLike(postId: string) {
    return api.post<ApiResponse<{ postId: string; isLiked: boolean; likeCount: number }>>(`/forum/posts/${postId}/like`);
  },

  getComments(postId: string) {
    return api.get<ApiResponse<ForumComment[]>>(`/forum/posts/${postId}/comments`);
  },

  createComment(postId: string, content: string) {
    return api.post<ApiResponse<ForumComment>>(`/forum/posts/${postId}/comments`, { content });
  },
};
