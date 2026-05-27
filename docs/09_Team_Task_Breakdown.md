# 09 — Team Task Breakdown (Rút gọn)

**Phiên bản:** v1.1 | **Ngày:** 18/05/2026  
**Loại tài liệu:** Kế hoạch — task chi tiết từng developer (scope đã rút gọn)  
**Tham chiếu:** [06_Development_Plan_6Weeks.md](./06_Development_Plan_6Weeks.md) · [05_Use_Cases.md](./05_Use_Cases.md)

> Chuẩn debate: [01_Debate_Rule.md](./01_Debate_Rule.md) — **Cross Examination**, không POI.

---

## TỔNG QUAN PHÂN CÔNG

```
┌─────────────────────────────────────────────────────────────────┐
│                    5 DEVELOPERS - 6 WEEKS (~66 UC)              │
├──────────┬──────────────────────────────────────────────────────┤
│  Dev 1   │  Auth + User + ELO + Leaderboard                     │
│  Dev 2   │  Matchmaking + Custom Room + Debate Engine            │
│  Dev 3   │  Socket.IO + Timer + Chat + Cross Examination         │
│  Dev 4   │  AI BGK + Speech Analysis + Toxic Detection           │
│  Dev 5   │  Live Matches + Replay + Hỗ trợ Dev 2/3 (UI)         │
└──────────┴──────────────────────────────────────────────────────┘
```

Mỗi Dev làm **cả Frontend + Backend** của feature mình.

---

## DEV 1 — Auth, User, Ranking

### Tech Stack:
**Backend:** Express, JWT, bcryptjs, Mongoose, Zod  
**Frontend:** React, Zustand, React Query, React Hook Form, Zod, Recharts

---

### TUẦN 1 — Auth System

#### Backend:
- [ ] **[BE-1-01]** Setup Express + TypeScript project structure
- [ ] **[BE-1-02]** MongoDB connection + Mongoose config
- [ ] **[BE-1-03]** User model + schema
- [ ] **[BE-1-04]** Auth middleware: `verifyToken`, `checkRole`
- [ ] **[BE-1-05]** `POST /api/v1/auth/register`
- [ ] **[BE-1-06]** `POST /api/v1/auth/login`
- [ ] **[BE-1-07]** `POST /api/v1/auth/refresh-token`
- [ ] **[BE-1-08]** `GET /api/v1/auth/me`
- [ ] **[BE-1-09]** Rate limiting + Error handler middleware

#### Frontend:
- [ ] **[FE-1-01]** Setup React + TypeScript + Vite + Tailwind
- [ ] **[FE-1-02]** Zustand auth store
- [ ] **[FE-1-03]** Axios instance với interceptors
- [ ] **[FE-1-04]** Register page + form (Zod validation)
- [ ] **[FE-1-05]** Login page
- [ ] **[FE-1-06]** Protected route component
- [ ] **[FE-1-07]** Basic layout (Navbar)

---

### TUẦN 2 — Profile + ELO

#### Backend:
- [ ] **[BE-1-10]** `PUT /api/v1/users/:id/profile`
- [ ] **[BE-1-11]** `GET /api/v1/users/:id` (public profile)
- [ ] **[BE-1-12]** `GET /api/v1/users/:id/stats`
- [ ] **[BE-1-13]** ELO calculation service
- [ ] **[BE-1-14]** `GET /api/v1/rankings/leaderboard` (Global top 50)

#### Frontend:
- [ ] **[FE-1-08]** Profile page (view + edit)
- [ ] **[FE-1-09]** Avatar upload (URL input)
- [ ] **[FE-1-10]** Stats display (W/L, avg score)
- [ ] **[FE-1-11]** Leaderboard page

---

### TUẦN 3 — Ranking Full

#### Backend:
- [ ] **[BE-1-15]** ELO update sau mỗi debate
- [ ] **[BE-1-16]** Rank tier calculation
- [ ] **[BE-1-17]** Debate history per user

#### Frontend:
- [ ] **[FE-1-12]** ELO history chart (Recharts)
- [ ] **[FE-1-13]** Rank badge component
- [ ] **[FE-1-14]** Debate history table (paginated)

---

### TUẦN 4 — Stats + Polish

#### Backend:
- [ ] **[BE-1-18]** Aggregate stats từ DebateSessions
- [ ] **[BE-1-19]** ELO update trigger (called after debate ends)

#### Frontend:
- [ ] **[FE-1-15]** Full stats dashboard
- [ ] **[FE-1-16]** Account settings page (basic)

---

### TUẦN 5-6: Security + Deploy
- [ ] Security review (CORS, rate limit, input sanitization)
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Render
- [ ] Mobile responsive auth pages

