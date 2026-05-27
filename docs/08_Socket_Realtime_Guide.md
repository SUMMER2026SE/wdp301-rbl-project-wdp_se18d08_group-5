# 08 — Socket Realtime Guide

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Hướng dẫn kỹ thuật — Socket.IO, timer, realtime  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [04_TRD](./04_TRD_Technical_Requirements.md) §4.3

---

## 1. TỔNG QUAN REALTIME SYSTEM

Hệ thống realtime sử dụng **Socket.IO v4** với kiến trúc **server-authoritative**:
- Server là nguồn sự thật duy nhất (timer, turn state, scores)
- Client chỉ hiển thị, không tự tính toán state quan trọng
- Mọi action quan trọng đều đi qua server trước khi broadcast

---

## 2. SOCKET EVENTS REFERENCE

### 2.1 Connection Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `connect` | Server → Client | `{ socketId }` | Kết nối thành công |
| `disconnect` | Server → Client | `{ reason }` | Mất kết nối |
| `reconnect` | Client → Server | `{ roomId, userId }` | Kết nối lại |

### 2.2 Room Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `room:join` | Client → Server | `{ roomId, userId, role, position }` | Vào phòng |
| `room:leave` | Client → Server | `{ roomId, userId }` | Rời phòng |
| `room:update` | Server → Client | `{ room: RoomData }` | Cập nhật trạng thái phòng |
| `room:participant-joined` | Server → Room | `{ user, role, position }` | Có người vào |
| `room:participant-left` | Server → Room | `{ userId }` | Có người rời |
| `room:participant-kicked` | Server → Room | `{ userId, reason }` | Bị kick |

### 2.3 Debate Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `debate:started` | Server → Room | `{ session, firstTurn }` | Debate bắt đầu |
| `debate:turn-start` | Server → Room | `{ speaker, timeLimit, turnNumber }` | Lượt mới bắt đầu |
| `debate:turn-end` | Server → Room | `{ speaker, transcript, analysis }` | Lượt kết thúc |
| `debate:timer-tick` | Server → Room | `{ timeRemaining, totalTime }` | Cập nhật timer (mỗi giây) |
| `debate:paused` | Server → Room | `{ reason }` | Debate tạm dừng |
| `debate:resumed` | Server → Room | `{}` | Debate tiếp tục |
| `debate:ended` | Server → Room | `{ result, summary }` | Debate kết thúc |
| `debate:speech-update` | Client → Server | `{ content, speaker }` | Cập nhật nội dung đang nói |
| `debate:speech-broadcast` | Server → Room | `{ content, speaker }` | Broadcast nội dung |

### 2.4 Phase & Cross Examination Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `debate:phase-change` | Server → Room | `{ phase, motion }` | motion / prep_7 / speech / cross_exam / judge_feedback / prep_1 / closing |
| `cross-exam:question` | Client → Server | `{ roomId, team, question }` | Gửi câu hỏi (trong quota 2) |
| `cross-exam:answer` | Client → Server | `{ roomId, team, answer }` | Trả lời |
| `cross-exam:pass-turn` | Client → Server | `{ roomId }` | Chuyển lượt (Debate_rule §10.2) |
| `cross-exam:finish` | Client → Server | `{ roomId, team }` | Kết thúc sớm phần CE |
| `cross-exam:update` | Server → Room | `{ activeTeam, questionsPro, questionsOpp, timeRemainingPro, timeRemainingOpp }` | Đồng bộ CE |
| `cross-exam:ended` | Server → Room | `{ scoresAdjustment }` | Hết CE (penalty nếu thiếu Q/A) |
| `judge:feedback-start` | Server → Room | `{ speaker }` | BGK bắt đầu nhận xét 3–5' |
| `judge:feedback-end` | Server → Room | `{}` | Kết thúc nhận xét |
| `room:private-join` | Client → Server | `{ team }` | Vào private room đội (prep 7' / prep 1') |

### 2.5 Host/Judge Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `host:next-turn` | Client → Server | `{ roomId }` | Chuyển lượt |
| `host:pause` | Client → Server | `{ roomId, reason }` | Tạm dừng |
| `host:resume` | Client → Server | `{ roomId }` | Tiếp tục |
| `host:card-issued` | Server → Room | `{ type, target, reason }` | Phát thẻ |
| `host:override-timer` | Client → Server | `{ roomId, seconds }` | Thêm/bớt giờ |
| `judge:score-submitted` | Server → Room | `{ judgeId, speaker, scores }` | Judge nộp điểm |

