# 14 — Implementation Guide

**Phiên bản:** v1.1 | **Ngày:** 25/05/2026
**Loại tài liệu:** Hướng dẫn kỹ thuật — cách implement các tính năng MVP
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [13_Todo_List_MVP.md](./13_Todo_List_MVP.md) · [12_API_Endpoints_MVP.md](./12_API_Endpoints_MVP.md)

---

## 1. THỨ TỰ IMPLEMENT (CRITICAL PATH)

Dependency chain — làm đúng thứ tự:

```
Auth (Dev 1)
  ↓  middleware verifyToken dùng cho mọi feature
Room schema + CRUD (Dev 2)
  ↓  models dùng cho tất cả
Matchmaking (Dev 2)
  ↓  queue → socket match:found
Socket setup (Dev 3)
  ↓  realtime cho debate
Debate Engine (Dev 2)
  ↓  orchestration + timer
AI Integration (Dev 4)
  ↓  speech analysis + BGK
Live + Replay + Polish (Dev 5)
```

---

## 2. AUTH — IMPLEMENTATION

### 2.1 Access Token Flow

```
Login → server trả { accessToken } + httpOnly refreshToken cookie
Frontend → gửi accessToken trong Authorization: Bearer <token>
Hết hạn (401) → gọi /auth/refresh-token → lưu token mới
Refresh thất bại → redirect /login
```

### 2.2 Auth Store Pattern (Zustand)

```typescript
// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  userId: string;
  username: string;
  email: string;
  profile: { displayName: string; avatar: string; bio: string };
  ranking: { elo: number; tier: string };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, accessToken: token, isAuthenticated: true }),
      setToken: (token) => set({ accessToken: token }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    { name: 'auth', partialize: (s) => ({ accessToken: s.accessToken }) }
  )
);
```

### 2.3 Axios Interceptor with Refresh

```typescript
// frontend/src/services/api.ts
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        useAuthStore.getState().setToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 3. MODELS — IMPLEMENTATION

### 3.1 DebateRoom Model

```typescript
// backend/src/models/DebateRoom.ts
import mongoose, { Schema, type Document } from 'mongoose';

export interface IParticipant {
  userId: mongoose.Types.ObjectId;
  username: string;
  roomRole: 'debater' | 'host' | 'judge' | 'viewer' | 'owner';
  team: 'proposition' | 'opposition' | null;
  speakerSlot: 'S1' | 'S2' | 'S3' | null;
  positionLocked: boolean;
}

export interface IRoom extends Document {
  roomType: 'rank' | 'custom';
  title: string;
  motion: string | null;
  status: 'waiting' | 'ready' | 'active' | 'paused' | 'completed' | 'cancelled';
  format: '1v1' | '3v3';
  isPrivate: boolean;
  password: string | null;
  createdBy: mongoose.Types.ObjectId;
  hostType: 'human' | 'ai';
  hostId: mongoose.Types.ObjectId | null;
  judgeType: 'human' | 'ai';
  judgeCount: number;
  participants: IParticipant[];
  currentPhase: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  matchId: mongoose.Types.ObjectId | null;
}

const participantSchema = new Schema<IParticipant>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  roomRole: { type: String, enum: ['debater', 'host', 'judge', 'viewer', 'owner'], default: 'viewer' },
  team: { type: String, enum: ['proposition', 'opposition', null], default: null },
  speakerSlot: { type: String, enum: ['S1', 'S2', 'S3', null], default: null },
  positionLocked: { type: Boolean, default: false },
});

