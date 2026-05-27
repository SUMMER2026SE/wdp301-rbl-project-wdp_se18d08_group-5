# 12 — API Endpoints MVP

**Phiên bản:** v1.1 | **Ngày:** 25/05/2026
**Loại tài liệu:** Danh sách API Backend — phạm vi MVP
**Tham chiếu:** [05_Use_Cases.md](./05_Use_Cases.md) · [04_TRD](./04_TRD_Technical_Requirements.md) · [08_Socket](./08_Socket_Realtime_Guide.md)

---

## 1. Tổng quan

| Nhóm | Số endpoint REST | Trạng thái | Ghi chú |
|------|-----------------|------------|---------|
| A. Auth | 5 | ✅ Đã impl | |
| B. User/Profile | 4 (+ 1 chưa impl) | ⚠️ Incomplete | Thiếu history |
| C. Matchmaking | 3 | ✅ Đã impl | Matcher service cần impl |
| D. Room | 12 (+ 3 chưa impl) | ⚠️ Incomplete | Thiếu assign-role, edit, delete |
| E. Host Controls | 6 | ⚠️ Sai vị trí | Hiện tại `/debate/:id/host/*`, cần `/rooms/:id/host/*` |
| F. Cross Exam | 2 | ❌ Chưa impl | |
| G. Judge/Scoring | 3 | ❌ Chưa impl | scores + result |
| H. AI | 5 | ⚠️ Incomplete | Thiếu judge-turn + final-verdict |
| I. Ranking | 2 | ✅ Đã impl | |
| **Tổng REST** | **~42** | **~30 impl / ~12 còn lại** | |
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
| 9 | GET | `/users/:id/history` | Xem lịch sử tranh biện | User | Query: `?page=&limit=` | ❌ **Cần impl** |

> **Cần thêm:** `GET /users/:id/history` — phân trang debate history, trả về danh sách `DebateSession` đã completed.

---

### C. Matchmaking — Rank (UC-12 → UC-13) — ✅ Route đã impl

