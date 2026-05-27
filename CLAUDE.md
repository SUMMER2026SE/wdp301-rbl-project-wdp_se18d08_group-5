# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is split into two independently managed TypeScript apps:

- `frontend/` — Vite + React SPA for the AI Debate Platform
- `backend/` — Express + Socket.IO API server backed by MongoDB

Install dependencies and run commands from the relevant subdirectory, not the repository root.

## Common commands

### Frontend (`frontend/`)

```bash
npm install
npm run dev
npm run build
npm run lint
npm run format
```

- Dev server runs on `http://localhost:5173`
- Vite proxies `/api` and `/socket.io` to `http://localhost:3000`, but the backend default port in code is `4300`; align env/config before relying on local integration

### Backend (`backend/`)

```bash
npm install
npm run dev
npm run build
npm start
npm run lint
npm run format
```

- `npm run dev` uses `tsx watch src/server.ts`
- Production entrypoint is `dist/server.js`

## Environment

### Frontend env

Expected in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_SOCKET_URL=http://localhost:3000
```

Frontend runtime config is read from `frontend/src/config/env.ts`.

### Backend env

Backend defaults are defined in `backend/src/config/env.ts`. Important variables:

```env
PORT=4300
MONGODB_URI=mongodb://localhost:27017/ai-debate-platform
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=
GOOGLE_CLIENT_ID=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
```

The backend will start with code defaults if env vars are missing, so verify actual port and credential values before debugging frontend/backend integration.

## High-level architecture

### Frontend

The frontend is a route-driven SPA initialized in `frontend/src/main.tsx`:

- React Query is configured globally with 5-minute stale time and `refetchOnWindowFocus: false`
- Routing uses `useRoutes()` with a central route table in `frontend/src/routes/index.tsx`
- `useAuthInit()` runs on app startup to hydrate the auth session by calling `authService.getMe()` when a stored access token exists

Key frontend layers:

- `src/routes/` — top-level route tree, lazy loading, protected-route boundaries
- `src/layouts/` — `MainLayout` for general pages and `DebateLayout` for live debate screens
- `src/services/` — Axios-based API clients and feature service wrappers
- `src/stores/` — Zustand stores for auth and debate state
- `src/hooks/` — app bootstrapping and socket integration hooks such as `useSocket` / `useDebateSocket`
- `src/pages/` — feature pages grouped by domain (auth, room, debate, ranking, matchmaking, replay, user)

Authentication flow on the frontend depends on `frontend/src/services/api.ts`:

- every request attaches the access token from the auth store
- `401` responses trigger refresh-token exchange via `/auth/refresh-token`
- refresh failure logs the user out and redirects to `/login`

### Backend

The backend is an Express API plus Socket.IO server:

- `backend/src/server.ts` creates the HTTP server, initializes Socket.IO, connects MongoDB, then starts listening
- `backend/src/app.ts` wires middleware, health check, rate limiting, and mounts REST routes under `/api/v1/*`

Key backend layers:

- `src/config/` — env parsing and Mongo connection
- `src/features/` — feature modules; each feature owns its routes and, where needed, controllers/services/schemas
- `src/models/` — Mongoose persistence models for users, rooms, sessions, queue, and messages
- `src/middleware/` — JWT auth guard, Zod validation, rate limiting, 404, and global error handling
- `src/socket/` — real-time room/chat/debate handlers plus timer coordination
- `src/utils/` — shared error, JWT, token, async, and response helpers

Important backend behavior:

- REST routes are versioned under `/api/v1`
- Socket.IO connections require a JWT in `socket.handshake.auth.token`
- Socket handlers are registered centrally in `backend/src/socket/index.ts`
- AI analysis and moderation live in `backend/src/features/ai/ai.service.ts` and currently use the OpenAI SDK (`gpt-4o`)
- auth logic in `backend/src/features/auth/auth.service.ts` supports local login, Google login, email verification, password reset, and refresh-token issuance

## Domain model and product flow

This codebase implements an AI-assisted debate platform with both synchronous API flows and real-time match flows.

Core backend entities:

- `User` — auth, role, profile, provider, verification/reset state
- `DebateRoom` — room setup and participation state
- `DebateSession` — live or completed debate session state
- `MatchQueue` — ranked matchmaking queue
- `Message` — room/debate chat history

Typical live debate flow:

1. Users authenticate through REST endpoints.
2. Users create/join rooms or matchmaking through REST APIs.
3. The frontend opens Socket.IO connections using the authenticated token.
4. Room/chat/debate socket handlers coordinate presence, turn changes, timers, and live updates.
5. AI services score speeches, summarize debates, and moderate toxicity.

## Routing and API shape

Backend REST modules currently mount at:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/rooms`
- `/api/v1/matchmaking`
- `/api/v1/debate`
- `/api/v1/ai`
- `/api/v1/rankings`

Frontend route definitions are centralized in `frontend/src/routes/index.tsx`, with `ProtectedRoute` gating authenticated pages and a separate `/debate/:roomId` layout for live debate sessions.

## Path aliases

Both apps rely on TS path aliases; prefer them over deep relative imports.

- Frontend aliases are configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`
- Backend aliases are configured in `backend/tsconfig.json`

## Notes for future work

- There is no root workspace script layer; frontend and backend commands are separate.
- The frontend README documents backend URLs as port `3000`, while backend code defaults to `4300`. Treat local port mismatches as a first debugging checkpoint.
- The repo root `README.md` is not project documentation; the useful setup details live in `frontend/README.md` and `backend/README.md`.
