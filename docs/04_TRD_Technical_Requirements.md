# 04 — Technical Requirements (TRD)

**Phiên bản:** v1.0 | **Ngày:** 14/05/2026  
**Loại tài liệu:** Tài liệu kỹ thuật — kiến trúc, API, database  
**Người phụ trách:** System Architect / Fullstack Lead  
**Tham chiếu:** [01_Debate_Rule.md](./01_Debate_Rule.md) · [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) · [03_Role_System.md](./03_Role_System.md) · [05_Use_Cases.md](./05_Use_Cases.md) · [11_Use_Case_Detail.md](./11_Use_Case_Detail.md)

---

## 1. TỔNG QUAN KỸ THUẬT (TECHNICAL OVERVIEW)

### 1.1 Mục đích dự án

AI Debate Platform là nền tảng tranh biện trực tuyến thời gian thực, được xây dựng nhằm:

- Tổ chức các trận tranh biện online theo **[01_Debate_Rule.md](./01_Debate_Rule.md)** (Proposition vs Opposition, 1v1/3v3, Cross Examination, BGK)
- Tích hợp AI vào quá trình điều phối, đánh giá và phân tích tranh biện
- Xây dựng cộng đồng tranh biện học thuật với hệ thống xếp hạng và giải đấu
- Hỗ trợ người học public speaking, luyện phản biện và tư duy logic

### 1.2 Kiến trúc hệ thống

- **Architecture Style:** Feature-based MERN Architecture (Monolithic với modular design)
- **Pattern:** Layered Architecture + Event-Driven (Socket.IO)
- **Deploy Model:** Vercel (Frontend) + Render/Railway (Backend) + MongoDB Atlas (Database)

### 1.3 Đối tượng sử dụng (Target Users)

#### Primary Users
| Vai trò | Mô tả |
|---------|-------|
| **Debater** | Người tham gia tranh biện, đội Ủng hộ (Proposition) hoặc Phản đối (Opposition) |
| **Host / Moderator** | Chủ trì trận debate, kiểm soát thời gian, xử lý vi phạm |
| **Judge** | Ban giám khảo chấm điểm, phân xử |
| **Spectator** | Người xem trực tiếp, vote, comment |

#### Secondary Users
| Vai trò | Mô tả |
|---------|-------|
| **Debate Club Admin** | Tổ chức debate nội bộ CLB |
| **School / University** | Tổ chức thi đấu học thuật |
| **Tournament Organizer** | Tạo và quản lý giải đấu |

### 1.4 Điểm khác biệt

| Nền tảng thông thường | AI Debate Platform |
|----------------------|-------------------|
| Chỉ video call / chat | Realtime Debate Engine theo [01_Debate_Rule.md](./01_Debate_Rule.md) |
| Không có luật debate chuẩn | Motion → Prep 7' → Speech + Cross Exam + BGK feedback |
| Không AI | AI Judge + AI Moderator + AI Summary |
| Không ranking | ELO Ranking + Seasonal Rank |
| Không analytics | Performance tracking + Argument analysis |

### 1.5 Đặc tả use case

Luồng chức năng theo miền (**110 UC**): [05_Use_Cases.md](./05_Use_Cases.md) · chi tiết từng UC: [11_Use_Case_Detail.md](./11_Use_Case_Detail.md).

| Miền TRD | UC chính | Ưu tiên MVP |
|----------|----------|-------------|
| Auth & User | UC-01–15 | MVP-M |
| Matchmaking & Room | UC-19–34 | MVP-M |
| Debate Engine | UC-35–52 | MVP-M |
| Host / Judge / Realtime | UC-53–70 | MVP-M |
| AI | UC-71–82 | MVP-M / S |
| Ranking | UC-83–84 | MVP-M / S |
| Live / Replay / Community | UC-25–26, UC-96–97 | MVP-S |
| Tournament / Knowledge | UC-89–106 | P2 (sau MVP) |

---

## 2. TECH STACK (CÔNG NGHỆ SỬ DỤNG)

