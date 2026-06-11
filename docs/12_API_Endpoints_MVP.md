# 12 — API Endpoints MVP

## Current Delivered Scope - Full Summary

This is the full implementation currently reflected in source code, including Dev 2 work plus related room, judge, host, player action, and frontend integration updates:

### Backend REST APIs

| Area | Endpoints / Behavior | Status |
|------|----------------------|--------|
| Matchmaking | `POST /matchmaking/queue`, `DELETE /matchmaking/queue`, `GET /matchmaking/status`; auto-creates active rank room and `DebateSession`; matched status returns `roomId`. | Done |
| Custom rooms | `POST /rooms/create`, `GET /rooms`, `GET /rooms/:id`, `PUT /rooms/:id`, `DELETE /rooms/:id`, `POST /rooms/:id/join`, `POST /rooms/:id/leave`. | Done |
| Lobby assignment | `POST /rooms/:id/assign-role`; owner assigns `debater`, `host`, `judge`, `viewer`; debater assignment may include `team` and `speakerSlot`. | Done |
| Position flow | `POST /rooms/:id/position`; only assigned debaters can self-select team/slot. `POST /rooms/:id/position/lock` and `/rooms/:id/lock` lock debaters only. | Done |
| Start debate | `POST /rooms/:id/start`; validates filled/locked debater slots, requires assigned human host when room uses human host, creates session, activates room. | Done |
| Debate engine | `POST /debate/:roomId/next-turn`, `/finish-phase`, `/end`, `GET /debate/:roomId/session`, `GET /debate/:roomId/replay`. | Done |
| Cross examination | `POST /debate/:roomId/ce/pass-turn`, `POST /debate/:roomId/ce/finish`; CE state/quota are persisted in `DebateSession.currentTurn.ceState`. | Done |
| Host controls | Pause/resume/card/kick remain available to assigned host through debate routes. | Done |
| Judge scoring | `POST /debate/:roomId/judge/submit-score`; backend enforces assigned judge only. Scores can be read via scores endpoints. | Done |
| Player actions | `POST /debate/:roomId/surrender` for đầu hàng; `POST /debate/:roomId/draw/request` for cầu hòa. Opponent also requesting draw completes match as `draw`. | Done |
| Completion/ranking | Debate completion stores final scores/winner and applies ranking when eligible for rank rooms. | Done |

### Frontend Screens

| Screen | Implemented behavior | Status |
|--------|----------------------|--------|
| `/matchmaking` | Ranked queue, leave queue, matched room auto-entry. | Done |
| `/matches` | Room list, filters, room cards, private join modal. | Done |
| `/rooms/create` | Custom room creation form. | Done |
| `/rooms/:roomId/lobby` | Owner role assignment, debater position selection, lock debaters, start debate. | Done |
| `/debate/:roomId` | Team layout, phase/turn/timer display, host controls for assigned host, CE panel, judge-only scoring, score breakdown, debater gear menu for đầu hàng/cầu hòa, completed-state `Thoát phòng`. | Done |
| `/replay/:sessionId` | Basic result/replay display from replay payload. | Done |

### Dev 3 Boundary

The current delivery is REST-first. Socket.IO realtime polish remains Dev 3 scope: timer broadcasts, live role/phase/CE synchronization, surrender/draw notifications, chat transcript capture, reconnect/disconnect behavior, and post-match presence cleanup.

---

## Implementation Update - Dev 2, June 11 2026

Latest Dev 2 changes implemented in code:

### Custom Room Lobby Role Assignment

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/rooms/:id/assign-role` | Done | Owner assigns each participant as `debater`, `host`, `judge`, or `viewer`. When assigning `debater`, owner can also set `team` and `speakerSlot`. |
| POST | `/rooms/:id/position` | Done | Only participants already assigned as `debater` can update their own `team` and `speakerSlot`. Viewers/hosts/judges are blocked. |
| POST | `/rooms/:id/position/lock` | Done | Locks only debater positions; host/viewer/judge are not position-locked. |
| POST | `/rooms/:id/start` | Done | Requires filled/locked debater slots and, for human-host rooms, an assigned `hostId`. |

Room detail now hydrates participant display names and avatars from `User`, so custom rooms show real usernames/display names instead of hardcoded `Owner` / `User`.

### Debate Player Actions

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/debate/:roomId/surrender` | Done | Assigned debater forfeits; debate completes and the opposing team wins. |
| POST | `/debate/:roomId/draw/request` | Done | Assigned debater requests a draw. If the opposite team also requests a draw, debate completes as `draw`. |

