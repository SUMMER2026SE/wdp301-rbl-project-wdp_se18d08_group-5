# 13 — Todo List MVP

**Phiên bản:** v1.1 | **Ngày:** 25/05/2026
**Loại tài liệu:** Checklist — feature + technical cần implement cho MVP

---

## Source-Code Status Update - Dev 2, June 17 2026

This file contains older planning tables below. Use this update as the current source-code status for Dev 2 REST/backend work in this workspace.

### Dev 2 Backend REST Status

- Matchmaking service is partially implemented: ranked queue join/leave/status, same-format FIFO pairing with `eloAtQueue` stored, room/session creation, and `match:found` best-effort emit when Socket.IO is initialized.
- Room management is implemented: create/list/detail/update/delete/join/leave, active-room viewer spectate join, private password support, owner role assignment, debater position selection, lock, start, motion update, host controls, viewer chat control, host transfer, scoring, scores aggregate, winner, replay/session/result endpoints.
- Debate engine REST is implemented for start debate, next turn, finish phase, CE pass/finish, end debate, surrender, draw request, score aggregation, replay payload, and rank-apply endpoint when eligible. Full 25-step orchestration remains partial.
- Dev 2 validation infrastructure is implemented: `backend/src/features/room/room.schema.ts` and `backend/src/features/debate/debate.schema.ts` are wired into room/debate REST routes.
- Dev 2 guard infrastructure is implemented: `backend/src/middleware/roomGuard.ts` and `backend/src/middleware/roleGuard.ts` exist for reusable room-participant and role checks.

### Current Boundaries

- Socket.IO realtime polish remains Dev 3: timer broadcasts, live phase/CE sync, reconnect/disconnect cleanup, chat transcript capture, surrender/draw notifications.
- Advanced AI toxic/new-argument/retry checks remain Dev 4; AI judge-turn/final-verdict endpoints exist.
- Live matches/replay polish beyond the existing REST payloads remains Dev 5.

### Verification

- `npm run build` passes on June 17 2026.
- No dedicated Jest/Cypress/Postman automated suite is configured in `package.json`; current verification is TypeScript/Vite build smoke testing.

---

## A. FEATURES CẦN IMPLEMENT

### A1. Backend Features (theo priority)

#### Auth & User (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A1-01 | `GET /users/:id/history` — paginated debate history | UC-11 | `user.routes.ts` | ✅ Đã impl |
| A1-02 | User search — `GET /users/search?q=` | — | `user.routes.ts` | ✅ Đã impl |
| A1-03 | Avatar URL validation (Zod schema) | UC-09 | `user.routes.ts` | ✅ Đã impl |

#### Matchmaking (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A2-01 | Matchmaking service — ELO-based pairing (1v1/3v3) | UC-13 | `matchmaking.service.ts` | ⚠️ Partial: lưu `eloAtQueue`, pairing hiện FIFO theo format |
| A2-02 | Auto-tạo `DebateRoom` + gán Pro/Opp khi match thành | UC-13 | `matchmaking.service.ts` | ✅ Đã impl |
| A2-03 | Emit `match:found` socket event khi ghép được | UC-13 | `matchmaking.service.ts` | ✅ Đã impl best-effort |

#### Room (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A3-01 | `PUT /rooms/:id` — chỉnh sửa cấu hình lobby | UC-15 | `room.routes.ts` | ✅ Đã impl |
| A3-02 | `DELETE /rooms/:id` — xóa phòng (Owner) | UC-16 | `room.routes.ts` | ✅ Đã impl |
| A3-03 | `POST /rooms/:id/assign-role` — gán Host/Judge human | UC-20 | `room.routes.ts` | ✅ Đã impl |
| A3-04 | Zod validation schema cho room creation | UC-14 | `room.schema.ts` | ✅ Đã impl |
| A3-05 | `POST /rooms/:id/join` — validation trùng user | UC-17 | `room.routes.ts` | ✅ Đã impl |
| A3-06 | Viewer join (spectate) khi trận đang active | UC-42 | `room.routes.ts` | ✅ Đã impl |