### 2.1 Frontend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| **React** | 18.x | UI Framework |
| **TypeScript** | 5.x | Type safety |
| **Vite** | 5.x | Build tool, fast HMR |
| **TailwindCSS** | 3.x | Utility-first styling |
| **Zustand** | 4.x | Global state management |
| **React Query (TanStack)** | 5.x | Server state, caching, async |
| **Socket.IO Client** | 4.x | Realtime WebSocket communication |
| **React Router v6** | 6.x | SPA routing |
| **React Flow** | 11.x | Argument tree visualization |
| **Axios** | 1.x | HTTP client |
| **React Hook Form** | 7.x | Form management |
| **Zod** | 3.x | Schema validation (shared với backend) |
| **date-fns** | 3.x | Date/time utilities |
| **Recharts** | 2.x | Analytics charts |

### 2.2 Backend

| Công nghệ | Phiên bản | Mục đích |
|-----------|-----------|---------|
| **Node.js** | 20.x LTS | Runtime |
| **Express.js** | 4.x | REST API framework |
| **TypeScript** | 5.x | Type safety |
| **Socket.IO** | 4.x | WebSocket server, realtime |
| **Mongoose** | 8.x | MongoDB ODM |
| **JWT (jsonwebtoken)** | 9.x | Authentication tokens |
| **bcryptjs** | 2.x | Password hashing |
| **Zod** | 3.x | Request validation |
| **OpenAI SDK** | 4.x | AI integration |
| **cors** | 2.x | CORS middleware |
| **helmet** | 7.x | Security headers |
| **express-rate-limit** | 7.x | Rate limiting |
| **morgan** | 1.x | HTTP request logging |
| **dotenv** | 16.x | Environment variables |

### 2.3 Database

| Công nghệ | Mục đích |
|-----------|---------|
| **MongoDB Atlas** | Cloud NoSQL database chính |
| **Mongoose** | Schema modeling, validation, ODM |

### 2.4 AI Integration

| Công nghệ | Mục đích |
|-----------|---------|
| **OpenAI API (GPT-4o)** | AI Judge, AI Summary, Fallacy Detection, Counterargument |
| **Prompt Engineering** | Custom prompts cho từng AI feature |

### 2.5 DevOps & Tooling

| Công nghệ | Mục đích |
|-----------|---------|
| **Git + GitHub** | Version control, Gitflow |
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Husky** | Git hooks (pre-commit lint) |
| **Postman** | API testing |
| **Vercel** | Frontend deployment |
| **Render / Railway** | Backend deployment |

---

## 3. MÔ HÌNH TRANH BIỆN (theo 01_Debate_Rule.md)

> **Nguồn chuẩn:** [01_Debate_Rule.md](./01_Debate_Rule.md). Phần dưới là tóm tắt kỹ thuật; chi tiết luật, luồng 25 bước, Cross Examination nằm trong file đó.

### 3.1 Thành phần & chế độ

- Hai đội: **Proposition (Ủng hộ)** · **Opposition (Phản đối)**.
- **1v1:** một debater đảm nhận Speaker 1–3 cho đội mình.
- **3v3:** ba debater / đội, mỗi người một speaker slot.
- **Host** (Human/AI) · **BGK / Judge** (Human/AI, 1 hoặc 3 human) · **Viewer**.
- **Không gian:** Main Room + Private Room / đội (Preparation & prep giữa lượt).

### 3.2 Các giai đoạn trận

1. Motion Announcement  
2. Preparation Phase — **7 phút**  
3. Debate Round 1 (Opening)  
4. Debate Round 2 (Deep Clash)  
5. Closing Round (Speaker 3 — không Cross Exam)  
6. Final Judging  

### 3.3 Thứ tự speaker (3v3)

Đội Ủng hộ luôn trước:

`Pro S1 → Opp S1 → Pro S2 → Opp S2 → Pro S3 → Opp S3`

### 3.4 Thời lượng chính

| Phase | Thời gian |
|-------|-----------|
| Preparation (ban đầu) | 7 phút |
| Speech (mỗi speaker) | 4 phút (bắt đầu khi Host/system cho phép) |
| Cross Examination (sau S1, S2) | 3 phút / đội, tối đa 2 câu hỏi / đội |
| Judge feedback (sau mỗi speaker) | 3–5 phút |
| Prep giữa lượt | 1 phút |