### 2.6 Chat Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `chat:send` | Client → Server | `{ roomId, content, type }` | Gửi tin nhắn |
| `chat:message` | Server → Room | `{ message: MessageData }` | Nhận tin nhắn |
| `chat:typing` | Client → Server | `{ roomId, isTyping }` | Đang gõ |
| `chat:typing-broadcast` | Server → Room | `{ userId, username, isTyping }` | Broadcast typing |

### 2.7 AI Events

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `ai:analysis-start` | Server → Room | `{ speaker }` | AI đang phân tích |
| `ai:analysis-ready` | Server → Room | `{ speaker, analysis }` | AI xong phân tích |
| `ai:host-announcement` | Server → Room | `{ message, type }` | AI Host thông báo |
| `ai:summary-ready` | Server → Room | `{ summary }` | AI summary xong |

### 2.8 Matchmaking Events (Rank)

| Event | Direction | Payload | Mô tả |
|-------|-----------|---------|-------|
| `matchmaking:queue` | Client → Server | `{ format: '1v1' \| '3v3' }` | Vào hàng chờ — UC-19 |
| `matchmaking:cancel` | Client → Server | `{}` | Hủy queue |
| `matchmaking:status` | Server → Client | `{ status, elo }` | Trạng thái đang chờ |
| `match:found` | Server → Client | `{ roomId, team, opponents }` | Ghép xong — UC-20 |

---

## 3. SERVER-SIDE IMPLEMENTATION

> **Lưu ý:** Các đoạn code mẫu §3.2–3.3 dưới đây vẫn dùng tên sự kiện/turn **cũ (AP/POI)** — khi implement phải thay bằng phase + Cross Examination theo [01_Debate_Rule.md](./01_Debate_Rule.md) và bảng sự kiện §2.4.

### 3.1 Socket Server Setup

```typescript
// server/src/socket/index.ts
import { Server } from 'socket.io';
import { verifySocketToken } from '../middleware/auth';
import { debateSocketHandler } from './debate.socket';
import { chatSocketHandler } from './chat.socket';
import { roomSocketHandler } from './room.socket';

export const initSocket = (httpServer: any) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware
  io.use(verifySocketToken);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.userId}`);

    // Register handlers
    roomSocketHandler(io, socket);
    debateSocketHandler(io, socket);
    chatSocketHandler(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`User disconnected: ${socket.data.userId}, reason: ${reason}`);
      handleDisconnect(io, socket);
    });
  });

  return io;
};
```

### 3.2 Timer System (Server-Authoritative)

```typescript
// server/src/socket/timer.service.ts
interface TimerState {
  roomId: string;
  speaker: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  intervalId?: NodeJS.Timeout;
}

const activeTimers = new Map<string, TimerState>();

export const startTimer = (
  io: Server,
  roomId: string,
  speaker: string,
  totalSeconds: number
) => {
  // Clear existing timer
  stopTimer(roomId);

  const state: TimerState = {
    roomId,
    speaker,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: true,
  };

  // POI window tracking
  const poiOpenAt = totalSeconds - 120; // 2 minutes from start
  const poiCloseAt = totalSeconds - (totalSeconds - 360); // at 6 minutes

  state.intervalId = setInterval(() => {
    state.remainingSeconds--;

    // Broadcast timer tick
    io.to(roomId).emit('debate:timer-tick', {
      timeRemaining: state.remainingSeconds,
      totalTime: state.totalSeconds,
      speaker: state.speaker,
    });

    // POI window events
    const elapsed = totalSeconds - state.remainingSeconds;
    if (elapsed === 120) { // 2 minutes elapsed
      io.to(roomId).emit('poi:window-open', {});
    }
    if (elapsed === 360) { // 6 minutes elapsed
      io.to(roomId).emit('poi:window-close', {});
    }
    if (state.remainingSeconds === 60) { // 1 minute warning
      io.to(roomId).emit('ai:host-announcement', {
        message: '1 minute remaining.',
        type: 'warning',
      });
    }

    // Time's up
    if (state.remainingSeconds <= 0) {
      stopTimer(roomId);
      io.to(roomId).emit('debate:turn-end', { speaker });
      // Trigger AI analysis
      triggerAIAnalysis(io, roomId, speaker);
    }
  }, 1000);

  activeTimers.set(roomId, state);
};

export const pauseTimer = (roomId: string) => {
  const timer = activeTimers.get(roomId);
  if (timer?.intervalId) {
    clearInterval(timer.intervalId);
    timer.isRunning = false;
  }
};

export const resumeTimer = (io: Server, roomId: string) => {
  const timer = activeTimers.get(roomId);
  if (timer && !timer.isRunning) {
    startTimer(io, roomId, timer.speaker, timer.remainingSeconds);
  }
};