#### Debate Engine (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A4-01 | Di chuyển host controls từ `/debate/` → `/rooms/:id/host/*` | UC-44-47 | `room.routes.ts` | ✅ Đã impl |
| A4-02 | `POST /rooms/:id/host/mute` — mute/cấm chat | UC-47 | `room.routes.ts` | ✅ Đã impl |
| A4-03 | `POST /rooms/:id/cross-exam/pass-turn` | UC-32 | `room.routes.ts` | ✅ Đã impl |
| A4-04 | `POST /rooms/:id/cross-exam/finish` | UC-32 | `room.routes.ts` | ✅ Đã impl |
| A4-05 | `GET /rooms/:id/scores` — tổng hợp điểm judges + AI | UC-50 | `debate.routes.ts` | ✅ Đã impl trong room.routes.ts |
| A4-06 | `GET /rooms/:id/result` — winner + ELO delta | UC-51-52 | `debate.routes.ts` | ⚠️ Partial: GET result có, ELO delta qua POST apply |
| A4-07 | ELO update trigger sau debate (rank room) | UC-52 | `debate.service.ts` | ⚠️ Partial: apply qua POST result, chưa auto khi debate ended |
| A4-08 | Debate orchestration — 25 bước phase state machine | UC-41 | `debate.service.ts` | ⚠️ Partial REST-first flow |
| A4-09 | Motion assignment + `motion` phase announcement | UC-26 | `debate.service.ts` | ⚠️ Partial: motion phase + host chọn motion, chưa random |
| A4-10 | Prep 7 phút timer + prep 1 phút timer | UC-27, UC-35 | `debate.service.ts` | ⚠️ Partial: timer fields có, realtime là Dev 3 |
| A4-11 | CE enforcement — max 2 câu/đội, penalty thiếu Q/A | UC-33 | `debate.service.ts` | ⚠️ Partial: CE quota/pass có, penalty chưa full |
| A4-12 | Speaker 3 — không CE, không luận điểm mới | UC-36 | `debate.service.ts` | ❌ Chưa impl |
| A4-13 | Final judging + winner announcement | UC-37-38 | `debate.service.ts` | ✅ Đã impl final scoring/result REST |
| A4-14 | Session persist `completed` + transcript | UC-39 | `debate.service.ts` | ✅ Đã impl completed + turnHistory transcript REST |
| A4-15 | Reconnect state — khôi phục phase + timer | UC-56 | `debate.service.ts` | ❌ Chưa impl |

#### AI (Dev 4)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A5-01 | `POST /ai/judge-turn` — AI BGK per-turn feedback | UC-58 | `ai.service.ts` | ✅ Đã impl |
| A5-02 | `POST /ai/final-verdict` — AI phán quyết cuối | UC-61 | `ai.service.ts` | ✅ Đã impl |
| A5-03 | AI verdict tổng hợp nhiều judge + AI | UC-50 | `ai.service.ts` | ✅ Đã impl trong room.routes.ts aggregateFinalScores |
| A5-04 | AI phát hiện luận điểm mới ở S3 (cảnh báo) | UC-43 | `ai.service.ts` | ❌ Chưa impl |
| A5-05 | OpenAI retry logic (3 retries với backoff) | UC-63 | `ai.service.ts` | ❌ Chưa impl retry/backoff 3 lần |

#### Ranking (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A6-01 | ELO calculation service (K-factor, expected score) | UC-52 | `ranking.service.ts` | ✅ Đã impl |
| A6-02 | Tier calculation (Novice → GrandMaster) | — | `ranking.service.ts` | ✅ Đã impl |
| A6-03 | ELO update sau debate (trigger từ debate ended) | UC-52 | `debate.service.ts` | ⚠️ Partial: apply qua POST result, chưa auto khi debate ended |

