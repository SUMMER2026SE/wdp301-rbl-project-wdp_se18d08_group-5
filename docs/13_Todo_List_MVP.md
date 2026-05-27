# 13 — Todo List MVP

**Phiên bản:** v1.1 | **Ngày:** 25/05/2026
**Loại tài liệu:** Checklist — feature + technical cần implement cho MVP

---

## A. FEATURES CẦN IMPLEMENT

### A1. Backend Features (theo priority)

#### Auth & User (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A1-01 | `GET /users/:id/history` — paginated debate history | UC-11 | `user.routes.ts` | ❌ |
| A1-02 | User search — `GET /users/search?q=` | — | `user.routes.ts` | ❌ |
| A1-03 | Avatar URL validation (Zod schema) | UC-09 | `user.routes.ts` | ❌ |

#### Matchmaking (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A2-01 | Matchmaking service — ELO-based pairing (1v1/3v3) | UC-13 | `matchmaking.service.ts` | ❌ |
| A2-02 | Auto-tạo `DebateRoom` + gán Pro/Opp khi match thành | UC-13 | `matchmaking.service.ts` | ❌ |
| A2-03 | Emit `match:found` socket event khi ghép được | UC-13 | `matchmaking.service.ts` | ❌ |

#### Room (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A3-01 | `PUT /rooms/:id` — chỉnh sửa cấu hình lobby | UC-15 | `room.routes.ts` | ❌ |
| A3-02 | `DELETE /rooms/:id` — xóa phòng (Owner) | UC-16 | `room.routes.ts` | ❌ |
| A3-03 | `POST /rooms/:id/assign-role` — gán Host/Judge human | UC-20 | `room.routes.ts` | ❌ |
| A3-04 | Zod validation schema cho room creation | UC-14 | `room.schema.ts` | ❌ |
| A3-05 | `POST /rooms/:id/join` — validation trùng user | UC-17 | `room.routes.ts` | ⚠️ partial |
| A3-06 | Viewer join (spectate) khi trận đang active | UC-42 | `room.routes.ts` | ❌ |

#### Debate Engine (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A4-01 | Di chuyển host controls từ `/debate/` → `/rooms/:id/host/*` | UC-44-47 | `room.routes.ts` | ❌ |
| A4-02 | `POST /rooms/:id/host/mute` — mute/cấm chat | UC-47 | `room.routes.ts` | ❌ |
| A4-03 | `POST /rooms/:id/cross-exam/pass-turn` | UC-32 | `room.routes.ts` | ❌ |
| A4-04 | `POST /rooms/:id/cross-exam/finish` | UC-32 | `room.routes.ts` | ❌ |
| A4-05 | `GET /rooms/:id/scores` — tổng hợp điểm judges + AI | UC-50 | `debate.routes.ts` | ❌ |
| A4-06 | `GET /rooms/:id/result` — winner + ELO delta | UC-51-52 | `debate.routes.ts` | ❌ |
| A4-07 | ELO update trigger sau debate (rank room) | UC-52 | `debate.service.ts` | ❌ |
| A4-08 | Debate orchestration — 25 bước phase state machine | UC-41 | `debate.service.ts` | ❌ |
| A4-09 | Motion assignment + `motion` phase announcement | UC-26 | `debate.service.ts` | ❌ |
| A4-10 | Prep 7 phút timer + prep 1 phút timer | UC-27, UC-35 | `debate.service.ts` | ❌ |
| A4-11 | CE enforcement — max 2 câu/đội, penalty thiếu Q/A | UC-33 | `debate.service.ts` | ❌ |
| A4-12 | Speaker 3 — không CE, không luận điểm mới | UC-36 | `debate.service.ts` | ❌ |
| A4-13 | Final judging + winner announcement | UC-37-38 | `debate.service.ts` | ❌ |
| A4-14 | Session persist `completed` + transcript | UC-39 | `debate.service.ts` | ❌ |
| A4-15 | Reconnect state — khôi phục phase + timer | UC-56 | `debate.service.ts` | ❌ |

#### AI (Dev 4)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A5-01 | `POST /ai/judge-turn` — AI BGK per-turn feedback | UC-58 | `ai.service.ts` | ❌ |
| A5-02 | `POST /ai/final-verdict` — AI phán quyết cuối | UC-61 | `ai.service.ts` | ❌ |
| A5-03 | AI verdict tổng hợp nhiều judge + AI | UC-50 | `ai.service.ts` | ❌ |
| A5-04 | AI phát hiện luận điểm mới ở S3 (cảnh báo) | UC-43 | `ai.service.ts` | ❌ |
| A5-05 | OpenAI retry logic (3 retries với backoff) | UC-63 | `ai.service.ts` | ❌ |

#### Ranking (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A6-01 | ELO calculation service (K-factor, expected score) | UC-52 | `ranking.service.ts` | ❌ |
| A6-02 | Tier calculation (Novice → GrandMaster) | — | `ranking.service.ts` | ❌ |
| A6-03 | ELO update sau debate (trigger từ debate ended) | UC-52 | `debate.service.ts` | ❌ |

