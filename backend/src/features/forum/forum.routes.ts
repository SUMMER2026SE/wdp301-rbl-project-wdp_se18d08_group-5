import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendPaginated, sendSuccess } from '../../utils/response.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/AppError.js';
import { ForumComment } from '../../models/ForumComment.js';
import { ForumPost } from '../../models/ForumPost.js';
import { ForumStance } from '../../models/ForumStance.js';
import { ForumTopic } from '../../models/ForumTopic.js';
import type { IForumPost } from '../../models/ForumPost.js';
import type { AuthRequest } from '../../types/index.js';
import {
  createForumCommentSchema,
  createForumPostSchema,
  createForumTopicSchema,
  setForumStanceSchema,
} from './forum.schema.js';

const router = Router();

type PublicAuthor = {
  _id?: Types.ObjectId;
  username?: string;
  profile?: { displayName?: string; avatar?: string };
};

function getPage(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : fallback;
}

function getLimit(value: unknown, fallback = 12, max = 50) {
  const parsed = Number.parseInt(String(value || fallback), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), max) : fallback;
}

function requireObjectId(value: string, resourceName: string) {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestError(`Invalid ${resourceName} id`);
  }
  return new Types.ObjectId(value);
}

function authorSummary(author: PublicAuthor | Types.ObjectId | null | undefined) {
  if (!author || author instanceof Types.ObjectId) {
    return { _id: author?.toString() || '', username: 'Unknown user', displayName: '', avatar: '' };
  }

  return {
    _id: author._id?.toString() || '',
    username: author.username || 'Unknown user',
    displayName: author.profile?.displayName || author.username || 'Unknown user',
    avatar: author.profile?.avatar || '',
  };
}

function referencedId(value: unknown) {
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id: unknown })._id);
  }
  return value ? String(value) : '';
}

function serializePost(post: IForumPost & { author?: PublicAuthor | Types.ObjectId }, currentUserId?: string) {
  const likedBy = post.likeUserIds || [];
  return {
    _id: post._id.toString(),
    topic: post.topic.toString(),
    stance: post.stance,
    opinion: post.opinion || post.content,
    evidenceText: post.evidenceText || '',
    evidenceImageUrl: post.evidenceImageUrl || '',
    author: authorSummary(post.author),
    likeCount: likedBy.length,
    isLiked: Boolean(currentUserId && likedBy.some((id) => id.toString() === currentUserId)),
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

async function getTopicOrThrow(topicId: string) {
  const topic = await ForumTopic.findById(requireObjectId(topicId, 'topic'));
  if (!topic) throw new NotFoundError('Topic not found');
  return topic;
}

// GET /api/v1/forum/topics — Public forum topic list
router.get(
  '/topics',
  asyncHandler(async (req: Request, res: Response) => {
    const page = getPage(req.query.page);
    const limit = getLimit(req.query.limit);
    const skip = (page - 1) * limit;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const filter = search ? { title: { $regex: search, $options: 'i' } } : {};

    const [topics, total] = await Promise.all([
      ForumTopic.find(filter)
        .populate('createdBy', 'username profile.displayName profile.avatar')
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ForumTopic.countDocuments(filter),
    ]);

    const data = topics.map((topic) => ({
      _id: topic._id.toString(),
      title: topic.title,
      description: topic.description,
      createdBy: authorSummary(topic.createdBy as unknown as PublicAuthor),
      agreeCount: topic.agreeCount,
      disagreeCount: topic.disagreeCount,
      postCount: topic.postCount,
      lastActivityAt: topic.lastActivityAt,
      createdAt: topic.createdAt,
    }));

    sendPaginated(res, data, { page, limit, total });
  }),
);

// GET /api/v1/forum/topics/:topicId — Topic, selected stance and posts grouped by side
router.get(
  '/topics/:topicId',
  optionalAuthenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const topic = await getTopicOrThrow(req.params.topicId);
    const topicId = topic._id as Types.ObjectId;
    const currentUserId = req.user?.userId;

    const [userStance, agreePosts, disagreePosts] = await Promise.all([
      currentUserId ? ForumStance.findOne({ topic: topicId, user: currentUserId }).select('stance') : null,
      ForumPost.find({ topic: topicId, stance: 'agree' })
        .populate('author', 'username profile.displayName profile.avatar')
        .sort({ createdAt: -1 })
        .limit(100),
      ForumPost.find({ topic: topicId, stance: 'disagree' })
        .populate('author', 'username profile.displayName profile.avatar')
        .sort({ createdAt: -1 })
        .limit(100),
    ]);

    sendSuccess(res, {
      topic: {
        _id: topic._id.toString(),
        title: topic.title,
        description: topic.description,
        createdBy: authorSummary(topic.createdBy as unknown as PublicAuthor),
        agreeCount: topic.agreeCount,
        disagreeCount: topic.disagreeCount,
        postCount: topic.postCount,
        lastActivityAt: topic.lastActivityAt,
        createdAt: topic.createdAt,
      },
      userStance: userStance?.stance || null,
      posts: {
        agree: agreePosts.map((post) => serializePost(post as IForumPost & { author?: PublicAuthor }, currentUserId)),
        disagree: disagreePosts.map((post) => serializePost(post as IForumPost & { author?: PublicAuthor }, currentUserId)),
      },
    });
  }),
);