### Debate UI Permissions

- `Host Controls` are shown only to the assigned host (`room.hostId`), not automatically to the room owner.
- `Judge Scoring` is shown only to participants with `roomRole === 'judge'`; the API also enforces this.
- Debaters see a gear menu during active/paused debates for `Surrender` and `Request Draw`.
- When a debate is completed, users see `Thoát phòng`, which leaves the room and navigates back to `/matches`.

---

## Implementation Update - Dev 2, June 10 2026

This section reflects the current implemented code for Dev 2 and should be used when older sections below are out of date.

### Runtime URLs

- Backend API: `http://localhost:4300/api/v1`
- Backend health: `http://localhost:4300/health`
- Frontend Vite: `http://localhost:5173`

### Matchmaking

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/matchmaking/queue` | Done | Joins ranked queue. Response includes `roomId` when matched. |
| DELETE | `/matchmaking/queue` | Done | Cancels both `waiting` and `matched` queue entries. |
| GET | `/matchmaking/status` | Done | Returns `idle`, `waiting`, or `matched`; matched payload includes `roomId`. |

When enough players are matched, backend creates an active rank room, creates a `DebateSession`, locks speaker positions, updates queue entries to `matched`, and emits `match:found`.

### Room

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/rooms/:id/start` | Done | Validates locked debater positions, creates `DebateSession`, sets room active. |
| POST | `/rooms/:id/position/lock` | Done | Owner locks positions. |
| POST | `/rooms/:id/lock` | Done | Alias for `/rooms/:id/position/lock`. |

### Debate Engine

| Method | Endpoint | Status | Notes |
|--------|----------|--------|-------|
| POST | `/debate/:roomId/next-turn` | Done | Advances through the REST debate state machine. |
| POST | `/debate/:roomId/finish-phase` | Done | Finishes current phase and enters the next step. |
| POST | `/debate/:roomId/ce/pass-turn` | Done | CE asking team passes turn; enforces quota. |
| POST | `/debate/:roomId/ce/finish` | Done | Finishes CE early and advances phase. |
| POST | `/debate/:roomId/end` | Done | Completes debate, aggregates scores, applies ranking when eligible. |
| GET | `/debate/:roomId/session` | Done | Returns current turn, phase, timer, CE state, history, scores. |
| GET | `/debate/:roomId/replay` | Done | Returns room + session replay payload. |

Legacy room-scoped endpoints still exist for compatibility: `/rooms/:id/session`, `/rooms/:id/replay`, `/rooms/:id/cross-exam/pass-turn`, `/rooms/:id/cross-exam/finish`, `/rooms/:id/judge/submit-score`, `/rooms/:id/scores`, `/rooms/:id/result`.

### Frontend Dev 2 Screens

- `/matchmaking`: ranked queue, leave queue, auto-enter debate when matched.
- `/rooms/create`: custom room form.
- `/matches`: room list, filters, join modal.
- `/rooms/:roomId/lobby`: participant list, position selection, lock/start controls.
- `/debate/:roomId`: debate layout, host controls, CE panel, judge scoring, score breakdown.
- `/replay/:sessionId`: replay/result display; currently expects a room/session id compatible with replay endpoint.

### Verification

- `backend`: `npm run build` passes.
- `frontend`: `npm run build` passes.

Realtime Socket.IO polish remains Dev 3 scope: timer sync, live phase broadcasts, CE broadcasts, chat transcript capture, reconnect/disconnect handling.

---

**Phiên bản:** v1.1 | **Ngày:** 25/05/2026
**Loại tài liệu:** Danh sách API Backend — phạm vi MVP
**Tham chiếu:** [05_Use_Cases.md](./05_Use_Cases.md) · [04_TRD](./04_TRD_Technical_Requirements.md) · [08_Socket](./08_Socket_Realtime_Guide.md)

---

## 1. Tổng quan