**File:** `src/features/matchmaking/matchmaking.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 10 | POST | `/matchmaking/queue` | Xếp hàng Rank | User | `{ format: '1v1' \| '3v3' }` | ✅ |
| 11 | DELETE | `/matchmaking/queue` | Hủy queue | User | — | ✅ |
| 12 | GET | `/matchmaking/status` | Trạng thái queue hiện tại | User | — | ✅ |

> **Lưu ý:** Ghép trận (UC-13) xử lý nội bộ service → notify qua socket `match:found`. Matcher service chưa impl (TODO trong route).

---

### D. Room — Custom + Live Matches (UC-14 → UC-25)

**File:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 13 | POST | `/rooms/create` | Tạo Custom Room | User → Owner | `{ title, format, hostType, judgeType, judgeCount, isPrivate, password? }` | ✅ |
| 14 | GET | `/rooms` | Duyệt Live Matches | Guest/User | Query: `?status=&format=&roomType=&page=&limit=` | ✅ |
| 15 | GET | `/rooms/:id` | Chi tiết phòng | User | — | ✅ |
| 16 | PUT | `/rooms/:id` | Chỉnh sửa cấu hình phòng (lobby) | Owner | `{ title?, format?, hostType?, judgeType?, isPrivate?, password? }` | ❌ **Cần impl** |
| 17 | DELETE | `/rooms/:id` | Hủy / xóa phòng (lobby only) | Owner | — | ❌ **Cần impl** |
| 18 | POST | `/rooms/:id/join` | Join phòng | User | `{ password? }` | ✅ |
| 19 | POST | `/rooms/:id/leave` | Rời phòng | Participant | — | ✅ |
| 20 | POST | `/rooms/:id/position` | Select Position | User | `{ team: 'proposition'\|'opposition', speakerSlot: 'S1'\|'S2'\|'S3', role?: 'debater'\|'judge'\|'host' }` | ✅ |
| 21 | POST | `/rooms/:id/position/lock` | Lock position | Owner | — | ✅ |
| 22 | POST | `/rooms/:id/assign-role` | Gán slot Host / Judge (human) | Owner | `{ userId, role: 'host'\|'judge' }` | ❌ **Cần impl** |
| 23 | POST | `/rooms/:id/kick` | Kick / ban (lobby) | Owner | `{ userId, reason? }` | ✅ |
| 24 | POST | `/rooms/:id/start` | Start trận | Owner/Host | — | ✅ |

---

### E. Debate Session + Host Controls (UC-26 → UC-47)

#### E1. Host Controls (UC-44 → UC-47)

> ⚠️ **Cần di chuyển:** Các endpoint hiện tại nằm ở `/debate/:roomId/host/*`. Cần chuyển về `/rooms/:id/host/*` để nhất quán với spec.

**File target:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 25 | POST | `/rooms/:id/host/pause` | Tạm dừng trận (UC-44) | Host | — | ⚠️ Cần di chuyển |
| 26 | POST | `/rooms/:id/host/resume` | Tiếp tục trận | Host | — | ⚠️ Cần di chuyển |
| 27 | POST | `/rooms/:id/host/next-turn` | Chuyển lượt tiếp theo (UC-45) | Host | — | ⚠️ Cần di chuyển |
| 28 | POST | `/rooms/:id/host/issue-card` | Phát thẻ vàng | Host | `{ userId, reason }` | ⚠️ Cần di chuyển |
| 29 | POST | `/rooms/:id/host/kick` | Kick participant (UC-46) | Host | `{ userId, reason? }` | ⚠️ Cần di chuyển |
| 30 | POST | `/rooms/:id/host/mute` | Mute / cấm chat (UC-47) | Host | `{ userId, type: 'mute'\|'unmute' }` | ⚠️ Cần di chuyển |

#### E2. Session & Replay

**File target:** `src/features/debate/debate.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 31 | GET | `/rooms/:id/session` | Trạng thái session (phase, turn, timer) | Participant/Viewer | — | ⚠️ Endpoint đúng, cần thêm populate |
| 32 | GET | `/rooms/:id/replay` | Replay trận (UC-66) | User | — | ✅ |

---

### F. Cross Examination (UC-32 → UC-33)

**File target:** `src/features/room/room.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 33 | POST | `/rooms/:id/cross-exam/pass-turn` | Pass Turn trong CE (UC-32) | Debator | — | ❌ **Cần impl** |
| 34 | POST | `/rooms/:id/cross-exam/finish` | Finish CE sớm (UC-32) | Debator | — | ❌ **Cần impl** |

---

### G. Judge / Scoring (UC-48 → UC-52)

**File target:** `src/features/debate/debate.routes.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 35 | POST | `/rooms/:id/judge/submit-score` | Nộp điểm (6 tiêu chí / 100) (UC-48) | Judge (human) | `{ speaker, logic, rebuttal, evidence, crossExam, strategy, communication, notes? }` | ⚠️ Cần hoàn thiện validate |
| 36 | GET | `/rooms/:id/scores` | Xem điểm tổng hợp (judges + AI) (UC-49–50) | Participant/Viewer | — | ❌ **Cần impl** |
| 37 | GET | `/rooms/:id/result` | Kết quả trận (winner, ELO change) (UC-51–52) | User | — | ❌ **Cần impl** |

---

### H. AI (UC-58 → UC-63)

**File:** `src/features/ai/ai.routes.ts` + `src/features/ai/ai.service.ts`

| # | Method | Endpoint | Mô tả | Actor | Body / Params | Status |
|---|--------|----------|--------|-------|---------------|--------|
| 38 | POST | `/ai/analyze-speech` | Phân tích speech (claims, weaknesses, fallacies) (UC-59) | System (internal) | `{ speech, motion, team, speakerSlot }` | ✅ |
| 39 | POST | `/ai/score-argument` | AI chấm speech (UC-58) | System (internal) | `{ speech, motion }` | ✅ |
| 40 | POST | `/ai/judge-turn` | AI BGK nhận xét & chấm per-turn (UC-58) | System (internal) | `{ roomId, speaker, transcript, context }` | ❌ **Cần impl** |
| 41 | POST | `/ai/final-verdict` | AI phán quyết cuối (UC-61) | System (internal) | `{ roomId, sessionData }` | ❌ **Cần impl** |
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
| `join-room` | Kết nối + join room | `{ roomId }` | ✅ |
| `leave-room` | Rời room | `{ roomId }` | ✅ |
| `send-message` | Chat phòng Main | `{ roomId, content, type }` | ✅ |
| `cross-exam:pass-turn` | Pass Turn CE | `{ roomId }` | ❌ **Cần impl** |
| `cross-exam:finish` | Finish CE | `{ roomId }` | ❌ **Cần impl** |
| `host:start-debate` | Host bắt đầu trận | `{ roomId }` | ⚠️ Cần kết nối `/rooms/:id/start` |
| `host:next-turn` | Host chuyển lượt | `{ roomId }` | ❌ **Cần impl** |
| `host:pause` | Host tạm dừng | `{ roomId }` | ❌ **Cần impl** |
| `host:resume` | Host tiếp tục | `{ roomId }` | ❌ **Cần impl** |
| `host:issue-card` | Host phát thẻ | `{ roomId, userId, reason }` | ❌ **Cần impl** |

### 4.2 Server → Client

| Event | Mô tả | Payload | Status |
|-------|--------|---------|--------|
| `room:update` | Cập nhật trạng thái phòng | `{ room }` | ✅ |
| `room:participant-update` | Thay đổi participant | `{ participants }` | ✅ |
| `debate:phase-change` | Chuyển phase | `{ phase, timeLimit }` | ❌ **Cần impl orchestration** |
| `debate:turn-change` | Chuyển lượt speaker | `{ speaker, phase }` | ❌ **Cần impl** |
| `debate:timer-update` | Đồng bộ timer (server-authoritative) | `{ timeRemaining, phase }` | ❌ **Cần impl timer service** |
| `debate:card-issued` | Thông báo thẻ vàng | `{ userId, reason, cardType }` | ❌ **Cần impl** |
| `debate:kick` | Thông báo kick | `{ userId, reason }` | ❌ **Cần impl** |
| `debate:completed` | Trận kết thúc | `{ result }` | ❌ **Cần impl** |
| `chat:message` | Tin nhắn chat | `{ senderId, content, type, timestamp }` | ✅ |
| `chat:system` | Thông báo hệ thống | `{ content, timestamp }` | ✅ |
| `ai:analysis-ready` | AI phân tích xong | `{ speaker, analysis }` | ❌ **Cần impl** |
| `score:updated` | Điểm cập nhật | `{ scores }` | ❌ **Cần impl** |
| `match:found` | Ghép trận thành công (rank) | `{ roomId, opponent }` | ❌ **Cần impl matcher** |
| `cross-exam:phase-update` | Cập nhật trạng thái CE | `{ timeRemaining, questionsAsked }` | ❌ **Cần impl** |

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
- [ ] User history — `GET /users/:id/history`
- [x] Room CRUD — create, list, detail, join, leave, position, lock, kick
- [ ] Room edit — `PUT /rooms/:id`
- [ ] Room delete — `DELETE /rooms/:id`
- [ ] Assign role — `POST /rooms/:id/assign-role`

### Sprint 2 (Matchmaking + Socket)

- [x] Matchmaking routes (3 endpoints)
- [ ] Matcher service (tạo room khi ghép được, emit `match:found`)
- [ ] Socket setup — `src/socket/index.ts`
- [ ] Room socket — join/leave/participant updates
- [ ] Chat socket — message + toxic check

### Sprint 3 (Debate Engine)

- [ ] Host controls di chuyển về `/rooms/:id/host/*` (6 endpoints)
- [ ] Cross-exam endpoints — `pass-turn`, `finish`
- [ ] Session route — `GET /rooms/:id/session` (hoàn thiện)
- [ ] Timer service — `src/socket/timer.service.ts`
- [ ] Debate orchestration — phase transitions + `debate:phase-change`, `debate:turn-change`
- [ ] CE socket events

### Sprint 4 (Scoring + AI)

- [ ] Judge submit score hoàn thiện — validate + lưu vào DebateSession
- [ ] `GET /rooms/:id/scores` — tổng hợp điểm judges + AI
- [ ] `GET /rooms/:id/result` — winner + ELO update
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