### A2. Frontend Features

#### Auth + Profile (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F1-01 | Auth store với access/refresh token logic | UC-04 | `stores/authStore.ts` | ⚠️ partial |
| F1-02 | Token refresh interceptor | UC-04 | `services/api.ts` | ❌ |
| F1-03 | Profile page — edit + avatar URL | UC-07-09 | `pages/user/ProfilePage.tsx` | ❌ |
| F1-04 | User history page (debate list) | UC-11 | `pages/user/HistoryPage.tsx` | ❌ |

#### Room + Matchmaking (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F2-01 | Create Room form — đầy đủ config (host/judge type, password) | UC-14 | `pages/room/CreateRoomPage.tsx` | ❌ |
| F2-02 | Room card component — hiển thị status, format, participants | UC-25 | `components/room/RoomCard.tsx` | ❌ |
| F2-03 | Lobby page — Select Position, team, slot | UC-18 | `pages/room/LobbyPage.tsx` | ❌ |
| F2-04 | Lobby page — Owner lock position | UC-19 | `pages/room/LobbyPage.tsx` | ❌ |
| F2-05 | Rank queue page — 1v1/3v3 queue button | UC-12 | `pages/matchmaking/RankQueuePage.tsx` | ⚠️ partial |
| F2-06 | Join room modal — password input | UC-17 | `components/room/JoinRoomModal.tsx` | ❌ |
| F2-07 | Match found notification → redirect to room | UC-13 | `pages/matchmaking/RankQueuePage.tsx` | ❌ |

#### Debate (Dev 2 + Dev 3)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F3-01 | Debate room page layout — Main Room + Private Room tabs | UC-42 | `pages/debate/DebateRoomPage.tsx` | ❌ |
| F3-02 | Turn indicator — current speaker + phase | UC-30 | `components/debate/TurnIndicator.tsx` | ❌ |
| F3-03 | Countdown timer component — server-synced | UC-30 | `components/debate/CountdownTimer.tsx` | ❌ |
| F3-04 | Speech input — debater nhập transcript (hoặc tích hợp STT) | UC-30 | `components/debate/SpeechInput.tsx` | ❌ |
| F3-05 | CE panel — Pass Turn / Finish, quota counter | UC-32 | `components/debate/CrossExamPanel.tsx` | ❌ |
| F3-06 | CE timer per team | UC-32 | `components/debate/CETimer.tsx` | ❌ |
| F3-07 | Judge scoring form — 6 tiêu chí | UC-48 | `components/judge/ScoringForm.tsx` | ❌ |
| F3-08 | Host control panel — pause/resume/next/card | UC-44-47 | `components/host/HostControlPanel.tsx` | ❌ |
| F3-09 | AI analysis panel — score, fallacies, strengths | UC-59 | `components/ai/AIAnalysisPanel.tsx` | ❌ |
| F3-10 | Result page — winner, ELO change, AI summary | UC-38 | `pages/debate/ResultPage.tsx` | ❌ |

#### Socket + Realtime (Dev 3)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F4-01 | Socket handshake — attach JWT token | UC-53 | `hooks/useSocket.ts` | ❌ |
| F4-02 | `useDebateSocket` hook — debate events | UC-54 | `hooks/useDebateSocket.ts` | ⚠️ partial |
| F4-03 | `debate:phase-change` + `debate:turn-change` handlers | UC-54 | `hooks/useDebateSocket.ts` | ❌ |
| F4-04 | `debate:timer-update` handler — sync timer | UC-54 | `hooks/useDebateSocket.ts` | ❌ |
| F4-05 | `match:found` handler — navigate to room | UC-13 | `pages/matchmaking/RankQueuePage.tsx` | ❌ |
| F4-06 | Chat component — message + system + auto-scroll | UC-55 | `components/chat/ChatPanel.tsx` | ❌ |
| F4-07 | Reconnect overlay — "Reconnecting..." | UC-56 | `components/common/ReconnectOverlay.tsx` | ❌ |
| F4-08 | Room participant list realtime update | UC-53 | `components/room/ParticipantList.tsx` | ❌ |

#### Live Matches + Replay (Dev 5)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F5-01 | Live Matches page — realtime list + filters | UC-25, UC-65 | `pages/matches/LiveMatchesPage.tsx` | ❌ |
| F5-02 | Spectate button → join room as viewer | UC-42 | `pages/matches/LiveMatchesPage.tsx` | ❌ |
| F5-03 | Replay page — timeline + transcript viewer | UC-66 | `pages/replay/ReplayPage.tsx` | ❌ |
| F5-04 | Replay navigation — jump to turn | UC-66 | `pages/replay/ReplayPage.tsx` | ❌ |

#### Leaderboard (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F6-01 | Leaderboard page — ELO + tier display | UC-64 | `pages/ranking/LeaderboardPage.tsx` | ❌ |
| F6-02 | Rank badge component | — | `components/ranking/RankBadge.tsx` | ❌ |