| Nhóm | Số endpoint REST | Trạng thái | Ghi chú |
|------|-----------------|------------|---------|
| A. Auth | 5 | ✅ Đã impl | |
| B. User/Profile | 4 / 4 impl | ✅ Complete | Search + history đã impl |
| C. Matchmaking | 3 route impl + matcher | ✅ Complete | Queue, cancel, status, auto-create rank room + `match:found` |
| D. Room | 12 / 12 impl | ✅ Complete | CRUD, join/leave, position, assign-role, kick, start |
| E. Host Controls | 6 / 6 impl | ✅ Complete | Đã có `/rooms/:id/host/*`; legacy `/debate/:id/host/*` vẫn còn |
| F. Cross Exam | 2 REST / 2 socket partial | ✅ REST complete | `pass-turn`, `finish` đã impl REST |
| G. Judge/Scoring | 3 / 3 impl | ✅ Complete | Submit score, scores, apply result |
| H. AI | 4 / 6 impl | ⚠️ Incomplete | Thiếu judge-turn + final-verdict |
| I. Ranking | 2 + service hook | ✅ Đã impl | Leaderboard/user rank + ELO apply flow |
| **Tổng REST** | **Dev 2 scope complete** | **⚠️ Partial overall** | AI/socket polish ngoài Dev 2 còn mục stub/missing |
| Socket events | ~20 | ⚠️ Cần xem 08_Socket | Bidirectional |

---

## 2. Base URL

```
Development: http://localhost:3000/api/v1
Production:  https://<domain>/api/v1
```

---

## 3. Chi tiết API

### A. Authentication (UC-01 → UC-06) — ✅ Đã impl

**File:** `src/features/auth/auth.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 1 | POST | `/auth/register` | Đăng ký tài khoản | Guest | `{ username, email, password }` | ✅ |
| 2 | POST | `/auth/login` | Đăng nhập → access + refresh token | Guest/User | `{ email, password }` | ✅ |
| 3 | POST | `/auth/logout` | Đăng xuất (invalidate refresh token) | User | Header: Bearer token | ✅ |
| 4 | POST | `/auth/refresh-token` | Làm mới access token | User | `{ refreshToken }` | ✅ |
| 5 | GET | `/auth/me` | Lấy thông tin phiên hiện tại | User | Header: Bearer token | ✅ |

**Response chuẩn:**
```json
{
  "success": true,
  "data": { ... },
  "message": "..."
}
```

---

### B. User / Profile / Stats (UC-07 → UC-11)

**File:** `src/features/user/user.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 6 | GET | `/users/:id` | Xem hồ sơ công khai | Guest/User | — | ✅ |
| 7 | PUT | `/users/:id/profile` | Cập nhật hồ sơ | User (owner) | `{ displayName?, bio?, school?, avatar?, club? }` | ✅ |
| 8 | GET | `/users/:id/stats` | Xem thống kê (W/L, điểm TB, ELO) | Guest/User | — | ✅ |
| 9 | GET | `/users/:id/history` | Xem lịch sử tranh biện | Guest/User | Query: `?page=&limit=` | ✅ |
| 10 | GET | `/users/search?q=` | Tìm user theo username/displayName | User | Query: `?q=` | ✅ |

> `GET /users/:id/history` hiện query từ `DebateRoom.status = completed` + `participants`, sau đó join `DebateSession.finalScores` để shape kết quả win/loss/draw tối thiểu cho frontend.

---

### C. Matchmaking — Rank (UC-12 → UC-13) — ✅ Complete