#### Admin & Reports (MVP-S)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| A7-01 | Admin overview metrics API | UC-108-109 | `features/admin/admin.routes.ts` | ✅ Đã impl |
| A7-02 | Admin user management — list/filter/role/ban/unban | UC-109 | `features/admin/admin.routes.ts` | ✅ Đã impl |
| A7-03 | Admin room oversight — list/detail/status/kick/mute/viewer-chat | UC-108 | `features/admin/admin.routes.ts` | ✅ Đã impl |
| A7-04 | Report model + user report submit API | UC-107 | `models/Report.ts`, `features/report/report.routes.ts` | ✅ Đã impl |
| A7-05 | Admin report review — warned/muted/banned/dismissed | UC-108 | `features/admin/admin.routes.ts` | ✅ Đã impl |

### A2. Frontend Features

#### Auth + Profile (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F1-01 | Auth store với access/refresh token logic | UC-04 | `stores/authStore.ts` | ✅ Đã impl |
| F1-02 | Token refresh interceptor | UC-04 | `services/api.ts` | ✅ Đã impl |
| F1-03 | Profile page — edit + avatar URL | UC-07-09 | `pages/user/ProfilePage.tsx` | ✅ Đã impl |
| F1-04 | User history page (debate list) | UC-11 | `pages/user/HistoryPage.tsx` | ✅ Đã impl |

#### Room + Matchmaking (Dev 2)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F2-01 | Create Room form — đầy đủ config (host/judge type, password) | UC-14 | `pages/room/CreateRoomPage.tsx` | ✅ Đã impl |
| F2-02 | Room card component — hiển thị status, format, participants | UC-25 | `components/room/RoomCard.tsx` | ⚠️ Partial: UI inline trong LiveMatchesPage, chưa có component riêng |
| F2-03 | Lobby page — Select Position, team, slot | UC-18 | `pages/room/LobbyPage.tsx` | ✅ Đã impl |
| F2-04 | Lobby page — Owner lock position | UC-19 | `pages/room/LobbyPage.tsx` | ✅ Đã impl |
| F2-05 | Rank queue page — 1v1/3v3 queue button | UC-12 | `pages/matchmaking/RankQueuePage.tsx` | ✅ Đã impl |
| F2-06 | Join room modal — password input | UC-17 | `components/room/JoinRoomModal.tsx` | ⚠️ Partial: modal/password inline trong LiveMatchesPage, chưa có component riêng |
| F2-07 | Match found notification → redirect to room | UC-13 | `pages/matchmaking/RankQueuePage.tsx` | ✅ Đã impl REST polling/redirect |

#### Debate (Dev 2 + Dev 3)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F3-01 | Debate room page layout — Main Room + Private Room tabs | UC-42 | `pages/debate/DebateRoomPage.tsx` | ⚠️ Partial inline: main + team discussion room, chưa tab component riêng |
| F3-02 | Turn indicator — current speaker + phase | UC-30 | `components/debate/TurnIndicator.tsx` | ⚠️ Partial: hiển thị inline trong DebateRoomPage, chưa có component riêng |
| F3-03 | Countdown timer component — server-synced | UC-30 | `components/debate/CountdownTimer.tsx` | ⚠️ Partial: hiển thị timer từ session, realtime sync là Dev 3 |
| F3-04 | Speech input — debater nhập transcript (hoặc tích hợp STT) | UC-30 | `components/debate/SpeechInput.tsx` | ⚠️ Partial: transcript + mic inline, chưa có component riêng |
| F3-05 | CE panel — Pass Turn / Finish, quota counter | UC-32 | `components/debate/CrossExamPanel.tsx` | ⚠️ Partial: Pass/Finish inline, chưa component riêng/quota đầy đủ |
| F3-06 | CE timer per team | UC-32 | `components/debate/CETimer.tsx` | ⚠️ Partial: dùng current turn timer, chưa CETimer riêng |
| F3-07 | Judge scoring form — 6 tiêu chí | UC-48 | `components/judge/ScoringForm.tsx` | ⚠️ Partial: form 6 tiêu chí inline, chưa có component riêng |
| F3-08 | Host control panel — pause/resume/next/card | UC-44-47 | `components/host/HostControlPanel.tsx` | ⚠️ Partial: controls inline, chưa có component riêng |
| F3-09 | AI analysis panel — score, fallacies, strengths | UC-59 | `components/ai/AIAnalysisPanel.tsx` | ⚠️ Partial: AI judge/analysis data có hook, chưa panel riêng |
| F3-10 | Result page — winner, ELO change, AI summary | UC-38 | `pages/debate/ResultPage.tsx` | ⚠️ Partial: có score/result inline + ReplayPage, chưa ELO delta/AI summary đầy đủ |