export const stopTimer = (roomId: string) => {
  const timer = activeTimers.get(roomId);
  if (timer?.intervalId) {
    clearInterval(timer.intervalId);
    activeTimers.delete(roomId);
  }
};
```

### 3.3 Debate Socket Handler

```typescript
// server/src/socket/debate.socket.ts
const TURN_ORDER = ['A1','N1','A2','N2','A3','N3','N_Reply','A_Reply'];
const TURN_DURATIONS: Record<string, number> = {
  A1: 420, N1: 420, A2: 420, N2: 420,
  A3: 420, N3: 420, N_Reply: 240, A_Reply: 240,
};

export const debateSocketHandler = (io: Server, socket: Socket) => {
  // Start debate
  socket.on('host:start-debate', async ({ roomId }) => {
    const session = await DebateSession.findOne({ roomId });
    const firstTurn = TURN_ORDER[0];

    await DebateSession.updateOne(
      { roomId },
      { 'currentTurn.speaker': firstTurn, status: 'active' }
    );

    io.to(roomId).emit('debate:started', { firstTurn });
    io.to(roomId).emit('debate:turn-start', {
      speaker: firstTurn,
      timeLimit: TURN_DURATIONS[firstTurn],
      turnNumber: 1,
    });

    startTimer(io, roomId, firstTurn, TURN_DURATIONS[firstTurn]);
  });

  // Next turn (host manual)
  socket.on('host:next-turn', async ({ roomId }) => {
    const session = await DebateSession.findOne({ roomId });
    const currentIndex = TURN_ORDER.indexOf(session.currentTurn.speaker);
    const nextTurn = TURN_ORDER[currentIndex + 1];

    if (!nextTurn) {
      // Debate ended
      io.to(roomId).emit('debate:ended', {});
      return;
    }

    stopTimer(roomId);
    await DebateSession.updateOne(
      { roomId },
      { 'currentTurn.speaker': nextTurn }
    );

    io.to(roomId).emit('debate:turn-start', {
      speaker: nextTurn,
      timeLimit: TURN_DURATIONS[nextTurn],
      turnNumber: currentIndex + 2,
    });

    startTimer(io, roomId, nextTurn, TURN_DURATIONS[nextTurn]);
  });

  // POI request
  socket.on('poi:request', async ({ roomId, question }) => {
    const session = await DebateSession.findOne({ roomId });
    const elapsed = TURN_DURATIONS[session.currentTurn.speaker]
      - activeTimers.get(roomId)!.remainingSeconds;

    // Validate POI window (2-6 minutes = 120-360 seconds)
    if (elapsed < 120 || elapsed > 360) {
      socket.emit('poi:error', { message: 'POI not allowed at this time' });
      return;
    }

    // Validate question with AI
    const validation = await aiService.validatePOI(
      question,
      session.topic,
      session.currentTranscript
    );

    if (!validation.isValid) {
      socket.emit('poi:error', { message: validation.reason });
      return;
    }

    const requestId = generateId();
    io.to(roomId).emit('poi:requested', {
      requestId,
      requester: socket.data.username,
      question,
    });
  });

  // Accept POI
  socket.on('poi:accept', ({ roomId, requestId }) => {
    pauseTimer(roomId);
    io.to(roomId).emit('poi:accepted-broadcast', {
      requestId,
      timeLimit: 15,
    });

    // Auto-resume after 15 seconds
    setTimeout(() => {
      resumeTimer(io, roomId);
      io.to(roomId).emit('poi:ended', { requestId });
    }, 15000);
  });

  // Reject POI
  socket.on('poi:reject', ({ roomId, requestId }) => {
    io.to(roomId).emit('poi:rejected-broadcast', { requestId });
  });

  // Issue card
  socket.on('host:issue-card', async ({ roomId, targetUserId, cardType, reason }) => {
    await DebateSession.updateOne(
      { roomId },
      {
        $push: {
          cards: {
            type: cardType,
            issuedTo: targetUserId,
            issuedBy: socket.data.userId,
            reason,
            timestamp: new Date(),
          }
        }
      }
    );

    io.to(roomId).emit('host:card-issued', {
      type: cardType,
      targetUserId,
      reason,
    });

    // Red card: mute participant
    if (cardType === 'red') {
      io.to(roomId).emit('participant:muted', { userId: targetUserId });
    }
  });
};
```

---

## 4. CLIENT-SIDE IMPLEMENTATION

### 4.1 Socket Hook

```typescript
// client/src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

let socket: Socket | null = null;

