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

- Node.js >= 22
- npm >= 9
- MongoDB >= 6

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=4300
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ai-debate
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
OPENAI_API_KEY=your-openai-api-key
GEMINI_API_KEY=your-live-translation-key
GEMINI_AGENT_API_KEYS=your-ai-judge-key
GEMINI_AGENT_MODEL=gemini-3.5-flash-lite
GEMINI_AGENT_TIMEOUT_MS=60000
GEMINI_LIVE_MODEL=gemini-3.5-live-translate-preview
CLIENT_URL=http://localhost:5173
```

`GEMINI_API_KEY` is reserved for server-side Gemini Live translation. Never
place it in a `VITE_*` variable or expose it to the browser.
`GEMINI_AGENT_API_KEYS` is an independent, comma-separated key pool used only
by AI Judge and final debate analysis. Do not reuse the translation key here.

### Development

```bash
npm run dev
```

### Build & Start

```bash
npm run build
npm start
```

## Northflank Deployment

Configure the Northflank backend service as follows:

- Build type: Dockerfile
- Build context: `/backend`
- Dockerfile: `/backend/Dockerfile`
- Public HTTP port: `4300` (or the same value supplied through `PORT`)
- Liveness path: `/health`
- Translation readiness path: `/health/translation`
- AI Judge readiness path: `/health/ai-judge`
- Instances: `1` unless a shared Socket.IO adapter such as Redis is configured

Add the following values under the backend service's runtime environment or
secret group, then redeploy the service:

```env
NODE_ENV=production
PORT=4300
MONGODB_URI=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_URL=https://your-frontend-domain
GEMINI_API_KEY=...
GEMINI_LIVE_MODEL=gemini-3.5-live-translate-preview
```

AI judge keys remain separate:

```env
GEMINI_AGENT_API_KEYS=...
GEMINI_AGENT_MODEL=gemini-3.5-flash-lite
GEMINI_AGENT_TIMEOUT_MS=60000
```

The local `.env` file is intentionally excluded from the container. Updating
it does not update Northflank; change the service's runtime secrets and trigger
a new deployment instead. `/health/translation` returns HTTP `503` when the
Live Translate key or model is missing, so it can be used as a Northflank
readiness check without exposing the secret. `/health/ai-judge` separately
returns HTTP `503` when the AI Judge key pool or model is missing. It exposes
only the configured key count, model name, and timeout—not the keys.

AI Judge calls have a bounded timeout and rotate through the configured key
pool on authentication, quota, timeout, and upstream server errors. If the
final Judge call still fails, the debate is completed with a pending result;
no fake 0–0 draw is created and ranked ELO is not changed. A participant or
admin can retry `POST /api/v1/debate/:roomId/final-analysis`; ranking is applied
only after that retry produces a valid official result.

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