#### Socket + Realtime (Dev 3)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F4-01 | Socket handshake — attach JWT token | UC-53 | `hooks/useSocket.ts` | ✅ Đã impl socket auth handshake backend + frontend token |
| F4-02 | `useDebateSocket` hook — debate events | UC-54 | `hooks/useDebateSocket.ts` | ⚠️ Partial: frontend hook có, backend debate socket còn stub |
| F4-03 | `debate:phase-change` + `debate:turn-change` handlers | UC-54 | `hooks/useDebateSocket.ts` | ⚠️ Partial: frontend handlers có, backend emit chưa nối debate service |
| F4-04 | `debate:timer-update` handler — sync timer | UC-54 | `hooks/useDebateSocket.ts` | ⚠️ Partial: frontend handler có, chưa có server timer broadcast chuẩn |
| F4-05 | `match:found` handler — navigate to room | UC-13 | `pages/matchmaking/RankQueuePage.tsx` | ⚠️ Partial: backend emit best-effort + REST redirect; frontend chưa listen socket match:found |
| F4-06 | Chat component — message + system + auto-scroll | UC-55 | `components/chat/ChatPanel.tsx` | ⚠️ Partial: backend chat socket + hook có, chưa ChatPanel component riêng |
| F4-07 | Reconnect overlay — "Reconnecting..." | UC-56 | `components/common/ReconnectOverlay.tsx` | ❌ Chưa impl |
| F4-08 | Room participant list realtime update | UC-53 | `components/room/ParticipantList.tsx` | ⚠️ Partial: room join/update socket có, chưa ParticipantList component riêng/full realtime cleanup |

#### Live Matches + Replay (Dev 5)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F5-01 | Live Matches page — realtime list + filters | UC-25, UC-65 | `pages/matches/LiveMatchesPage.tsx` | ⚠️ Partial: list + filters có, realtime refresh chưa có |
| F5-02 | Spectate button → join room as viewer | UC-42 | `pages/matches/LiveMatchesPage.tsx` | ✅ Đã impl spectate join viewer |
| F5-03 | Replay page — timeline + transcript viewer | UC-66 | `pages/replay/ReplayPage.tsx` | ✅ Đã impl timeline + transcript viewer |
| F5-04 | Replay navigation — jump to turn | UC-66 | `pages/replay/ReplayPage.tsx` | ⚠️ Partial: timeline list có, chưa jump navigation riêng |

#### Leaderboard (Dev 1)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F6-01 | Leaderboard page — ELO + tier display | UC-64 | `pages/ranking/LeaderboardPage.tsx` | ✅ Đã impl |
| F6-02 | Rank badge component | — | `components/ranking/RankBadge.tsx` | ✅ Đã impl |

#### Admin (MVP-S)

| # | Task | UC | File | Status |
|---|------|----|------|--------|
| F7-01 | Admin dashboard overview tab | UC-108-109 | `pages/admin/AdminDashboardPage.tsx` | ✅ Đã impl |
| F7-02 | User management tab — search/filter/role/ban/unban | UC-109 | `pages/admin/AdminDashboardPage.tsx` | ✅ Đã impl |
| F7-03 | Room moderation tab — status/viewer-chat/participant mute-kick | UC-108 | `pages/admin/AdminDashboardPage.tsx` | ✅ Đã impl |
| F7-04 | Report review tab — status/resolution/ban/mute actions | UC-107-108 | `pages/admin/AdminDashboardPage.tsx` | ✅ Đã impl |
| F7-05 | Admin/report service + shared types | — | `services/adminService.ts`, `services/reportService.ts`, `types/index.ts` | ✅ Đã impl |