// POST /api/v1/forum/topics — Every signed-in member can start a topic
router.post(
  '/topics',
  authenticate,
  validate(createForumTopicSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const topic = await ForumTopic.create({
      title: req.body.title,
      description: req.body.description,
      createdBy: req.user!.userId,
    });

    sendSuccess(res, topic, 'Topic created', 201);
  }),
);

// PUT /api/v1/forum/topics/:topicId/stance — Select or change a side
router.put(
  '/topics/:topicId/stance',
  authenticate,
  validate(setForumStanceSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const topic = await getTopicOrThrow(req.params.topicId);
    const topicId = topic._id as Types.ObjectId;
    const userId = req.user!.userId;
    const previous = await ForumStance.findOne({ topic: topicId, user: userId });

    if (!previous) {
      await ForumStance.create({ topic: topicId, user: userId, stance: req.body.stance });
      await ForumTopic.findByIdAndUpdate(topicId, {
        $inc: { [req.body.stance === 'agree' ? 'agreeCount' : 'disagreeCount']: 1 },
        $set: { lastActivityAt: new Date() },
      });
    } else if (previous.stance !== req.body.stance) {
      const decrementField = previous.stance === 'agree' ? 'agreeCount' : 'disagreeCount';
      const incrementField = req.body.stance === 'agree' ? 'agreeCount' : 'disagreeCount';
      previous.stance = req.body.stance;
      await previous.save();
      await ForumTopic.findByIdAndUpdate(topicId, {
        $inc: { [decrementField]: -1, [incrementField]: 1 },
        $set: { lastActivityAt: new Date() },
      });
    }

    const updatedTopic = await ForumTopic.findById(topicId).select('agreeCount disagreeCount');
    sendSuccess(res, {
      stance: req.body.stance,
      agreeCount: updatedTopic?.agreeCount || 0,
      disagreeCount: updatedTopic?.disagreeCount || 0,
    }, 'Your side has been saved');
  }),
);

// POST /api/v1/forum/topics/:topicId/posts — A stance must be selected first
router.post(
  '/topics/:topicId/posts',
  authenticate,
  validate(createForumPostSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const topic = await getTopicOrThrow(req.params.topicId);
    const topicId = topic._id as Types.ObjectId;
    const stance = await ForumStance.findOne({ topic: topicId, user: req.user!.userId }).select('stance');
    if (!stance) {
      throw new ForbiddenError('Choose Agree or Disagree before creating a post');
    }

    const post = await ForumPost.create({
      topic: topicId,
      author: req.user!.userId,
      stance: stance.stance,
      // Keep content populated for posts created before the two-part format.
      content: req.body.opinion,
      opinion: req.body.opinion,
      evidenceText: req.body.evidenceText,
      evidenceImageUrl: req.body.evidenceImageUrl,
    });
    await ForumTopic.findByIdAndUpdate(topicId, {
      $inc: { postCount: 1 },
      $set: { lastActivityAt: new Date() },
    });
    await post.populate('author', 'username profile.displayName profile.avatar');

    sendSuccess(res, serializePost(post as IForumPost & { author?: PublicAuthor }, req.user!.userId), 'Post published', 201);
  }),
);

