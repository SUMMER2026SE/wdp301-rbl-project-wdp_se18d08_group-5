# AI Debate Platform - Backend

Express.js REST API and Socket.IO server for the AI Debate Platform.

## Tech Stack

- **Node.js** with TypeScript (ES Modules)
- **Express 4** — HTTP framework
- **Socket.IO** — real-time WebSocket communication
- **MongoDB + Mongoose** — database and ODM
- **OpenAI SDK** — AI judge and analysis
- **JWT** — authentication
- **Zod** — request validation
- **Helmet + CORS + Rate Limiter** — security

## Project Structure

```
src/
├── config/               # Environment and database configuration
├── features/             # Feature modules
│   ├── ai/              # AI service (scoring, fallacy detection)
│   ├── auth/            # Authentication (register, login, JWT)
│   ├── debate/          # Debate session management
│   ├── matchmaking/     # Ranked matchmaking queue
│   ├── ranking/         # ELO ranking and leaderboard
│   ├── room/            # Room CRUD and management
│   └── user/            # User profile
├── middleware/           # Express middleware
│   ├── auth.ts          # JWT authentication guard
│   ├── errorHandler.ts  # Global error handler
│   ├── notFoundHandler.ts
│   ├── rateLimiter.ts   # Rate limiting
│   └── validate.ts      # Zod schema validation
├── models/              # Mongoose models
│   ├── DebateRoom.ts
│   ├── DebateSession.ts
│   ├── MatchQueue.ts
│   ├── Message.ts
│   └── User.ts
├── socket/              # Socket.IO event handlers
│   ├── chat.socket.ts   # Chat messaging
│   ├── debate.socket.ts # Debate flow control
│   ├── room.socket.ts   # Room join/leave
│   ├── timer.service.ts # Turn timer management
│   └── index.ts         # Socket initialization
├── types/               # TypeScript type definitions
├── utils/               # Utilities (AppError, JWT, response helpers)
├── app.ts               # Express app setup
└── server.ts            # Server entry point
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- MongoDB >= 6

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-debate
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=your-openai-api-key
CLIENT_URL=http://localhost:5173
```

### Development

```bash
npm run dev
```

### Build & Start

```bash
npm run build
npm start
```

### Lint & Format

```bash
npm run lint
npm run format
```

## API Structure

All API routes are prefixed with `/api/v1`:

| Module | Base Route |
|--------|-----------|
| Auth | `/api/v1/auth` |
| Users | `/api/v1/users` |
| Rooms | `/api/v1/rooms` |
| Debates | `/api/v1/debates` |
| Matchmaking | `/api/v1/matchmaking` |
| Rankings | `/api/v1/rankings` |
| AI | `/api/v1/ai` |

## Socket.IO Events

The server uses Socket.IO namespaces for real-time features:

- **Room events** — join, leave, participant updates
- **Debate events** — phase changes, turn changes, timer updates, pause/resume
- **Chat events** — messages, toxicity filtering
- **Score events** — real-time scoring updates

## Path Aliases

| Alias | Path |
|-------|------|
| `@/*` | `src/*` |
| `@config/*` | `src/config/*` |
| `@models/*` | `src/models/*` |
| `@features/*` | `src/features/*` |
| `@middleware/*` | `src/middleware/*` |
| `@socket/*` | `src/socket/*` |
| `@utils/*` | `src/utils/*` |
| `@types/*` | `src/types/*` |