const debateRoomSchema = new Schema<IRoom>({
  roomType: { type: String, enum: ['rank', 'custom'], required: true },
  title: { type: String, required: true },
  motion: { type: String, default: null },
  status: { type: String, enum: ['waiting', 'ready', 'active', 'paused', 'completed', 'cancelled'], default: 'waiting' },
  format: { type: String, enum: ['1v1', '3v3'], required: true },
  isPrivate: { type: Boolean, default: false },
  password: { type: String, default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  hostType: { type: String, enum: ['human', 'ai'], default: 'ai' },
  hostId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  judgeType: { type: String, enum: ['human', 'ai'], default: 'ai' },
  judgeCount: { type: Number, default: 1 },
  participants: [participantSchema],
  currentPhase: { type: String, default: null },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  matchId: { type: Schema.Types.ObjectId, default: null },
}, { timestamps: true });

debateRoomSchema.index({ status: 1, roomType: 1 });
debateRoomSchema.index({ 'participants.userId': 1 });

export const DebateRoom = mongoose.model<IRoom>('DebateRoom', debateRoomSchema);
```

### 3.2 DebateSession Model

```typescript
// backend/src/models/DebateSession.ts
import mongoose, { Schema, type Document } from 'mongoose';

export interface ICurrentTurn {
  speaker: string;
  phase: 'speech' | 'cross_exam' | 'judge_feedback' | 'prep_1';
  startTime: Date;
  timeLimit: number;
  timeRemaining: number;
  status: 'active' | 'paused' | 'completed';
}

export interface IAICAnalysis {
  score: {
    logic: number; rebuttal: number; evidence: number;
    crossExam: number; strategy: number; communication: number; overall: number;
  };
  strengths: string[];
  weaknesses: string[];
  fallacies: { type: string; description: string }[];
  summary: string;
}

export interface ICrossExam {
  questionsAsked: number;
  questionsAnswered: number;
  timeRemainingPro: number;
  timeRemainingOpp: number;
  transcript: { team: string; type: 'question' | 'answer'; content: string; timestamp: Date }[];
}

export interface ITurnHistory {
  speaker: string;
  team: 'proposition' | 'opposition';
  startTime: Date;
  endTime: Date;
  duration: number;
  transcript: string;
  crossExamination: ICrossExam | null;
  aiAnalysis: IAICAnalysis | null;
}

export interface ISession extends Document {
  roomId: mongoose.Types.ObjectId;
  currentTurn: ICurrentTurn | null;
  turnHistory: ITurnHistory[];
  cards: { type: 'yellow' | 'red'; issuedTo: mongoose.Types.ObjectId; reason: string; timestamp: Date }[];
  finalScores: {
    teamProposition: { total: number; breakdown: Record<string, number> };
    teamOpposition: { total: number; breakdown: Record<string, number> };
    winner: 'proposition' | 'opposition' | 'draw' | null;
    aiVerdict: string | null;
  } | null;
  aiSummary: string | null;
  createdAt: Date;
}

const crossExamSchema = new Schema<ICrossExam>({
  questionsAsked: { type: Number, default: 0 },
  questionsAnswered: { type: Number, default: 0 },
  timeRemainingPro: { type: Number, default: 180 },
  timeRemainingOpp: { type: Number, default: 180 },
  transcript: [{ team: String, type: String, content: String, timestamp: Date }],
}, { _id: false });

const aiAnalysisSchema = new Schema<IAICAnalysis>({
  score: {
    logic: Number, rebuttal: Number, evidence: Number,
    crossExam: Number, strategy: Number, communication: Number, overall: Number,
  },
  strengths: [String], weaknesses: [String],
  fallacies: [{ type: String, description: String }],
  summary: String,
}, { _id: false });

const turnHistorySchema = new Schema<ITurnHistory>({
  speaker: String,
  team: String,
  startTime: Date, endTime: Date, duration: Number,
  transcript: String,
  crossExamination: crossExamSchema,
  aiAnalysis: aiAnalysisSchema,
}, { _id: false });

const sessionSchema = new Schema<ISession>({
  roomId: { type: Schema.Types.ObjectId, ref: 'DebateRoom', required: true, unique: true },
  currentTurn: {
    speaker: String, phase: String, startTime: Date,
    timeLimit: Number, timeRemaining: Number, status: String,
  },
  turnHistory: [turnHistorySchema],
  cards: [{ type: String, issuedTo: Schema.Types.ObjectId, reason: String, timestamp: Date }],
  finalScores: {
    teamProposition: { total: Number, breakdown: Schema.Types.Mixed },
    teamOpposition: { total: Number, breakdown: Schema.Types.Mixed },
    winner: String, aiVerdict: String,
  },
  aiSummary: String,
}, { timestamps: true });

sessionSchema.index({ roomId: 1 });

export const DebateSession = mongoose.model<ISession>('DebateSession', sessionSchema);
```

### 3.3 User Stats Update — Post-Debate Hook

```typescript
// backend/src/features/debate/debate.service.ts
async updateUserStats(winnerId: string, loserId: string, isDraw: boolean) {
  if (isDraw) {
    await User.findByIdAndUpdate(winnerId, { $inc: { 'stats.draws': 1, 'stats.totalDebates': 1 } });
    await User.findByIdAndUpdate(loserId,  { $inc: { 'stats.draws': 1, 'stats.totalDebates': 1 } });
  } else {
    await User.findByIdAndUpdate(winnerId, { $inc: { 'stats.wins': 1, 'stats.totalDebates': 1 } });
    await User.findByIdAndUpdate(loserId,  { $inc: { 'stats.losses': 1, 'stats.totalDebates': 1 } });
  }
}
```

---

## 4. MATCHMAKING — IMPLEMENTATION

### 4.1 Matchmaking Service

```typescript
// backend/src/features/matchmaking/matchmaking.service.ts
import { MatchQueue } from '../../models/MatchQueue.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { DebateSession } from '../../models/DebateSession.js';
import { getIO } from '../../socket/index.js';

export class MatchmakingService {
  async tryMatch(format: '1v1' | '3v3'): Promise<void> {
    const waiting = await MatchQueue.find({ format, status: 'waiting' })
      .sort({ eloAtQueue: 1, createdAt: 1 })
      .limit(10);

    if (waiting.length < 2) return;

    const pair = [waiting[0], waiting[1]];

    const room = await DebateRoom.create({
      roomType: 'rank',
      title: `Rank ${format} — ${Date.now()}`,
      format,
      hostType: 'ai',
      judgeType: 'ai',
      judgeCount: 1,
      status: 'waiting',
      participants: pair.map((q, i) => ({
        userId: q.userId,
        username: q.username || 'Player',
        roomRole: 'debater',
        team: i === 0 ? 'proposition' : 'opposition',
        speakerSlot: null,
        positionLocked: false,
      })),
    });

    await MatchQueue.updateMany(
      { _id: { $in: pair.map(p => p._id) } },
      { status: 'matched', matchedRoomId: room._id }
    );

    await DebateSession.create({ roomId: room._id });

    const io = getIO();
    for (const q of pair) {
      io.to(`user:${q.userId}`).emit('match:found', {
        roomId: room._id,
        format,
        opponentId: pair.find(p => p._id !== q._id)?.userId,
      });
    }
  }
}

export const matchmakingService = new MatchmakingService();
```

---

## 5. DEBATE ENGINE — IMPLEMENTATION

### 5.1 Phase State Machine

```typescript
// backend/src/features/debate/debate.service.ts
export type Phase =
  | 'motion' | 'prep_7' | 'speech' | 'cross_exam'
  | 'judge_feedback' | 'prep_1' | 'closing' | 'final_judging' | 'completed';

const SPEAKERS = ['PRO_S1', 'OPP_S1', 'PRO_S2', 'OPP_S2', 'PRO_S3', 'OPP_S3'];
const CE_AFTER = ['PRO_S1', 'OPP_S1', 'PRO_S2', 'OPP_S2'];
const CLOSING = ['PRO_S3', 'OPP_S3'];

const PHASE_DURATION: Record<string, number> = {
  prep_7: 7 * 60,
  speech: 4 * 60,
  cross_exam: 3 * 60,
  judge_feedback: 3 * 60,
  prep_1: 1 * 60,
};
```

### 5.2 Debate Orchestration Flow

```typescript
// backend/src/features/debate/debate.service.ts
export class DebateService {
  async startDebate(roomId: string): Promise<void> {
    const room = await DebateRoom.findById(roomId);
    if (!room) throw new NotFoundError('Room not found');

    // 1. Random motion
    room.motion = this.pickRandomMotion();
    room.status = 'active';
    room.currentPhase = 'motion';
    await room.save();

    const io = getIO();
    io.to(`room:${roomId}`).emit('debate:phase-change', {
      phase: 'motion', motion: room.motion, timeLimit: 0,
    });

    // 2. Prep 7 phút
    await this.delay(2000);
    await this.runPhase(roomId, 'prep_7', 7 * 60);

    // 3. Speakers: Pro S1 → Opp S1 → CE → Judge → Prep → ...
    for (const speaker of SPEAKERS) {
      const hasCE = CE_AFTER.includes(speaker);
      const isClosing = CLOSING.includes(speaker);

      await this.runPhase(roomId, 'speech', 4 * 60, speaker);

      if (hasCE && !isClosing) {
        await this.runPhase(roomId, 'cross_exam', 3 * 60, speaker);
      }

      await this.runPhase(roomId, 'judge_feedback', 3 * 60, speaker);

      if (!isClosing) {
        await this.runPhase(roomId, 'prep_1', 1 * 60);
      }
    }

    // 4. Final judging
    await this.runPhase(roomId, 'final_judging', 5 * 60);

    // 5. Kết thúc
    await this.endDebate(roomId);
  }

  private async runPhase(
    roomId: string, phase: Phase, duration: number, speaker?: string
  ): Promise<void> {
    await DebateRoom.findByIdAndUpdate(roomId, { currentPhase: phase });
    const io = getIO();
    io.to(`room:${roomId}`).emit('debate:phase-change', { phase, timeLimit: duration, speaker });
    await timerService.startTimerAsync(roomId, phase, duration);
  }

  private async endDebate(roomId: string): Promise<void> {
    const verdict = await aiService.getFinalVerdict(roomId);
    await this.updateELO(roomId, verdict?.winner);
    await DebateRoom.findByIdAndUpdate(roomId, { status: 'completed', endedAt: new Date() });

    const io = getIO();
    io.to(`room:${roomId}`).emit('debate:completed', { result: verdict });
  }

  private pickRandomMotion(): string {
    const motions = [
      'This house believes AI will do more harm than good',
      'This house would ban social media for under-16s',
      'This house believes space exploration is a waste of resources',
      // ...
    ];
    return motions[Math.floor(Math.random() * motions.length)];
  }
}
```

### 5.3 ELO Calculation

```typescript
// backend/src/features/ranking/elo.service.ts
const K_FACTOR = 32;

export function calculateExpectedScore(playerELO: number, opponentELO: number): number {
  return 1 / (1 + Math.pow(10, (opponentELO - playerELO) / 400));
}

export function calculateNewELO(
  currentELO: number, opponentELO: number,
  actualScore: number  // 1=win, 0.5=draw, 0=loss
): number {
  return Math.round(currentELO + K_FACTOR * (actualScore - calculateExpectedScore(currentELO, opponentELO)));
}

export function calculateTier(elo: number): string {
  if (elo >= 2400) return 'GrandMaster';
  if (elo >= 2100) return 'Master';
  if (elo >= 1800) return 'Expert';
  if (elo >= 1500) return 'Advanced';
  if (elo >= 1200) return 'Debater';
  return 'Novice';
}
```

---

## 6. TIMER SERVICE — IMPLEMENTATION

```typescript
// backend/src/socket/timer.service.ts
import { getIO } from './index.js';

export class TimerService {
  private intervals = new Map<string, NodeJS.Timeout>();
  private completers = new Map<string, (val: void) => void>();

  startTimerAsync(roomId: string, phase: string, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.stopTimer(roomId);
      this.completers.set(roomId, resolve);

      let remaining = duration;
      const io = getIO();

      io.to(`room:${roomId}`).emit('debate:timer-update', {
        roomId, phase, timeRemaining: remaining,
      });

      const interval = setInterval(() => {
        remaining -= 1;
        io.to(`room:${roomId}`).emit('debate:timer-update', {
          roomId, phase, timeRemaining: remaining,
        });

        if (remaining <= 0) {
          clearInterval(interval);
          this.intervals.delete(roomId);
          const completer = this.completers.get(roomId);
          this.completers.delete(roomId);
          if (completer) completer();
        }
      }, 1000);

      this.intervals.set(roomId, interval);
    });
  }

  stopTimer(roomId: string): void {
    const interval = this.intervals.get(roomId);
    if (interval) { clearInterval(interval); this.intervals.delete(roomId); }
    const completer = this.completers.get(roomId);
    if (completer) { this.completers.delete(roomId); completer(); }
  }
}

