# 06 — Development Plan (6 tuần) — Rút gọn

**Phiên bản:** v1.1 | **Ngày:** 18/05/2026  
**Loại tài liệu:** Kế hoạch triển khai — 5 developers, scope đã rút gọn  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) · [03_Role_System.md](./03_Role_System.md) · [05_Use_Cases.md](./05_Use_Cases.md)

---

## PHẠM VI MVP (6 tuần) — ĐÃ RÚT GỌN

| Trong MVP (~66 UC) | Sau MVP — Phase 2 |
|---------------------|-------------------|
| Auth cơ bản (register, login, logout, refresh, me, RBAC) | Quên/đặt lại/đổi mật khẩu |
| Profile + Stats (view, edit, W/L, lịch sử) | Portfolio, AI Badges, Credibility |
| Rank queue + Custom Room + Live Matches | Challenge/Duel, Tournament bracket |
| Debate engine đủ 25 bước + CE | AI Host (dùng auto-timer thay) |
| Host controls tối thiểu (pause, thẻ vàng, kick) | Thẻ đỏ, override timer, chuyển host |
| AI BGK + phân tích + toxic + tóm tắt + fallback | AI gợi ý phản biện, coaching, validate CE |
| Realtime (timer, chat, reconnect) | Typing indicator, online presence |
| ELO + Leaderboard Global | Leaderboard mùa, badge mùa |
| Live Matches + Replay | Community feed, Debate Thread comments |

**Chuẩn luật:** [01_Debate_Rule.md](./01_Debate_Rule.md) — Proposition/Opposition, Prep **7'**, Speech **4'**, **Cross Examination** (không POI).

---

## PHÂN CÔNG NHÂN SỰ

Mỗi developer phụ trách **cả Frontend + Backend** của feature mình.

| Dev | Feature Chính | Độ phức tạp |
|-----|--------------|-------------|
| **Dev 1** | Auth + User + ELO + Leaderboard | ⭐⭐⭐ |
| **Dev 2** | Matchmaking + Custom Room + Debate Engine | ⭐⭐⭐⭐⭐ |
| **Dev 3** | Socket.IO + Timer + Chat + Cross Examination | ⭐⭐⭐⭐⭐ |
| **Dev 4** | AI BGK + Speech Analysis + Toxic Detection | ⭐⭐⭐⭐ |
| **Dev 5** | Live Matches + Replay + Hỗ trợ Dev 2/3 (UI) | ⭐⭐⭐ |

> **Thay đổi so với v1.0:** Dev 5 không còn làm community feed / tournament bracket. Thay vào đó hỗ trợ Dev 2 và Dev 3 ở phần Debate UI phức tạp + Live Matches + Replay.

---

## TIMELINE 6 TUẦN

---

## TUẦN 1 (14/05 - 20/05): PROJECT SETUP + AUTH + DATABASE

### Mục tiêu:
- Setup toàn bộ project structure
- Auth system hoàn chỉnh
- Database schemas xong
- Team có thể chạy local

---

### Dev 1 — Auth System
**Backend:**
- [ ] Setup Express + TypeScript + Mongoose
- [ ] User schema + model
- [ ] `POST /api/v1/auth/register` (validate, hash, JWT)
- [ ] `POST /api/v1/auth/login` (verify, tokens)
- [ ] `POST /api/v1/auth/refresh-token`
- [ ] `GET /api/v1/auth/me` (protected route)
- [ ] Auth middleware (verifyToken, checkRole)
- [ ] Rate limiting middleware
- [ ] Error handler middleware (global)

**Frontend:**
- [ ] Setup React + TypeScript + Vite + Tailwind
- [ ] Zustand auth store
- [ ] Register page + form validation (Zod)
- [ ] Login page
- [ ] Protected route wrapper
- [ ] Axios instance với interceptors (auto attach token, refresh on 401)
- [ ] Basic layout (Navbar)

---

### Dev 2 — Database Design + Room Schema
**Backend:**
- [ ] DebateRoom schema (roomType, Owner, host/judge config, Pro/Opp teams)
- [ ] DebateSession schema (phase, CE state, turn history)
- [ ] MatchQueue schema (rank)
- [ ] `POST /api/v1/rooms/create` (Custom — UC-14)
- [ ] `GET /api/v1/rooms` (filters: live, format, rank/custom)
- [ ] `GET /api/v1/rooms/:id`

**Frontend:**
- [ ] Create Custom Room form (format, Host/Judge AI/Human, password)
- [ ] Room card component

---