### 3.5 Cross Examination (thay POI)

- Sau **Speaker 1 & 2** mỗi bên — **không** có Cross Exam ở Closing (Speaker 3).
- Luồng: Pro hỏi → Opp trả lời + hỏi → … — dùng **Pass Turn** / **Finish**; timer chỉ trừ khi đội đang hỏi hoặc trả lời.
- Chi tiết 5 bước: Debate_rule §10.

### 3.6 Luận điểm mới

- Speaker 3 **không** được luận điểm mới (claim/framework/mechanism/impact mới).
- Định nghĩa “mới” vs “làm rõ”: Debate_rule §11.

### 3.7 AI Host / AI Judge

- **Rank matchmaking:** mặc định AI Host + AI BGK.
- **Custom room:** cấu hình Human/AI từng slot — xem [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md).

---

## 4. CORE FEATURES (TÍNH NĂNG LÕI)

### 4.1 Authentication & Authorization

- **Register/Login** với email + password
- **JWT Authentication** (Access Token + Refresh Token)
- **RBAC** (Role-Based Access Control):
  - `admin` - quản trị hệ thống
  - `host` - chủ trì debate
  - `judge` - giám khảo
  - `debater` - người tranh biện
  - `spectator` - người xem
- **Profile management**: avatar, bio, stats, rank

### 4.2 Matchmaking & Room System

> Đặc tả sản phẩm: [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md). Phân quyền: [03_Role_System.md](./03_Role_System.md).

#### Hai kênh vào trận

| Kênh | `roomType` | Mô tả kỹ thuật |
|------|------------|----------------|
| **Rank** | `rank` | ELO queue 1v1/3v3 → auto room, **AI Host + AI BGK**, không Room Owner người |
| **Custom** | `custom` | User tạo phòng = **Room Owner**; cấu hình Host/Judge Human/AI, password, Select Position |

#### Rank matchmaking (UC-19, UC-20)
- Queue tách bảng **1v1** và **3v3**
- Matcher ghép theo ELO gần nhất
- Tạo `Match` + `DebateRoom` + gán Proposition / Opposition
- Prep **7 phút** (không 15 phút)

#### Custom room (UC-21–34)
- Cấu hình: `format` (1v1/3v3), `hostType`, `judgeType`, `judgeCount`, `isPrivate`, `password`
- Lobby: join slot, **Select Position** (Pro/Opp, S1–S3, Judge, Host), **lock position** (Owner)
- **Owner ≠ Host:** Owner cấu hình lobby; khi `active`, Host điều phối phase
- Start: Owner hoặc Host (UC-32)

#### Community Live Matches (UC-25, UC-26)
- `GET /api/v1/rooms` filter: status, format, roomType, hasPassword
- Viewer join read-only; password room: view + join với mật khẩu

#### Room states
`waiting` → `ready` → `active` → (`paused`) → `completed` | `cancelled`

#### Debate Flow Engine
- State machine phase: `motion` → `prep_7` → `speech` → `cross_exam` → `judge_feedback` → `prep_1` → … → `final_judging`
- **Turn order** theo Debate_rule (Pro S1…Opp S3)
- **Timer:** speech 4'; cross-exam 3'/đội; prep 7' / 1'
- **Cross Examination:** Pass Turn / Finish; enforce 2 câu / đội
- Không luận điểm mới ở Speaker 3

#### Host/Judge Controls
- Start / Pause / End debate · chuyển phase
- Issue **Yellow Card** / **Red Card**
- Kick participant · mute mic / chat
- Điều phối Cross Examination (timer sync)
- BGK: nhận xét & chấm theo tiêu chí Debate_rule §13

### 4.3 Realtime System (Socket.IO)

#### Events Architecture
```
Client ──── Socket.IO ──── Server
  │                          │
  ├── join-room              ├── room:update
  ├── send-message           ├── debate:turn-change
  ├── cross-exam:pass-turn   ├── debate:timer-update
  ├── cross-exam:finish      ├── cross-exam:phase-update
  ├── cross-exam:question    ├── debate:card-issued
  ├── host:start-debate      ├── ai:analysis-ready
  ├── host:next-turn         ├── score:updated
  └── host:issue-card        └── room:participant-update
```