---

## DEV 2 — Matchmaking + Custom Room + Debate Engine

### Tech Stack:
**Backend:** Express, Mongoose (DebateRoom, DebateSession), State Machine  
**Frontend:** React, Zustand (room store), React Query

---

### TUẦN 1 — Room Schema + Create

#### Backend:
- [ ] **[BE-2-01]** DebateRoom schema (roomType, Owner, Pro/Opp, host/judge config)
- [ ] **[BE-2-02]** DebateSession schema (phases, CE, turnHistory)
- [ ] **[BE-2-03]** MatchQueue schema
- [ ] **[BE-2-04]** `POST /api/v1/rooms/create` (UC-14)
- [ ] **[BE-2-05]** `GET /api/v1/rooms` (filters)
- [ ] **[BE-2-06]** `GET /api/v1/rooms/:id`

#### Frontend:
- [ ] **[FE-2-01]** Create Custom Room form
- [ ] **[FE-2-02]** Room card component
- [ ] **[FE-2-03]** Room filter component

---

### TUẦN 2 — Matchmaking + Lobby

#### Backend:
- [ ] **[BE-2-07]** `POST/DELETE /api/v1/matchmaking/queue` (UC-12)
- [ ] **[BE-2-08]** Matchmaking service + auto room (UC-13)
- [ ] **[BE-2-09]** `POST /api/v1/rooms/:id/join` (UC-17)
- [ ] **[BE-2-10]** `POST /api/v1/rooms/:id/position` + `/lock` (UC-18, UC-19)
- [ ] **[BE-2-11]** `POST /api/v1/rooms/:id/start` (UC-22)
- [ ] **[BE-2-12]** Turn order Pro S1→…→Opp S3 (UC-31)
- [ ] **[BE-2-13]** CE state machine (UC-32)

#### Frontend:
- [ ] **[FE-2-04]** Rank queue page
- [ ] **[FE-2-05]** Lobby: Select Position, Owner controls
- [ ] **[FE-2-06]** Join room + password modal
- [ ] **[FE-2-07]** Debate room layout + turn indicator

---

### TUẦN 3 — Host Controls + Judge Scoring

#### Backend:
- [ ] **[BE-2-14]** `POST .../host/pause` / `resume` (UC-44)
- [ ] **[BE-2-15]** `POST .../host/issue-card` — thẻ vàng (UC-45)
- [ ] **[BE-2-16]** `POST .../host/kick` (UC-46)
- [ ] **[BE-2-17]** `POST .../judge/submit-score` (UC-48)
- [ ] **[BE-2-18]** Score aggregation + winner (UC-50, UC-51)

#### Frontend:
- [ ] **[FE-2-08]** Host control panel
- [ ] **[FE-2-09]** Card modal (thẻ vàng + reason)
- [ ] **[FE-2-10]** Judge scoring form (6 tiêu chí §13)

---

### TUẦN 4 — Orchestration + Result

#### Backend:
- [ ] **[BE-2-19]** Debate engine 25 bước hoàn chỉnh (UC-41)
- [ ] **[BE-2-20]** Session persist `completed` + transcript (UC-39)
- [ ] **[BE-2-21]** ELO update trigger rank (UC-52)
- [ ] **[BE-2-22]** `GET /api/v1/rooms/:id/replay` (UC-66)

#### Frontend:
- [ ] **[FE-2-11]** Result announcement page
- [ ] **[FE-2-12]** Score breakdown display

---

### TUẦN 5-6: Polish + Deploy
- [ ] Edge cases: disconnect trong lượt nói
- [ ] Timer accuracy testing
- [ ] Mobile responsive debate UI
- [ ] Deploy backend to Render

---

## DEV 3 — Socket.IO + Timer + Cross Examination

### Tech Stack:
**Backend:** Socket.IO Server, Node.js intervals/timeouts, Mongoose  
**Frontend:** Socket.IO Client, Zustand (debate store)

---

### TUẦN 1 — Socket Setup

#### Backend:
- [ ] **[BE-3-01]** Socket.IO server setup
- [ ] **[BE-3-02]** Socket auth middleware (JWT on handshake)
- [ ] **[BE-3-03]** `room:join` / `room:leave` handlers
- [ ] **[BE-3-04]** Connection/disconnection handling
- [ ] **[BE-3-05]** Basic room state broadcast

#### Frontend:
- [ ] **[FE-3-01]** Socket.IO client setup
- [ ] **[FE-3-02]** useSocket hook
- [ ] **[FE-3-03]** Connection status indicator

---

### TUẦN 2 — Chat + Room Sync