### Dev 3 — Socket.IO Setup
**Backend:**
- [ ] Socket.IO server setup (attach to Express)
- [ ] Basic room join/leave events
- [ ] Connection/disconnection handling
- [ ] Socket auth middleware (verify JWT on connect)

**Frontend:**
- [ ] Socket.IO client setup
- [ ] useSocket hook
- [ ] Connection status indicator

---

### Dev 4 — AI Service Setup
**Backend:**
- [ ] OpenAI SDK setup + config
- [ ] AI service base class
- [ ] `POST /api/v1/ai/analyze-speech` (basic version)
- [ ] Prompt templates file
- [ ] Error handling + fallback responses

**Frontend:**
- [ ] AI analysis display component (skeleton)
- [ ] Loading state component

---

### Dev 5 — Live Matches + Hỗ trợ Setup
**Backend:**
- [ ] `GET /api/v1/rooms` Live filters (UC-25/65)
- [ ] Replay schema (skeleton)

**Frontend:**
- [ ] Live Matches page (filter 1v1/3v3, rank/custom)
- [ ] Spectate button
- [ ] Hỗ trợ Dev 1: shared UI components (buttons, modals, cards)

---

### Shared Tasks Tuần 1:
- [ ] **All**: Setup Git repo, branches, .env files
- [ ] **All**: Agree on shared TypeScript types
- [ ] **All**: Setup ESLint + Prettier
- [ ] **Dev 1**: Setup MongoDB Atlas + connection string
- [ ] **Dev 1**: Create base folder structure

**Deadline: 20/05 EOD**

---

## TUẦN 2 (21/05 - 27/05): MATCHMAKING + LOBBY + REALTIME BASE

### Mục tiêu:
- Rank queue + ghép trận cơ bản
- Custom room: join, Select Position, lobby
- Socket chat + room sync

---

### Dev 1 — User Profile + ELO
**Backend:**
- [ ] `PUT /api/v1/users/:id/profile`
- [ ] `GET /api/v1/users/:id/stats`
- [ ] ELO calculation service
- [ ] `GET /api/v1/rankings/leaderboard` (Global top 50)

**Frontend:**
- [ ] Profile page (view + edit)
- [ ] Stats display (W/L, avg score)
- [ ] Leaderboard page

---

### Dev 2 — Matchmaking + Room Lobby
**Backend:**
- [ ] `POST/DELETE /api/v1/matchmaking/queue` (UC-12)
- [ ] Matchmaking service + auto room (UC-13)
- [ ] `POST /api/v1/rooms/:id/join` (UC-17)
- [ ] `POST /api/v1/rooms/:id/position` + `/position/lock` (UC-18, UC-19)
- [ ] `POST /api/v1/rooms/:id/start` (UC-22)
- [ ] Turn order Pro S1→…→Opp S3 (UC-31)
- [ ] CE state machine Pass Turn / Finish (UC-32)

**Frontend:**
- [ ] Rank queue UI (1v1 / 3v3)
- [ ] Lobby: Select Position, Owner controls
- [ ] Debate room layout + turn indicator

---

### Dev 3 — Realtime Chat + Room Sync
**Backend:**
- [ ] `chat:send` event + save to DB + broadcast
- [ ] `room:participant-update` broadcast
- [ ] `room:state-update` broadcast
- [ ] Message types (chat, system, announcement)

**Frontend:**
- [ ] Chat component (messages list + input)
- [ ] Participant list (realtime update)
- [ ] Message types styling

---

### Dev 4 — AI Speech Analysis Full
**Backend:**
- [ ] Full speech analysis prompt (claims, evidence, weaknesses, fallacies, score)
- [ ] `POST /api/v1/ai/score-argument`
- [ ] Response parsing + JSON validation

**Frontend:**
- [ ] AI Analysis panel (claims, evidence, weaknesses)
- [ ] Score display (radar chart hoặc bar)
- [ ] Fallacy indicators

---

### Dev 5 — Live Matches + Debate UI Support
**Backend:**
- [ ] Viewer join policy (UC-42)

**Frontend:**
- [ ] Live Matches page hoàn chỉnh (realtime refresh)
- [ ] Spectate flow (Viewer)
- [ ] Hỗ trợ Dev 2: Lobby UI components, position selector

**Deadline: 27/05 EOD**

---

## TUẦN 3 (28/05 - 03/06): DEBATE ENGINE + TIMER + CROSS EXAMINATION

### Mục tiêu:
- Debate flow hoàn chỉnh end-to-end
- Timer sync chính xác
- Cross Examination system
- Host controls

---

### Dev 1 — Ranking Full
**Backend:**
- [ ] ELO update sau mỗi debate
- [ ] Rank tier calculation (Novice → GrandMaster)
- [ ] Debate history per user