**File:** `src/features/matchmaking/matchmaking.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 10 | POST | `/matchmaking/queue` | Xếp hàng Rank | User | `{ format: '1v1' \| '3v3' }` | ✅ |
| 11 | DELETE | `/matchmaking/queue` | Hủy queue | User | — | ✅ |
| 12 | GET | `/matchmaking/status` | Trạng thái queue hiện tại | User | — | ✅ |

> **Lưu ý:** 3 REST endpoints đã có. Ghép trận (UC-13) đã có matcher service: tạo rank room + DebateSession, cập nhật queue matched, emit `match:found`.

---

### D. Room — Custom + Live Matches (UC-14 → UC-25)

**File:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 13 | POST | `/rooms/create` | Tạo Custom Room | User → Owner | `{ title, format, hostType, judgeType, judgeCount, isPrivate, password? }` | ✅ |
| 14 | GET | `/rooms` | Duyệt Live Matches | Guest/User | Query: `?status=&format=&roomType=&page=&limit=` | ✅ |
| 15 | GET | `/rooms/:id` | Chi tiết phòng | User | — | ✅ |
| 16 | PUT | `/rooms/:id` | Chỉnh sửa cấu hình phòng (lobby) | Owner | `{ title?, format?, hostType?, judgeType?, isPrivate?, password? }` | ✅ |
| 17 | DELETE | `/rooms/:id` | Hủy / xóa phòng (lobby only) | Owner | — | ✅ |
| 18 | POST | `/rooms/:id/join` | Join phòng | User | `{ password? }` | ✅ |
| 19 | POST | `/rooms/:id/leave` | Rời phòng | Participant | — | ✅ |
| 20 | POST | `/rooms/:id/position` | Select Position | User | `{ team: 'proposition'\|'opposition', speakerSlot: 'S1'\|'S2'\|'S3', role?: 'debater'\|'judge'\|'host' }` | ✅ |
| 21 | POST | `/rooms/:id/position/lock` | Lock position | Owner | — | ✅ |
| 22 | POST | `/rooms/:id/assign-role` | Gán slot Host / Judge (human) | Owner | `{ userId, role: 'host'\|'judge' }` | ✅ |
| 23 | POST | `/rooms/:id/kick` | Kick / ban (lobby) | Owner | `{ userId, reason? }` | ✅ |
| 24 | POST | `/rooms/:id/start` | Start trận | Owner/Host | — | ✅ |

---

### E. Debate Session + Host Controls (UC-26 → UC-47)

#### E1. Host Controls (UC-44 → UC-47)

> ✅ Các endpoint host controls đã có ở `/rooms/:id/host/*`. Legacy `/debate/:roomId/host/*` vẫn còn để tương thích.

**File target:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 25 | POST | `/rooms/:id/host/pause` | Tạm dừng trận (UC-44) | Host | — | ✅ |
| 26 | POST | `/rooms/:id/host/resume` | Tiếp tục trận | Host | — | ✅ |
| 27 | POST | `/rooms/:id/host/next-turn` | Chuyển lượt tiếp theo (UC-45) | Host | — | ✅ |
| 28 | POST | `/rooms/:id/host/issue-card` | Phát thẻ vàng | Host | `{ userId, reason }` | ✅ |
| 29 | POST | `/rooms/:id/host/kick` | Kick participant (UC-46) | Host | `{ userId, reason? }` | ✅ |
| 30 | POST | `/rooms/:id/host/mute` | Mute / cấm chat (UC-47) | Host | `{ userId, type: 'mute'\|'unmute' }` | ✅ |

#### E2. Session & Replay

**File target:** `src/features/debate/debate.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 31 | GET | `/rooms/:id/session` | Trạng thái session (phase, turn, timer) | Participant/Viewer | — | ✅ |
| 32 | GET | `/rooms/:id/replay` | Replay trận (UC-66) | User | — | ✅ |

---

### F. Cross Examination (UC-32 → UC-33)

**File target:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 33 | POST | `/rooms/:id/cross-exam/pass-turn` | Pass Turn trong CE (UC-32) | Debator | — | ✅ |
| 34 | POST | `/rooms/:id/cross-exam/finish` | Finish CE sớm (UC-32) | Debator | — | ✅ |

> Ghi chú: REST endpoints đã impl. Socket events `cross-exam:pass-turn` và `cross-exam:finish` có tồn tại nhưng vẫn cần polish realtime.

---

### G. Judge / Scoring (UC-48 → UC-52)

**File target:** `src/features/debate/debate.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 35 | POST | `/rooms/:id/judge/submit-score` | Nộp điểm (6 tiêu chí / 100) (UC-48) | Judge (human) | `{ speaker, logic, rebuttal, evidence, crossExam, strategy, communication, notes? }` | ✅ |
| 36 | GET | `/rooms/:id/scores` | Xem điểm tổng hợp (judges + AI) (UC-49–50) | Participant/Viewer | — | ✅ |
| 37 | POST | `/rooms/:id/result` | Apply kết quả trận rank vào ELO/tier | Owner/Host | — | ✅ |

---

### H. AI (UC-58 → UC-63)

**File:** `src/features/ai/ai.routes.ts` + `src/features/ai/ai.service.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 38 | POST | `/ai/analyze-speech` | Phân tích speech (claims, weaknesses, fallacies) (UC-59) | System (internal) | `{ speech, motion, team, speakerSlot }` | ✅ |
| 39 | POST | `/ai/score-argument` | AI chấm speech (UC-58) | System (internal) | `{ speech, motion }` | ✅ |
| 40 | POST | `/ai/judge-turn` | AI BGK nhận xét & chấm per-turn (UC-58) | System (internal) | `{ roomId, speaker, transcript, context }` | ❌ **Chưa impl** |
| 41 | POST | `/ai/final-verdict` | AI phán quyết cuối (UC-61) | System (internal) | `{ roomId, sessionData }` | ❌ **Chưa impl** |
| 42 | POST | `/ai/summarize-debate` | AI tóm tắt trận (UC-60) | System (internal) | `{ turnHistory, motion }` | ✅ |
| 43 | POST | `/ai/check-toxic` | Kiểm tra toxic chat (UC-62) | System (internal) | `{ content }` | ✅ |

> AI endpoints chủ yếu gọi nội bộ từ socket handler / debate engine. Có thể expose cho admin debug. Graceful fallback khi `OPENAI_API_KEY` không set.

---

### I. Ranking / Leaderboard (UC-52, UC-64) — ✅ Đã impl

**File:** `src/features/ranking/ranking.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 44 | GET | `/rankings/leaderboard` | Leaderboard Global (ELO) (UC-64) | Guest/User | Query: `?page=&limit=` | ✅ |
| 45 | GET | `/rankings/user/:id` | Rank cá nhân (ELO, tier) | Guest/User | — | ✅ |

---

## 4. Socket Events (Realtime — UC-53 → UC-57)

Chi tiết đầy đủ: xem [08_Socket_Realtime_Guide.md](./08_Socket_Realtime_Guide.md).

### 4.1 Client → Server

| Event | Mô tả | Payload | Status |
|-------|--------|---------|--------|
| `join-room` | Kết nối + join room | `{ roomId }` | ❌ Tên thực tế là `room:join` |
| `leave-room` | Rời room | `{ roomId }` | ❌ Tên thực tế là `room:leave` |
| `send-message` | Chat phòng Main | `{ roomId, content, type }` | ❌ Tên thực tế là `chat:send` |
| `cross-exam:pass-turn` | Pass Turn CE | `{ roomId }` | ⚠️ Có nhưng mới stub |
| `cross-exam:finish` | Finish CE | `{ roomId }` | ⚠️ Có nhưng mới stub |
| `host:start-debate` | Host bắt đầu trận | `{ roomId }` | ❌ Chưa thấy event này |
| `host:next-turn` | Host chuyển lượt | `{ roomId }` | ⚠️ Có nhưng mới stub |
| `host:pause` | Host tạm dừng | `{ roomId }` | ❌ Chưa impl |
| `host:resume` | Host tiếp tục | `{ roomId }` | ❌ Chưa impl |
| `host:issue-card` | Host phát thẻ | `{ roomId, userId, reason }` | ❌ Chưa impl |

### 4.2 Server → Client

| Event | Mô tả | Payload | Status |
|-------|--------|---------|--------|
| `room:update` | Cập nhật trạng thái phòng | `{ room }` | ❌ Chưa thấy emit này |
| `room:participant-update` | Thay đổi participant | `{ participants }` | ✅ |
| `debate:phase-change` | Chuyển phase | `{ phase, timeLimit }` | ⚠️ Có emit stub |
| `debate:turn-change` | Chuyển lượt speaker | `{ speaker, phase }` | ⚠️ Có emit stub |
| `debate:timer-update` | Đồng bộ timer (server-authoritative) | `{ timeRemaining, phase }` | ✅ |
| `debate:card-issued` | Thông báo thẻ vàng | `{ userId, reason, cardType }` | ❌ Chưa impl |
| `debate:kick` | Thông báo kick | `{ userId, reason }` | ❌ Chưa impl |
| `debate:completed` | Trận kết thúc | `{ result }` | ❌ Chưa impl |
| `chat:message` | Tin nhắn chat | `{ senderId, content, type, timestamp }` | ✅ |
| `chat:system` | Thông báo hệ thống | `{ content, timestamp }` | ❌ Chưa impl |
| `ai:analysis-ready` | AI phân tích xong | `{ speaker, analysis }` | ❌ Chưa impl |
| `score:updated` | Điểm cập nhật | `{ scores }` | ❌ Chưa impl |
| `match:found` | Ghép trận thành công (rank) | `{ roomId }` | ✅ Emit từ matcher service |
| `cross-exam:phase-update` | Cập nhật trạng thái CE | `{ timeRemaining, questionsAsked }` | ❌ Chưa impl |

---

## 5. Middleware & Guards

| Middleware | Áp dụng | Mô tả |
|------------|---------|-------|
| `authenticate` | Tất cả trừ register/login, GET public | Verify JWT access token (Bearer) |
| `validate(schema)` | POST/PUT | Zod schema validation (hiện có auth schema, cần thêm cho room/debate) |
| `authLimiter` | `/auth/*` | Giới hạn 5 req/15min |
| `apiLimiter` | `/api/*` | 100 req/min per IP |

> **Cần thêm:** `roomParticipantGuard` (verify user thuộc room), `roleGuard(roles[])` cho Host/Judge endpoints.

---

## 6. Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "Room with id xxx not found",
    "statusCode": 404
  }
}
```

**HTTP Status Codes:**
- `200` — Success
- `201` — Created
- `400` — Bad Request (validation)
- `401` — Unauthorized (token invalid/expired)
- `403` — Forbidden (role không đủ quyền)
- `404` — Not Found
- `409` — Conflict (đã trong queue, đã join room...)
- `429` — Too Many Requests
- `500` — Internal Server Error

---

## 7. Environment Variables

Tạo file `.env` ở `backend/.env`:

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ai-debate-platform

# JWT
JWT_ACCESS_SECRET=<your-access-secret-min-32-chars>
JWT_REFRESH_SECRET=<your-refresh-secret-min-32-chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OpenAI
OPENAI_API_KEY=sk-<your-openai-api-key>

# CORS
CLIENT_URL=http://localhost:5173
```

Tạo file `.env` ở `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

---

## 8. Sprint Checklist — Backend Endpoints

### Sprint 1 (Auth + Rooms cơ bản)

- [x] Auth routes (5 endpoints)
- [x] User routes (profile, stats)
- [x] User history — `GET /users/:id/history`
- [x] User search — `GET /users/search?q=`
- [x] Room CRUD — create, list, detail, join, leave, position, lock, kick
- [x] Room edit — `PUT /rooms/:id`
- [x] Room delete — `DELETE /rooms/:id`
- [x] Assign role — `POST /rooms/:id/assign-role`

### Sprint 2 (Matchmaking + Socket)

- [x] Matchmaking routes (3 endpoints)
- [x] Matcher service (tạo room khi ghép được, emit `match:found`)
- [x] Socket setup — `src/socket/index.ts`
- [x] Room socket — join/leave/participant updates
- [x] Chat socket — message persistence + broadcast
- [ ] Chat toxic check integration

### Sprint 3 (Debate Engine)

- [x] Host controls di chuyển về `/rooms/:id/host/*` (6 endpoints)
- [x] Cross-exam endpoints — `pass-turn`, `finish`
- [x] Session route — `GET /rooms/:id/session`
- [x] Timer service — `src/socket/timer.service.ts`
- [ ] Debate orchestration — phase transitions + `debate:phase-change`, `debate:turn-change`
- [x] CE socket events (stub)

### Sprint 4 (Scoring + AI)

- [x] Judge submit score hoàn thiện — lưu vào DebateSession
- [x] `GET /rooms/:id/scores` — tổng hợp điểm judges + AI
- [x] `POST /rooms/:id/result` — winner + ELO update
- [ ] `POST /ai/judge-turn` — AI BGK per-turn
- [ ] `POST /ai/final-verdict` — AI verdict cuối
- [ ] AI fallbacks khi API key không set

### Sprint 5 (Polish + Realtime)

- [ ] `debate:card-issued`, `debate:kick`, `debate:completed` socket events
- [ ] Reconnect logic — khôi phục phase/timer
- [ ] `ai:analysis-ready`, `score:updated` events

---

## 9. Không thuộc MVP (Phase 2)

| Nhóm | Endpoints |
|-------|-----------|
| Tournament | `/tournaments/*` |
| Community / Posts | `/posts/*` |
| Debate Thread | `/threads/*` |
| Password Reset | `/auth/forgot-password`, `/auth/reset-password` |
| Change Password | `/auth/change-password` |
| AI Coaching | `/ai/generate-rebuttal`, `/ai/coaching` |
| AI Validate CE | `/ai/validate-cross-exam-question` |
| Leaderboard Seasonal | `/rankings/seasonal` |
| User Search | `/users/search` |

---

*Tài liệu này khớp với [05_Use_Cases.md](./05_Use_Cases.md) (66 UC MVP) và [04_TRD](./04_TRD_Technical_Requirements.md).*