// POST /api/v1/forum/posts/:postId/like — Toggle a like
router.post(
  '/posts/:postId/like',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const postId = requireObjectId(req.params.postId, 'post');
    const post = await ForumPost.findById(postId);
    if (!post) throw new NotFoundError('Post not found');

    const userId = new Types.ObjectId(req.user!.userId);
    const isLiked = post.likeUserIds.some((id) => id.equals(userId));
    if (isLiked) {
      post.likeUserIds = post.likeUserIds.filter((id) => !id.equals(userId));
    } else {
      post.likeUserIds.push(userId);
    }
    await post.save();

    sendSuccess(res, { postId: post._id.toString(), isLiked: !isLiked, likeCount: post.likeUserIds.length });
  }),
);

// GET /api/v1/forum/posts/:postId/comments — Read a post discussion
router.get(
  '/posts/:postId/comments',
  asyncHandler(async (req: Request, res: Response) => {
    const postId = requireObjectId(req.params.postId, 'post');
    const post = await ForumPost.findById(postId).select('_id');
    if (!post) throw new NotFoundError('Post not found');

    const comments = await ForumComment.find({ post: postId })
      .populate('author', 'username profile.displayName profile.avatar')
      .sort({ createdAt: 1 })
      .limit(100);

    // Comments created before stance tracking are resolved from the author's
    // current selection, so older discussion remains understandable too.
    const legacyAuthorIds = comments
      .filter((comment) => !comment.stance)
      .map((comment) => referencedId(comment.author));
    const legacyStances = legacyAuthorIds.length
      ? await ForumStance.find({ topic: post.topic, user: { $in: legacyAuthorIds } }).select('user stance')
      : [];
    const legacyStanceByUser = new Map(legacyStances.map((entry) => [entry.user.toString(), entry.stance]));

    sendSuccess(res, comments.map((comment) => ({
      _id: comment._id.toString(),
      content: comment.content,
      author: authorSummary(comment.author as unknown as PublicAuthor),
      stance: comment.stance || legacyStanceByUser.get(referencedId(comment.author)) || null,
      createdAt: comment.createdAt,
    })));
  }),
);

// POST /api/v1/forum/posts/:postId/comments — Add a comment to a forum post
router.post(
  '/posts/:postId/comments',
  authenticate,
  validate(createForumCommentSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const postId = requireObjectId(req.params.postId, 'post');
    const post = await ForumPost.findById(postId);
    if (!post) throw new NotFoundError('Post not found');

    const stance = await ForumStance.findOne({ topic: post.topic, user: req.user!.userId }).select('stance');
    if (!stance) {
      throw new ForbiddenError('Choose Agree or Disagree before commenting');
    }

    const comment = await ForumComment.create({
      post: postId,
      author: req.user!.userId,
      stance: stance.stance,
      content: req.body.content,
    });
    post.commentCount += 1;
    await post.save();
    await ForumTopic.findByIdAndUpdate(post.topic, { $set: { lastActivityAt: new Date() } });
    await comment.populate('author', 'username profile.displayName profile.avatar');

    sendSuccess(res, {
      _id: comment._id.toString(),
      content: comment.content,
      author: authorSummary(comment.author as unknown as PublicAuthor),
      stance: comment.stance,
      createdAt: comment.createdAt,
    }, 'Comment published', 201);
  }),
);

export default router;