---

## B. TECHNICAL REQUIREMENTS CẦN IMPLEMENT

### B1. Backend Infrastructure

| # | Task | File | Status |
|---|------|------|--------|
| B1-01 | **DebateRoom schema** — đầy đủ fields theo TRD §5 (currentPhase, teamProposition, teamOpposition, judges, etc.) | `models/DebateRoom.ts` | ⚠️ partial |
| B1-02 | **DebateSession schema** — đầy đủ fields theo TRD §5 (turnHistory, currentTurn, finalScores, cards, aiSummary) | `models/DebateSession.ts` | ⚠️ partial |
| B1-03 | **MatchQueue schema** — đầy đủ | `models/MatchQueue.ts` | ⚠️ partial |
| B1-04 | **Message schema** — type (chat/system/announcement), isToxic | `models/Message.ts` | ⚠️ partial |
| B1-05 | **Room validation schema** (Zod) — create + update | `features/room/room.schema.ts` | ❌ |
| B1-06 | **Debate validation schema** (Zod) — submit score, cross-exam | `features/debate/debate.schema.ts` | ❌ |
| B1-07 | `roomParticipantGuard` middleware — verify user in room | `middleware/roomGuard.ts` | ❌ |
| B1-08 | `roleGuard(roles[])` middleware — verify room role (Host/Judge/Owner) | `middleware/roleGuard.ts` | ❌ |
| B1-09 | Socket auth middleware — JWT on handshake | `socket/index.ts` | ❌ |
| B1-10 | Socket room cleanup on disconnect | `socket/room.socket.ts` | ❌ |
| B1-11 | Chat toxic check — auto-hook vào `chat:send` | `socket/chat.socket.ts` | ❌ |
| B1-12 | Matchmaking service — ELO pairing + room creation | `features/matchmaking/matchmaking.service.ts` | ❌ |
| B1-13 | Debate orchestration service — phase state machine | `features/debate/debate.service.ts` | ❌ |
| B1-14 | Timer service (server-side countdown, broadcast every 1s) | `socket/timer.service.ts` | ❌ |
| B1-15 | ELO calculation service | `features/ranking/elo.service.ts` | ❌ |
| B1-16 | Redis adapter (optional) — sticky sessions for Socket.IO | `socket/index.ts` | 🔜 Phase 2 |

### B2. Frontend Infrastructure

| # | Task | File | Status |
|---|------|------|--------|
| B2-01 | Axios instance với interceptors (auth + refresh token) | `services/api.ts` | ⚠️ partial |
| B2-02 | React Query setup — provider + config | `main.tsx` | ❌ |
| B2-03 | `useDebateSocket` hook — all debate socket events | `hooks/useDebateSocket.ts` | ⚠️ partial |
| B2-04 | Debate store (Zustand) — phase, timer, turn, scores | `stores/debateStore.ts` | ⚠️ partial |
| B2-05 | Toast notification system (react-hot-toast) | `App.tsx` | ❌ |
| B2-06 | Debate room layout — MainLayout vs DebateLayout routing | `layouts/DebateLayout.tsx` | ❌ |
| B2-07 | Loading/error states cho tất cả pages | `components/common/LoadingScreen.tsx` | ⚠️ partial |
| B2-08 | Type definitions cho socket events | `types/index.ts` | ⚠️ partial |

### B3. Missing Features (từ docs nhưng chưa thấy code)

| # | Task | Ghi chú |
|---|------|---------|
| B3-01 | Private Room / đội — preparation phase space | UI + socket |
| B3-02 | 3v3 format — nhiều debater/đội, slot S1-S3 | Schema + logic |
| B3-03 | 1v1 format — một debater giữ S1+S2+S3 | Schema + logic |
| B3-04 | Motion random assignment / chọn motion | Debate service |
| B3-05 | Season/ELO tier — Novice → GrandMaster badges | Ranking service |
| B3-06 | AI BGK announcement (text-to-speech hoặc text) | UI component |

---

## C. DEPLOYMENT

| # | Task | Status |
|---|------|--------|
| C-01 | Backend `.env` setup | ✅ |
| C-02 | Frontend `.env` setup | ✅ |
| C-03 | MongoDB Atlas connection string | ❌ |
| C-04 | Vercel deployment config (frontend) | ❌ |
| C-05 | Render deployment config (backend) | ❌ |
| C-06 | CORS production whitelist | ❌ |
| C-07 | Seed data — demo users + sample debates | ❌ |

---

## D. PHASE 2 (sau MVP — không implement trong 6 tuần)

- AI Host (auto-orchestrate phase)
- Tournament bracket
- Community feed (posts, votes, comments)
- Debate Threads (community discussion sau trận)
- Password reset
- Leaderboard weekly/monthly/yearly
- Knowledge Bank (evidence, motion forum)
- Portfolio + AI badges
- Credibility system
- Daily Challenge
- Typing indicator + Online presence
- Redis adapter cho Socket.IO horizontal scaling