**Frontend:**
- [ ] ELO history chart (Recharts)
- [ ] Rank badge component
- [ ] Debate history table (paginated)

---

### Dev 2 — Host Controls + Judge Scoring
**Backend:**
- [ ] `POST .../host/pause` / `resume` (UC-44)
- [ ] `POST .../host/issue-card` — thẻ vàng (UC-45)
- [ ] `POST .../host/kick` (UC-46)
- [ ] `POST .../judge/submit-score` (UC-48)
- [ ] Score aggregation + winner (UC-50, UC-51)

**Frontend:**
- [ ] Host control panel (pause, resume)
- [ ] Card modal (thẻ vàng + reason)
- [ ] Kick modal
- [ ] Judge scoring form (6 tiêu chí §13)

---

### Dev 3 — Timer System + Cross Examination
**Backend:**
- [ ] Server-side timer (authoritative)
- [ ] Timer tick broadcast mỗi giây
- [ ] Phase events: prep_7, speech 4', cross_exam 3', judge_feedback, prep_1'
- [ ] `cross-exam:pass-turn` / `cross-exam:finish` handlers
- [ ] Auto chuyển phase khi hết giờ

**Frontend:**
- [ ] Countdown timer component
- [ ] Cross Examination panel (Pass Turn / Finish, quota 2 câu)
- [ ] Phase indicator (speech / cross_exam / judge_feedback)
- [ ] Private room switch UI (prep phases)

---

### Dev 4 — AI Toxic Detection
**Backend:**
- [ ] `POST /api/v1/ai/check-toxic` (UC-62)
- [ ] Auto-moderate chat messages (hook into chat:send)

**Frontend:**
- [ ] Toxic message flag UI
- [ ] Moderation notification

---