---

## B. TECHNICAL REQUIREMENTS CẦN IMPLEMENT

### B1. Backend Infrastructure

| # | Task | File | Status |
|---|------|------|--------|
| B1-01 | **DebateRoom schema** — đầy đủ fields theo TRD §5 (currentPhase, teamProposition, teamOpposition, judges, etc.) | `models/DebateRoom.ts` | ⚠️ Partial, model exists |
| B1-02 | **DebateSession schema** — đầy đủ fields theo TRD §5 (turnHistory, currentTurn, finalScores, cards, aiSummary) | `models/DebateSession.ts` | ⚠️ Partial, model exists |
| B1-03 | **MatchQueue schema** — đầy đủ | `models/MatchQueue.ts` | ⚠️ Partial, model exists |
| B1-04 | **Message schema** — type (chat/system/announcement), isToxic | `models/Message.ts` | ✅ Đã impl |
| B1-04a | **Report schema** — target, reporter, status, resolution | `models/Report.ts` | ✅ Đã impl |
| B1-05 | **Room validation schema** (Zod) — create + update | `features/room/room.schema.ts` | ✅ Đã impl |
| B1-06 | **Debate validation schema** (Zod) — submit score, cross-exam | `features/debate/debate.schema.ts` | ✅ Đã impl |
| B1-07 | `roomParticipantGuard` middleware — verify user in room | `middleware/roomGuard.ts` | ✅ Đã impl |
| B1-08 | `roleGuard(roles[])` middleware — verify room role (Host/Judge/Owner) | `middleware/roleGuard.ts` | ✅ Đã impl |
| B1-09 | Socket auth middleware — JWT on handshake | `socket/index.ts` | ✅ Đã impl |
| B1-10 | Socket room cleanup on disconnect | `socket/room.socket.ts` | ❌ Chưa impl |
| B1-11 | Chat toxic check — auto-hook vào `chat:send` | `socket/chat.socket.ts` | ⚠️ Stub only |
| B1-12 | Matchmaking service — ELO pairing + room creation | `features/matchmaking/matchmaking.service.ts` | ⚠️ Partial: tạo room có, pairing hiện FIFO theo format |
| B1-13 | Debate orchestration service — phase state machine | `features/debate/debate.service.ts` | ⚠️ Partial REST-first flow |
| B1-14 | Timer service (server-side countdown, broadcast every 1s) | `socket/timer.service.ts` | ⚠️ Partial: service có, chưa wired vào debate socket/flow |
| B1-15 | ELO calculation service | `features/ranking/elo.service.ts` | ✅ Đã impl trong ranking.service.ts |
| B1-16 | Redis adapter (optional) — sticky sessions for Socket.IO | `socket/index.ts` | 🔜 Phase 2 |

### B2. Frontend Infrastructure

| # | Task | File | Status |
|---|------|------|--------|
| B2-01 | Axios instance với interceptors (auth + refresh token) | `services/api.ts` | ✅ Đã impl |
| B2-02 | React Query setup — provider + config | `main.tsx` | ✅ Đã impl |
| B2-03 | `useDebateSocket` hook — all debate socket events | `hooks/useDebateSocket.ts` | ⚠️ Partial: frontend hook có, backend debate socket còn stub |
| B2-04 | Debate store (Zustand) — phase, timer, turn, scores | `stores/debateStore.ts` | ✅ Đã impl |
| B2-05 | Toast notification system (react-hot-toast) | `App.tsx` | ✅ Đã impl trong main.tsx |
| B2-06 | Debate room layout — MainLayout vs DebateLayout routing | `layouts/DebateLayout.tsx` | ✅ Đã impl |
| B2-07 | Loading/error states cho tất cả pages | `components/common/LoadingScreen.tsx` | ⚠️ Partial |
| B2-08 | Type definitions cho socket events | `types/index.ts` | ⚠️ Partial: shared types có, socket event types chưa đầy đủ |

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
