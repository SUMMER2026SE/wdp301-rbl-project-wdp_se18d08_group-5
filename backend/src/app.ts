import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
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

const app = express();

// --- Global Middleware ---
app.use(helmet());
app.use(cors({
  origin: ENV.CLIENT_URL,
  credentials: true,
}));
app.use(morgan(ENV.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api', apiLimiter);

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/matchmaking', matchmakingRoutes);
app.use('/api/v1/debate', debateRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/rankings', rankingRoutes);

// --- Error Handling ---
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