#### Backend:
- [ ] **[BE-3-06]** `chat:send` handler (save + broadcast)
- [ ] **[BE-3-07]** `room:participant-update` broadcast
- [ ] **[BE-3-08]** `room:state-update` broadcast
- [ ] **[BE-3-09]** Message types (chat, system, announcement)

#### Frontend:
- [ ] **[FE-3-04]** Chat component (messages + input)
- [ ] **[FE-3-05]** Message bubble (different styles per type)
- [ ] **[FE-3-06]** Auto-scroll to latest message

---

### TUẦN 3 — Timer + Cross Examination

#### Backend:
- [ ] **[BE-3-10]** Server-side timer service (TimerService class)
- [ ] **[BE-3-11]** Timer tick broadcast (every 1 second)
- [ ] **[BE-3-12]** Phase events: prep_7, speech 4', cross_exam 3', judge_feedback, prep_1'
- [ ] **[BE-3-13]** `cross-exam:pass-turn` / `cross-exam:finish` handlers
- [ ] **[BE-3-14]** CE timer sync (trừ khi đội đang hỏi/trả lời)
- [ ] **[BE-3-15]** Penalty khi thiếu Q/A (§10.3)
- [ ] **[BE-3-16]** Auto next-turn when timer hits 0

#### Frontend:
- [ ] **[FE-3-07]** Countdown timer component
- [ ] **[FE-3-08]** Cross Examination panel (Pass Turn / Finish, quota)
- [ ] **[FE-3-09]** CE timer per team
- [ ] **[FE-3-10]** Phase indicator

---

### TUẦN 4 — Reconnection

#### Backend:
- [ ] **[BE-3-17]** Reconnection handler (restore timer + state)
- [ ] **[BE-3-18]** `room:rejoin` event
- [ ] **[BE-3-19]** Heartbeat / ping-pong
- [ ] **[BE-3-20]** Room cleanup

#### Frontend:
- [ ] **[FE-3-11]** Auto-reconnect logic
- [ ] **[FE-3-12]** "Reconnecting..." overlay
- [ ] **[FE-3-13]** State restoration after reconnect

---

### TUẦN 5-6: Stability + Deploy
- [ ] Load testing Socket.IO
- [ ] Memory leak check
- [ ] Event listener cleanup
- [ ] Chat pagination
- [ ] Production Socket.IO config

---

## DEV 4 — AI BGK + Analysis + Toxic

### Tech Stack:
**Backend:** OpenAI SDK, Prompt Engineering  
**Frontend:** React, AI display components, Recharts

---

### TUẦN 1 — AI Service Setup

#### Backend:
- [ ] **[BE-4-01]** OpenAI SDK setup + config
- [ ] **[BE-4-02]** AIService base class
- [ ] **[BE-4-03]** Prompt templates file
- [ ] **[BE-4-04]** `POST /api/v1/ai/analyze-speech` (basic)
- [ ] **[BE-4-05]** Error handling + retry logic
- [ ] **[BE-4-06]** Fallback responses (UC-63)

#### Frontend:
- [ ] **[FE-4-01]** AI Analysis panel skeleton
- [ ] **[FE-4-02]** Loading state (AI thinking...)
- [ ] **[FE-4-03]** Score display component

---

### TUẦN 2 — Speech Analysis Full

#### Backend:
- [ ] **[BE-4-07]** Full speech analysis prompt (claims, evidence, weaknesses, fallacies, score)
- [ ] **[BE-4-08]** `POST /api/v1/ai/score-argument`
- [ ] **[BE-4-09]** Response parsing + JSON validation

#### Frontend:
- [ ] **[FE-4-04]** AI Analysis panel full
- [ ] **[FE-4-05]** Score radar chart (Recharts)
- [ ] **[FE-4-06]** Fallacy indicators
- [ ] **[FE-4-07]** Strengths/Weaknesses list

---

### TUẦN 3 — Toxic Detection

#### Backend:
- [ ] **[BE-4-10]** `POST /api/v1/ai/check-toxic` (UC-62)
- [ ] **[BE-4-11]** Auto-moderate chat (hook into chat:send)

#### Frontend:
- [ ] **[FE-4-08]** Toxic message flag UI
- [ ] **[FE-4-09]** Moderation notification

---

### TUẦN 4 — AI BGK Full

#### Backend:
- [ ] **[BE-4-12]** AI BGK per-turn feedback (UC-58)
- [ ] **[BE-4-13]** AI BGK final verdict (UC-61)
- [ ] **[BE-4-14]** `POST /api/v1/ai/summarize-debate` (UC-60)
- [ ] **[BE-4-15]** Fallback khi OpenAI down (UC-63)