### Dev 5 — Debate UI Components
**Frontend (hỗ trợ Dev 2/3):**
- [ ] Speech display component (who's speaking, timer)
- [ ] Score breakdown display
- [ ] Result announcement component
- [ ] Mobile responsive debate room layout

**Deadline: 03/06 EOD**

---

## TUẦN 4 (04/06 - 10/06): AI BGK + SCORING + INTEGRATION

### Mục tiêu:
- AI BGK hoàn chỉnh
- Scoring system hoàn chỉnh
- Tích hợp các features

---

### Dev 1 — Stats Dashboard
**Backend:**
- [ ] Aggregate stats từ DebateSessions
- [ ] Performance analytics per user

**Frontend:**
- [ ] Full stats dashboard
- [ ] Debate history với filter

---

### Dev 2 — Orchestration + Result + Replay
**Backend:**
- [ ] Debate engine 25 bước hoàn chỉnh (UC-41)
- [ ] Result calculation (UC-50–51)
- [ ] Session persist `completed` + transcript (UC-39)
- [ ] ELO update trigger rank (UC-52)
- [ ] `GET /api/v1/rooms/:id/replay` (UC-66)

**Frontend:**
- [ ] Result announcement page (UC-38)
- [ ] Score breakdown (6 tiêu chí)

---

### Dev 3 — Reconnection + State Recovery
**Backend:**
- [ ] Reconnect handler (restore timer + state) (UC-56)
- [ ] Heartbeat / ping-pong
- [ ] Room cleanup khi tất cả disconnect

**Frontend:**
- [ ] Auto-reconnect logic
- [ ] "Reconnecting..." UI state
- [ ] State restoration sau reconnect

---

### Dev 4 — AI BGK Full
**Backend:**
- [ ] AI BGK per-turn feedback (UC-58)
- [ ] AI BGK final verdict (UC-61)
- [ ] `POST /api/v1/ai/summarize-debate` (UC-60)
- [ ] Fallback khi OpenAI down (UC-63)

**Frontend:**
- [ ] AI BGK announcement UI
- [ ] AI verdict + summary panel
- [ ] AI analysis per-turn display

---

### Dev 5 — Replay + Integration
**Backend:**
- [ ] Replay data structure (transcript per turn)

**Frontend:**
- [ ] Replay timeline + transcript viewer (UC-66)
- [ ] Integration testing với Dev 2/3/4

**Deadline: 10/06 EOD**

---

## TUẦN 5 (11/06 - 17/06): POLISH + TESTING

### Mục tiêu:
- Tất cả features tích hợp hoàn chỉnh
- Bug fixing
- UI/UX polish

---

### Dev 1 — Auth + Security Polish
- [ ] Security: rate limiting, input sanitization review
- [ ] CORS configuration production
- [ ] Account settings page (basic)

### Dev 2 — Debate Engine Polish
- [ ] Edge cases: disconnect trong lượt nói
- [ ] Timer accuracy testing
- [ ] Host controls edge cases
- [ ] Mobile responsive

### Dev 3 — Realtime Stability
- [ ] Load testing Socket.IO
- [ ] Memory leak check
- [ ] Event listener cleanup
- [ ] Chat pagination (load older messages)

### Dev 4 — AI Optimization
- [ ] Prompt optimization (reduce tokens, improve accuracy)
- [ ] AI response caching
- [ ] Error fallback testing
- [ ] AI analysis loading states

### Dev 5 — UI Polish + Testing
- [ ] Cross-feature integration testing
- [ ] Responsive design check (mobile/tablet)
- [ ] Error handling review (empty states, loading states)
- [ ] Live Matches polish

### Shared Tasks:
- [ ] **All**: Integration testing end-to-end
- [ ] **All**: Responsive design
- [ ] **All**: Error states + loading states
- [ ] **Dev 2**: API documentation (Postman collection)

**Deadline: 17/06 EOD**

---

## TUẦN 6 (18/06 - 24/06): DEPLOYMENT + DEMO

### Mục tiêu:
- Deploy production
- Demo flow hoàn chỉnh

---

### Dev 1 — Deploy Frontend
- [ ] Vercel deployment
- [ ] Environment variables production
- [ ] Build optimization

### Dev 2 — Deploy Backend
- [ ] Render deployment
- [ ] Production environment config
- [ ] MongoDB Atlas production
- [ ] Health check endpoint

### Dev 3 — Production Socket.IO
- [ ] Socket.IO production config (CORS, transport)
- [ ] Connection stress test

### Dev 4 — AI Production
- [ ] OpenAI API key production
- [ ] Rate limit handling
- [ ] Cost monitoring

### Dev 5 — Demo Preparation
- [ ] Seed data (sample debates, users)
- [ ] Demo script preparation
- [ ] Demo account setup

### Shared Tasks:
- [ ] **All**: Final bug fixes
- [ ] **All**: Demo rehearsal (22/06)
- [ ] **All**: README documentation
- [ ] **All**: Final presentation (23-24/06)

**Deadline: 24/06 EOD**

---

## MILESTONE SUMMARY

| Milestone | Deadline | Deliverable |
|-----------|----------|-------------|
| **M1: Foundation** | 20/05 | Auth, DB schemas, Socket setup, project structure |
| **M2: Rooms + Matchmaking** | 27/05 | Rank queue, Custom lobby, Live Matches, chat |
| **M3: Debate Engine** | 03/06 | 25-step flow, timer, Cross Examination, host controls |
| **M4: AI + Results** | 10/06 | AI BGK, scoring, ELO, replay |
| **M5: Polish** | 17/06 | Integration, testing, responsive, optimization |
| **M6: Production** | 24/06 | Deployed, demo-ready |

---

## DEMO FOCUS

**Demo chính:** Custom Room → 1 trận 1v1 đầy đủ:
1. Tạo phòng → Join → Select Position → Start
2. Motion → Prep 7' → Speech → CE → BGK AI chấm
3. Closing → Final Verdict → Kết quả + ELO update
4. Leaderboard hiển thị

Đây đủ để showcase toàn bộ core product.

---

## RISK MANAGEMENT

| Risk | Khả năng | Impact | Mitigation |
|------|----------|--------|------------|
| OpenAI API rate limit | Trung bình | Cao | Cache responses, fallback messages |
| Socket.IO sync issues | Cao | Cao | Server-authoritative timer, thorough testing |
| Scope creep | ~~Cao~~ Thấp | — | **Scope đã lock — không thêm feature** |
| Integration conflicts | Trung bình | Trung bình | Daily sync, shared TypeScript types |
| Deployment issues | Thấp | Cao | Deploy early (tuần 5), không đợi tuần 6 |

---

## GIT WORKFLOW

```
1. Pull develop mới nhất
2. Tạo branch: feature/[dev-name]-[feature]
3. Commit thường xuyên (ít nhất 1 lần/ngày)
4. Tạo PR vào develop khi xong feature
5. Code review (ít nhất 1 người review)
6. Merge vào develop
7. Cuối tuần: merge develop → main (staging)
```

---

## DEFINITION OF DONE

Một feature được coi là **Done** khi:
- [ ] Backend API hoạt động và tested (Postman)
- [ ] Frontend UI hoàn chỉnh và responsive
- [ ] Realtime events hoạt động (nếu có)
- [ ] Error states + Loading states được handle
- [ ] Code được review bởi ít nhất 1 người
- [ ] Không có TypeScript errors
- [ ] Merge vào develop thành công