#### Realtime Features
- Live chat (spectators + judges)
- Typing indicators
- Online presence (ai đang online)
- Live timer sync (tất cả client đồng bộ)
- Live score updates
- Cross Examination phase notifications
- Card notifications

### 4.4 AI Debate System

#### AI Judge
- Chấm điểm từng lượt nói (logic, clarity, evidence, rebuttal quality)
- So sánh 2 đội sau debate
- Đưa ra verdict với giải thích

#### AI Moderator
- Toxic/spam detection trong chat
- Phát hiện vi phạm luật debate (luận điểm mới ở S3, cross-exam dài, v.v.)
- Cảnh báo tự động

#### AI Assistant (cho Debater)
- Gợi ý rebuttal
- Phân tích điểm yếu trong argument
- Coaching sau debate

#### AI Summary
- Tóm tắt toàn bộ debate
- Highlight các xung đột chính
- Extract key arguments từ mỗi đội
- Tạo debate replay timeline

#### AI Host Mode
- Điều khiển toàn bộ flow khi không có human host
- Điều phối Cross Examination & phase transitions
- Enforce rules tự động

### 4.5 Scoring & Ranking System

#### Scoring per Speech (Debate_rule §13)
| Tiêu chí | Điểm tối đa |
|---------|------------|
| Logic & Reasoning | 30 |
| Rebuttal Quality | 20 |
| Evidence & Examples | 15 |
| Cross Examination | 15 |
| Strategy & Consistency | 10 |
| Communication & Clarity | 10 |
| **Tổng** | **100** |

#### ELO Ranking System
- ELO rating thay đổi sau mỗi trận
- Rank tiers: `Novice` → `Debater` → `Advanced` → `Expert` → `Master` → `Grand Master`
- Seasonal ranking (reset theo mùa)
- Leaderboard toàn cầu + theo trường/CLB

### 4.6 Tournament System

- Tạo giải đấu với: tên, luật, số đội, bracket type
- **Tournament modes:**
  - `AI-hosted`: toàn bộ trận dùng AI Host
  - `Human-hosted`: toàn bộ trận dùng human host
  - `Mixed`: chỉ định từng trận
- Bracket management: single elimination, round robin
- Auto-schedule matches
- Tournament leaderboard

### 4.7 Community System

- **Social Feed**: đăng kết quả, sự kiện, tin tức debate
- **Vote**: vote đội yêu thích, trận đấu hay nhất
- **Comment**: bình luận trận đấu
- **Follow**: theo dõi debater, CLB
- **Event Announcements**: thông báo giải đấu sắp tới
- **Debate Replay**: xem lại transcript + timeline sau trận

---

## 5. DATABASE DESIGN

### 5.1 Collections & Schema