#### Frontend:
- [ ] **[FE-4-10]** AI BGK announcement UI
- [ ] **[FE-4-11]** AI verdict + summary panel
- [ ] **[FE-4-12]** AI per-turn feedback display

---

### TUẦN 5-6: Optimization + Deploy
- [ ] Prompt optimization (reduce tokens)
- [ ] AI response caching
- [ ] Error fallback testing
- [ ] OpenAI production key + rate limit
- [ ] Cost monitoring

---

## DEV 5 — Live Matches + Replay + UI Support

### Tech Stack:
**Backend:** Express, Mongoose  
**Frontend:** React, complex UI components, responsive design

---

### TUẦN 1 — Live Matches + Shared UI

#### Backend:
- [ ] **[BE-5-01]** `GET /api/v1/rooms` Live filters (UC-65)
- [ ] **[BE-5-02]** Replay schema (skeleton)

#### Frontend:
- [ ] **[FE-5-01]** Live Matches page (filter 1v1/3v3, rank/custom)
- [ ] **[FE-5-02]** Spectate button
- [ ] **[FE-5-03]** Shared UI components (buttons, modals, cards, badges)

---

### TUẦN 2 — Live Matches + Lobby UI Support

#### Backend:
- [ ] **[BE-5-03]** Viewer join policy

#### Frontend:
- [ ] **[FE-5-04]** Live Matches realtime refresh
- [ ] **[FE-5-05]** Hỗ trợ Dev 2: Lobby UI (position selector, team display)
- [ ] **[FE-5-06]** Hỗ trợ Dev 2: Room status indicators

---

### TUẦN 3 — Debate UI Support

#### Frontend (hỗ trợ Dev 2/3):
- [ ] **[FE-5-07]** Speech display component
- [ ] **[FE-5-08]** Score breakdown display
- [ ] **[FE-5-09]** Result announcement component
- [ ] **[FE-5-10]** Mobile responsive debate room

---

### TUẦN 4 — Replay

#### Backend:
- [ ] **[BE-5-04]** Replay data structure (transcript per turn)
- [ ] **[BE-5-05]** `GET /api/v1/rooms/:id/replay`

#### Frontend:
- [ ] **[FE-5-11]** Replay timeline + transcript viewer (UC-66)
- [ ] **[FE-5-12]** Replay navigation (jump to turn)

---

### TUẦN 5-6: Integration + Demo
- [ ] Cross-feature integration testing
- [ ] Responsive design check
- [ ] Error handling review
- [ ] Seed data (sample debates, users)
- [ ] Demo script + demo accounts

---

## DEPENDENCY MAP

```
Dev 1 (Auth) ─────────────────────────────────────────────┐
                                                           │
Dev 2 (Room) ──── depends on ──── Dev 1 (Auth middleware) │
                                                           │
Dev 3 (Socket) ── depends on ──── Dev 2 (Room state)      │
                                                           │
Dev 4 (AI) ─────── depends on ──── Dev 3 (speech events)  │
                                                           │
Dev 5 (UI/Live) ── depends on ─── Dev 2 (Room + completed)│
                                   Dev 1 (User auth)       │
└──────────────────────────────────────────────────────────┘
```

**Critical path:** Dev 1 → Dev 2 → Dev 3 → Dev 4

Dev 1 phải xong Auth middleware trước tuần 2 để các Dev khác dùng.

---

## COMMUNICATION PROTOCOL

### Daily Standup (async, Discord):
```
📅 [Date]
✅ Done: [what was completed]
🔨 Today: [what will be done]
🚧 Blocked: [any blockers]
```

### PR Template:
```
## What does this PR do?
[Brief description]

## UC liên quan
[UC-xx]

## How to test?
[Steps]

## Checklist
- [ ] TypeScript no errors
- [ ] Tested locally
- [ ] Responsive (if UI)
- [ ] No console.log left
```

---

## SO SÁNH V1.0 → V1.1

| Thay đổi | V1.0 | V1.1 |
|----------|------|------|
| Tổng UC | 110 | 66 |
| Dev 5 scope | Community feed + Tournament + Thread | Live Matches + Replay + UI support |
| AI features | 12 UC (Host, BGK, coaching, validate CE...) | 6 UC (BGK, analysis, toxic, summary, fallback) |
| Community | Posts, vote, comment, thread comments | Không có (Phase 2) |
| Tournament | Hub + register + bracket | Không có (Phase 2) |
| Host controls | 7 UC | 4 UC (pause, thẻ vàng, kick, mute) |
| Leaderboard | Global + Weekly + Monthly + Yearly | Global only |