export const useSocket = () => {
  const { token } = useAuthStore();

  useEffect(() => {
    if (!socket && token) {
      socket = io(import.meta.env.VITE_SERVER_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on('connect', () => {
        console.log('Socket connected:', socket?.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
    }

    return () => {
      // Don't disconnect on component unmount
      // Only disconnect on logout
    };
  }, [token]);

  return socket;
};
```

### 4.2 Debate Store (Zustand)

```typescript
// client/src/stores/debateStore.ts
import { create } from 'zustand';

interface DebateState {
  currentTurn: string | null;
  timeRemaining: number;
  totalTime: number;
  isPaused: boolean;
  poiWindowOpen: boolean;
  pendingPOI: POIRequest | null;
  participants: Participant[];
  messages: Message[];
  turnHistory: TurnRecord[];
  currentAnalysis: AIAnalysis | null;

  // Actions
  setCurrentTurn: (turn: string) => void;
  updateTimer: (remaining: number, total: number) => void;
  setPaused: (paused: boolean) => void;
  setPoiWindow: (open: boolean) => void;
  setPendingPOI: (poi: POIRequest | null) => void;
  addMessage: (message: Message) => void;
  addTurnRecord: (record: TurnRecord) => void;
  setAnalysis: (analysis: AIAnalysis) => void;
}

export const useDebateStore = create<DebateState>((set) => ({
  currentTurn: null,
  timeRemaining: 0,
  totalTime: 0,
  isPaused: false,
  poiWindowOpen: false,
  pendingPOI: null,
  participants: [],
  messages: [],
  turnHistory: [],
  currentAnalysis: null,

  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  updateTimer: (remaining, total) =>
    set({ timeRemaining: remaining, totalTime: total }),
  setPaused: (paused) => set({ isPaused: paused }),
  setPoiWindow: (open) => set({ poiWindowOpen: open }),
  setPendingPOI: (poi) => set({ pendingPOI: poi }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  addTurnRecord: (record) =>
    set((state) => ({ turnHistory: [...state.turnHistory, record] })),
  setAnalysis: (analysis) => set({ currentAnalysis: analysis }),
}));
```

### 4.3 Debate Socket Listener

```typescript
// client/src/features/debate/hooks/useDebateSocket.ts
import { useEffect } from 'react';
import { useSocket } from '../../../hooks/useSocket';
import { useDebateStore } from '../../../stores/debateStore';

export const useDebateSocket = (roomId: string) => {
  const socket = useSocket();
  const store = useDebateStore();

  useEffect(() => {
    if (!socket) return;

    socket.emit('room:join', { roomId });

    socket.on('debate:turn-start', ({ speaker, timeLimit }) => {
      store.setCurrentTurn(speaker);
      store.updateTimer(timeLimit, timeLimit);
    });

    socket.on('debate:timer-tick', ({ timeRemaining, totalTime }) => {
      store.updateTimer(timeRemaining, totalTime);
    });

    socket.on('debate:paused', () => store.setPaused(true));
    socket.on('debate:resumed', () => store.setPaused(false));

    socket.on('poi:window-open', () => store.setPoiWindow(true));
    socket.on('poi:window-close', () => store.setPoiWindow(false));

    socket.on('poi:requested', (poi) => store.setPendingPOI(poi));
    socket.on('poi:accepted-broadcast', () => store.setPendingPOI(null));
    socket.on('poi:rejected-broadcast', () => store.setPendingPOI(null));

    socket.on('chat:message', (message) => store.addMessage(message));

    socket.on('ai:analysis-ready', ({ analysis }) => {
      store.setAnalysis(analysis);
    });

    return () => {
      socket.emit('room:leave', { roomId });
      socket.off('debate:turn-start');
      socket.off('debate:timer-tick');
      socket.off('debate:paused');
      socket.off('debate:resumed');
      socket.off('poi:window-open');
      socket.off('poi:window-close');
      socket.off('poi:requested');
      socket.off('chat:message');
      socket.off('ai:analysis-ready');
    };
  }, [socket, roomId]);
};
```

---

## 5. RECONNECTION HANDLING

```typescript
// Khi user reconnect, restore state
socket.on('reconnect', async () => {
  const { currentRoomId } = useRoomStore.getState();
  if (currentRoomId) {
    socket.emit('room:rejoin', { roomId: currentRoomId });
  }
});

// Server handles rejoin
socket.on('room:rejoin', async ({ roomId }) => {
  socket.join(roomId);
  const session = await DebateSession.findOne({ roomId });
  const timer = activeTimers.get(roomId);

  // Send current state to reconnected client
  socket.emit('room:state-restore', {
    currentTurn: session.currentTurn,
    timeRemaining: timer?.remainingSeconds || 0,
    messages: await Message.find({ roomId }).limit(50),
    participants: session.participants,
  });
});
```