#### Users
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (bcrypt hashed),
  role: enum['admin','host','judge','debater','spectator'],
  profile: {
    displayName: String,
    avatar: String (URL),
    bio: String,
    school: String,
    club: String
  },
  stats: {
    totalDebates: Number,
    wins: Number,
    losses: Number,
    totalScore: Number,
    avgScore: Number
  },
  ranking: {
    elo: Number (default: 1000),
    tier: enum['Novice','Debater','Advanced','Expert','Master','GrandMaster'],
    seasonPoints: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### DebateRooms
```javascript
{
  _id: ObjectId,
  roomType: enum['rank','custom'],
  title: String,
  motion: String,              // chủ đề tranh biện (sau Motion Announcement)
  description: String,
  status: enum['waiting','ready','active','paused','completed','cancelled'],
  format: enum['1v1','3v3'],
  isPrivate: Boolean,
  password: String (nullable),  // hashed nếu private
  selectPositionEnabled: Boolean,
  positionsLocked: Boolean,
  createdBy: ObjectId,          // Room Owner (custom); null hoặc system (rank)
  hostType: enum['human','ai'],
  hostId: ObjectId (nullable),  // human host
  judgeType: enum['human','ai'],
  judgeCount: Number,         // 1 (AI) hoặc 1–3 (human)
  judges: [{ userId: ObjectId, username: String }],
  participants: [{
    userId: ObjectId,
    roomRole: enum['debater','host','judge','viewer','owner'],
    team: enum['proposition','opposition', null],
    speakerSlot: enum['S1','S2','S3', null],  // 1v1: một debater = cả S1–S3
    positionLocked: Boolean
  }],
  teamProposition: {
    name: String,
    members: [{ userId: ObjectId, position: enum['S1','S2','S3'] }]
  },
  teamOpposition: {
    name: String,
    members: [{ userId: ObjectId, position: enum['S1','S2','S3'] }]
  },
  currentPhase: enum['motion','prep_7','speech','cross_exam','judge_feedback','prep_1','closing','final_judging','completed'],
  matchId: ObjectId (nullable), // rank match reference
  tournamentId: ObjectId (nullable),
  eloApplied: Boolean,          // true nếu cập nhật ELO sau trận
  createdAt: Date,
  startedAt: Date,
  endedAt: Date
}
```

#### MatchQueue (Rank)
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  format: enum['1v1','3v3'],
  eloAtQueue: Number,
  status: enum['waiting','matched','cancelled'],
  matchedRoomId: ObjectId (nullable),
  createdAt: Date
}
```

#### DebateSessions
```javascript
{
  _id: ObjectId,
  roomId: ObjectId,
  currentTurn: {
    speaker: enum['PRO_S1','OPP_S1','PRO_S2','OPP_S2','PRO_S3','OPP_S3'],
    phase: enum['speech','cross_exam','judge_feedback','prep_1'],
    startTime: Date,
    timeLimit: Number (seconds),
    timeRemaining: Number,
    status: enum['active','paused','completed']
  },
  turnHistory: [{
    speaker: String,
    startTime: Date,
    endTime: Date,
    duration: Number,
    transcript: String,
    crossExamination: {
      questionsAsked: Number,
      questionsAnswered: Number,
      timeRemainingPro: Number,
      timeRemainingOpp: Number,
      transcript: [{ team: String, type: enum['question','answer'], content: String, timestamp: Date }]
    },
    aiAnalysis: {
      score: { logic: Number, rebuttal: Number, evidence: Number, crossExam: Number, strategy: Number, communication: Number, overall: Number },
      strengths: [String],
      weaknesses: [String],
      fallacies: [{ type: String, description: String }],
      summary: String
    }
  }],
  cards: [{
    type: enum['yellow','red'],
    issuedTo: ObjectId,
    issuedBy: ObjectId,
    reason: String,
    timestamp: Date
  }],
  finalScores: {
    teamProposition: { total: Number, breakdown: Object },
    teamOpposition: { total: Number, breakdown: Object },
    winner: enum['proposition','opposition','draw'],
    aiVerdict: String,
    judgeVerdicts: [{ judgeId: ObjectId, winner: String, notes: String }]
  },
  aiSummary: String,
  createdAt: Date
}
```

#### Messages
```javascript
{
  _id: ObjectId,
  roomId: ObjectId,
  senderId: ObjectId,
  senderName: String,
  senderRole: String,
  content: String,
  type: enum['chat','system','announcement','cross-exam'],
  isToxic: Boolean,
  timestamp: Date
}
```

#### Tournaments
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  organizerId: ObjectId,
  mode: enum['ai-hosted','human-hosted','mixed'],
  format: enum['single-elimination','round-robin'],
  status: enum['upcoming','active','completed'],
  teams: [{ teamId: ObjectId, teamName: String, members: [ObjectId] }],
  brackets: [{
    round: Number,
    matches: [{
      matchId: ObjectId,
      teamProposition: ObjectId,
      teamOpposition: ObjectId,
      winner: enum['proposition','opposition', null],
      roomId: ObjectId,
      hostMode: enum['ai','human']
    }]
  }],
  startDate: Date,
  endDate: Date,
  createdAt: Date
}
```