export const timerService = new TimerService();
```

---

## 7. SOCKET.IO — IMPLEMENTATION

### 7.1 Server Setup

```typescript
// backend/src/socket/index.ts
import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';

let io: Server;

export function initSocket(server: HTTPServer): Server {
  io = new Server(server, {
    cors: { origin: ENV.CLIENT_URL, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token
      || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.data.user = jwt.verify(token, ENV.JWT_ACCESS_SECRET);
      next();
    } catch { next(new Error('Invalid token')); }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.user.userId;
    socket.join(`user:${userId}`);

    socket.on('join-room', async ({ roomId }) => {
      socket.join(`room:${roomId}`);
      io.to(`room:${roomId}`).emit('room:participant-update', { userId, action: 'joined' });
    });

    socket.on('leave-room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
    });

    socket.on('send-message', async ({ roomId, content, type = 'chat' }) => {
      const { isToxic } = await aiService.checkToxic(content);
      if (isToxic) {
        socket.emit('chat:system', { content: 'Message blocked: toxic content', timestamp: new Date() });
        return;
      }
      io.to(`room:${roomId}`).emit('chat:message', {
        senderId: userId, content, type, timestamp: new Date(),
      });
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
```

### 7.2 Frontend — useDebateSocket Hook

```typescript
// frontend/src/hooks/useDebateSocket.ts
import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@stores/authStore';
import { useDebateStore } from '@stores/debateStore';

let socket: Socket | null = null;

export function useDebateSocket(roomId?: string) {
  const accessToken = useAuthStore(s => s.accessToken);
  const { setPhase, setTimer, setTurn, addMessage } = useDebateStore();

  useEffect(() => {
    if (!roomId || !accessToken) return;

    if (!socket) {
      socket = io(import.meta.env.VITE_SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
      });
    }

    socket.emit('join-room', { roomId });

    socket.on('debate:phase-change', ({ phase, timeLimit, speaker }) => {
      setPhase(phase, speaker);
    });

    socket.on('debate:timer-update', ({ timeRemaining, phase }) => {
      setTimer(timeRemaining, phase);
    });

    socket.on('debate:turn-change', ({ speaker, phase }) => {
      setTurn(speaker, phase);
    });

    socket.on('chat:message', (msg) => addMessage(msg));
    socket.on('chat:system', (msg) => addMessage({ ...msg, type: 'system' }));
    socket.on('debate:completed', ({ result }) => {
      useDebateStore.getState().setResult(result);
    });

    return () => {
      socket?.emit('leave-room', { roomId });
    };
  }, [roomId, accessToken]);

  return {
    emit: useCallback((event: string, data: any) => socket?.emit(event, data), []),
    socket: () => socket,
  };
}
```

---

## 8. AI SERVICE — IMPLEMENTATION

### 8.1 AI Judge Turn (per-turn feedback)

```typescript
// backend/src/features/ai/ai.service.ts
async judgeTurn(
  roomId: string, speaker: string, transcript: string,
  context: { motion: string; turnHistory: any[]; team: string }
) {
  const prompt = `You are an expert debate judge for an AI Debate Platform match.
MOTION: "${context.motion}"
SPEAKER: ${speaker} (${context.team})
PREVIOUS SPEECHES:
${context.turnHistory.map(t => `[${t.speaker}]: ${t.transcript}`).join('\n')}

CURRENT SPEECH:
"${transcript}"

Return JSON: {
  "score": { "logic": "0-30", "rebuttal": "0-20", "evidence": "0-15",
              "crossExam": "0-15", "strategy": "0-10", "communication": "0-10", "overall": "0-100" },
  "feedback": "2-3 sentence constructive feedback",
  "strengths": ["strength1"],
  "weaknesses": ["weakness1"],
  "fallacies": [{ "type": "string", "description": "string" }]
}`;

  const response = await this.callOpenAI(prompt, 1000);
  return JSON.parse(response);
}
```

### 8.2 AI Final Verdict

```typescript
// backend/src/features/ai/ai.service.ts
async getFinalVerdict(roomId: string) {
  const session = await DebateSession.findOne({ roomId });
  const room = await DebateRoom.findById(roomId);
  if (!session || !room) return null;

  const speeches = session.turnHistory.map(t =>
    `[${t.speaker}]: ${t.transcript}\nScore: ${t.aiAnalysis?.score?.overall || 'N/A'}`
  ).join('\n---\n');

  const prompt = `You are the AI Judge (BGK) for this debate.
MOTION: "${room.motion}"

SPEECHES AND SCORES:
${speeches}

Return JSON: {
  "winner": "proposition | opposition | draw",
  "scoreProposition": 0-100,
  "scoreOpposition": 0-100,
  "reasoning": "3-5 sentence explanation",
  "keyClashes": [{ "issue": "string", "proWins": boolean, "why": "string" }],
  "highlights": [{ "speaker": "string", "moment": "string" }]
}`;

  const response = await this.callOpenAI(prompt, 1500);
  return JSON.parse(response);
}
```

### 8.3 Retry + Fallback Pattern

```typescript
// backend/src/features/ai/ai.service.ts
private async callOpenAI(prompt: string, maxTokens = 1000): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content || '{}';
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return '{}';
}

private getFallbackAnalysis() {
  return {
    score: { logic: 0, rebuttal: 0, evidence: 0, crossExam: 0, strategy: 0, communication: 0, overall: 0 },
    strengths: ['AI analysis unavailable'],
    weaknesses: ['AI analysis unavailable'],
    fallacies: [],
    summary: 'AI analysis is temporarily unavailable.',
  };
}
```

---

## 9. VALIDATION — IMPLEMENTATION

### 9.1 Room Schema (Zod)

```typescript
// backend/src/features/room/room.schema.ts
import { z } from 'zod';

export const createRoomSchema = z.object({
  title: z.string().min(3).max(100),
  format: z.enum(['1v1', '3v3']),
  hostType: z.enum(['human', 'ai']).default('ai'),
  judgeType: z.enum(['human', 'ai']).default('ai'),
  judgeCount: z.number().int().min(1).max(3).default(1),
  isPrivate: z.boolean().default(false),
  password: z.string().min(4).optional(),
}).refine(d => !d.isPrivate || d.password, {
  message: 'Password required for private rooms',
});

export const positionSchema = z.object({
  team: z.enum(['proposition', 'opposition']),
  speakerSlot: z.enum(['S1', 'S2', 'S3']),
  roomRole: z.enum(['debater', 'judge', 'host']).default('debater'),
});

export const submitScoreSchema = z.object({
  speaker: z.string(),
  logic: z.number().min(0).max(30),
  rebuttal: z.number().min(0).max(20),
  evidence: z.number().min(0).max(15),
  crossExam: z.number().min(0).max(15),
  strategy: z.number().min(0).max(10),
  communication: z.number().min(0).max(10),
  notes: z.string().optional(),
});
```

### 9.2 Middleware Pattern

```typescript
// backend/src/middleware/roomGuard.ts
export function roomParticipantGuard(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const userId = (req as AuthRequest).user?.userId;
  const room = await DebateRoom.findOne({ _id: id, 'participants.userId': userId });
  if (!room) return res.status(403).json({ success: false, message: 'Not in room' });
  (req as AuthRequest).room = room;
  next();
}
```

---

## 10. ERROR HANDLING PATTERNS

```typescript
// backend/src/utils/AppError.ts
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500
  ) {
    super(message); this.name = 'AppError';
  }
}
export class NotFoundError extends AppError {
  constructor(msg: string) { super('NOT_FOUND', msg, 404); }
}
export class ForbiddenError extends AppError {
  constructor(msg: string) { super('FORBIDDEN', msg, 403); }
}
export class BadRequestError extends AppError {
  constructor(msg: string) { super('BAD_REQUEST', msg, 400); }
}

// backend/src/middleware/errorHandler.ts
export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, statusCode: err.statusCode },
    });
  }
  console.error(err);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
  });
}
```

---

## 11. COMMON PITFALLS

### Backend
- **ESM + `.js` extensions**: Tất cả imports phải có `.js` suffix (vd: `'./auth.routes.js'`)
- **Timer cleanup**: Luôn `clearInterval` khi phase kết thúc hoặc user disconnect
- **Socket memory leaks**: Cleanup event listeners khi component unmount
- **ELO race condition**: Dùng `findOneAndUpdate` thay vì `find` + `save` để tránh overwrite
- **Zod validation**: Validate cả body VÀ params

### Frontend
- **Socket reconnection**: Luôn restore state sau reconnect — không assume state còn nguyên
- **Token refresh**: Interceptor phải có `original._retry` guard để tránh infinite loop
- **React Query key**: Dùng stable keys với dependencies array đầy đủ để invalidate đúng
- **Zustand selectors**: Select specific fields thay vì object nguyên để tránh re-renders
- **ESM imports**: Frontend dùng `@/` alias (đã config trong vite), không cần `.js` suffix
