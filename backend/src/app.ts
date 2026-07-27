import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ENV } from './config/env.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

// Route imports
import authRoutes from './features/auth/auth.routes.js';
import userRoutes from './features/user/user.routes.js';
import roomRoutes from './features/room/room.routes.js';
import matchmakingRoutes from './features/matchmaking/matchmaking.routes.js';
import debateRoutes from './features/debate/debate.routes.js';
import aiRoutes from './features/ai/ai.routes.js';
import rankingRoutes from './features/ranking/ranking.routes.js';
import adminRoutes from './features/admin/admin.routes.js';
import uploadRoutes from './features/upload/upload.routes.js';
import reportRoutes from './features/report/report.routes.js';
import forumRoutes from './features/forum/forum.routes.js';
import webrtcRoutes from './features/webrtc/webrtc.routes.js';

const app = express();

// --- Global Middleware ---
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(
  cors({
    origin: ENV.CLIENT_URL,
    credentials: true,
  }),
);
app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/translation', (_req, res) => {
  const configured = Boolean(ENV.GEMINI_API_KEY && ENV.GEMINI_LIVE_MODEL);
  res.status(configured ? 200 : 503).json({
    status: configured ? 'configured' : 'unavailable',
    model: ENV.GEMINI_LIVE_MODEL,
  });
});

app.get('/health/ai-judge', (_req, res) => {
  const configured = Boolean(
    ENV.GEMINI_AGENT_API_KEYS.length > 0 &&
    ENV.GEMINI_AGENT_MODEL,
  );
  res.status(configured ? 200 : 503).json({
    status: configured ? 'configured' : 'unavailable',
    model: ENV.GEMINI_AGENT_MODEL,
    configuredKeyCount: ENV.GEMINI_AGENT_API_KEYS.length,
    timeoutMs: ENV.GEMINI_AGENT_TIMEOUT_MS,
  });
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/matchmaking', matchmakingRoutes);
app.use('/api/v1/debate', debateRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/rankings', rankingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/forum', forumRoutes);
app.use('/api/v1/webrtc', webrtcRoutes);

// --- Error Handling ---
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