#### DebateThreads (UC-96 — sau MVP-S)
```javascript
{
  _id: ObjectId,
  sessionId: ObjectId,
  roomId: ObjectId,
  motion: String,
  verdict: { winner: enum['proposition','opposition','draw'], scores: Object },
  timeline: [{ speaker: String, phase: String, startTime: Date, endTime: Date }],
  transcript: String (nullable),
  communityVotes: [{ userId: ObjectId, agreeWithVerdict: Boolean }], // không thay chấm chính
  comments: [{ userId: ObjectId, stance: enum['pro','con','neutral'], content: String, anchor: Object }],
  createdAt: Date
}
```

#### Posts (Community — feed tổng quát)
```javascript
{
  _id: ObjectId,
  authorId: ObjectId,
  type: enum['result','event','announcement','discussion'],
  title: String,
  content: String,
  relatedRoomId: ObjectId (nullable),
  relatedThreadId: ObjectId (nullable),
  relatedTournamentId: ObjectId (nullable),
  votes: [{ userId: ObjectId, type: enum['up','down'] }],
  comments: [{ userId: ObjectId, content: String, stance: enum['pro','con','neutral'], createdAt: Date }],
  createdAt: Date
}
```

---

## 6. API STRUCTURE

### 6.1 Authentication APIs
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh-token
GET    /api/v1/auth/me
PUT    /api/v1/auth/change-password
```

### 6.2 User APIs
```
GET    /api/v1/users/:id
PUT    /api/v1/users/:id/profile
GET    /api/v1/users/:id/stats
GET    /api/v1/users/search?q=
# Leaderboard: xem §6.9 /api/v1/rankings/*
```

### 6.3 Matchmaking APIs (Rank)
```
POST   /api/v1/matchmaking/queue          # body: { format: '1v1'|'3v3' } — UC-19
DELETE /api/v1/matchmaking/queue          # hủy queue
GET    /api/v1/matchmaking/status         # trạng thái queue hiện tại
```
> Ghép cặp & tạo room: nội bộ service (UC-20), notify qua socket `match:found`.

### 6.4 Debate Room APIs (Custom + Live)
```
POST   /api/v1/rooms/create               # UC-21 — Owner, config host/judge/format
GET    /api/v1/rooms                      # UC-25 — Live Matches + filters
GET    /api/v1/rooms/:id
PUT    /api/v1/rooms/:id                  # UC-22 — lobby config
DELETE /api/v1/rooms/:id                  # UC-24
POST   /api/v1/rooms/:id/join             # UC-27 — password, role
POST   /api/v1/rooms/:id/leave            # UC-33
POST   /api/v1/rooms/:id/position         # UC-28 — select position
POST   /api/v1/rooms/:id/position/lock    # UC-29 — Owner lock
POST   /api/v1/rooms/:id/ownership/transfer # UC-23
POST   /api/v1/rooms/:id/kick             # UC-34 — Owner lobby kick
POST   /api/v1/rooms/:id/start            # UC-32
POST   /api/v1/rooms/:id/end
GET    /api/v1/rooms/:id/session          # UC-48
GET    /api/v1/rooms/:id/replay           # UC-48, UC-96
```

### 6.5 Host / Judge / Cross Examination APIs

```
POST   /api/v1/rooms/:id/host/next-turn   # UC-54
POST   /api/v1/rooms/:id/host/pause       # UC-53
POST   /api/v1/rooms/:id/host/resume
POST   /api/v1/rooms/:id/host/issue-card  # UC-55, UC-56
POST   /api/v1/rooms/:id/host/kick        # UC-57
POST   /api/v1/rooms/:id/cross-exam/pass-turn  # UC-41
POST   /api/v1/rooms/:id/cross-exam/finish
POST   /api/v1/rooms/:id/judge/submit-score    # UC-60
```

### 6.6 AI APIs
```
POST   /api/v1/ai/analyze-speech
POST   /api/v1/ai/score-argument
POST   /api/v1/ai/detect-fallacy
POST   /api/v1/ai/generate-rebuttal
POST   /api/v1/ai/summarize-debate
POST   /api/v1/ai/check-toxic
POST   /api/v1/ai/validate-cross-exam-question
```

### 6.7 Tournament APIs (MVP-S / P2)
```
POST   /api/v1/tournaments/create
GET    /api/v1/tournaments
GET    /api/v1/tournaments/:id
PUT    /api/v1/tournaments/:id
POST   /api/v1/tournaments/:id/register
GET    /api/v1/tournaments/:id/brackets
POST   /api/v1/tournaments/:id/advance
```

### 6.8 Community & Debate Thread APIs
```
POST   /api/v1/posts/create
GET    /api/v1/posts
GET    /api/v1/posts/:id
POST   /api/v1/posts/:id/vote
POST   /api/v1/posts/:id/comment
DELETE /api/v1/posts/:id
GET    /api/v1/threads/:sessionId          # UC-96 — Debate Thread
POST   /api/v1/threads/:id/comment         # UC-97
POST   /api/v1/threads/:id/vote-verdict    # UC-99
GET    /api/v1/events
```

### 6.9 Ranking APIs
```
GET    /api/v1/rankings/leaderboard
GET    /api/v1/rankings/seasonal
GET    /api/v1/rankings/user/:id
```

---

## 7. NON-FUNCTIONAL REQUIREMENTS

### 7.1 Performance
- API response time: **< 300ms** (p95)
- Realtime latency: **< 100ms**
- Timer sync accuracy: **± 500ms**
- Concurrent rooms: hỗ trợ **50+ rooms** đồng thời

### 7.2 Security
- OWASP Top 10 protection
- HTTPS everywhere
- CORS configuration
- Input sanitization (Zod validation)
- Rate limiting: 100 req/min per IP
- JWT expiry: Access 15min, Refresh 7 days
- Password hashing: bcrypt rounds 12

### 7.3 Scalability
- Modular architecture cho phép tách microservices sau
- Socket.IO rooms isolation
- MongoDB indexing trên roomId, userId, timestamp

### 7.4 Reliability
- Graceful error handling
- Socket reconnection logic
- Timer state persistence (không mất khi reconnect)

---

## 8. DEVELOPMENT WORKFLOW

### 8.1 Version Control (Gitflow)
```
main          ← production
develop       ← integration
feature/*     ← new features
hotfix/*      ← urgent fixes
```

### 8.2 Branch Naming Convention
```
feature/auth-system
feature/debate-room
feature/socket-realtime
feature/ai-integration
feature/tournament
hotfix/timer-sync-bug
```

### 8.3 Commit Convention
```
feat: add cross-examination phase system
fix: timer sync issue on reconnect
docs: update API documentation
refactor: extract debate engine service
test: add auth unit tests
```

### 8.4 Environments
| Environment | Frontend | Backend | Database |
|-------------|----------|---------|----------|
| Development | localhost:5173 | localhost:3000 | MongoDB local |
| Staging | Vercel preview | Render staging | MongoDB Atlas dev |
| Production | Vercel prod | Render prod | MongoDB Atlas prod |

---

## 9. FOLDER STRUCTURE

### Frontend (client/)
```
client/src/
├── components/          # Reusable UI components
│   ├── ui/              # Base components (Button, Input, Modal...)
│   ├── debate/          # Debate-specific components
│   ├── layout/          # Layout components
│   └── shared/          # Shared components
├── features/            # Feature modules
│   ├── auth/
│   ├── debate/
│   ├── matchmaking/
│   ├── tournament/
│   ├── community/
│   ├── ranking/
│   └── ai/
├── hooks/               # Custom React hooks
├── stores/              # Zustand stores
├── services/            # API service layer (Axios)
├── socket/              # Socket.IO client setup & handlers
├── types/               # TypeScript type definitions
├── utils/               # Utility functions
└── pages/               # Route pages
```

### Backend (server/)
```
server/src/
├── config/              # DB, env, constants
├── features/            # Feature modules
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.routes.ts
│   │   └── auth.schema.ts
│   ├── debate/
│   ├── matchmaking/
│   ├── tournament/
│   ├── community/
│   ├── ranking/
│   └── ai/
├── middleware/          # Auth, error, rate-limit
├── socket/              # Socket.IO handlers
│   ├── debate.socket.ts
│   ├── chat.socket.ts
│   ├── crossExam.socket.ts
│   ├── matchmaking.socket.ts
│   └── room.socket.ts
├── models/              # Mongoose models
├── types/               # TypeScript types
├── utils/               # Helpers
└── server.ts            # Entry point
```
