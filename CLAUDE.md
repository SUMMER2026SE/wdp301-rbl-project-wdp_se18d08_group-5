# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This repo is split into two independently managed TypeScript apps:

- `frontend/` — Vite + React SPA for the AI Debate Platform
- `backend/` — Express + Socket.IO API server backed by MongoDB
- `docs/` — product, MVP scope, technical requirement, Socket.IO, and AI integration documents; `README 2.md` is the documentation index that points to the useful files

Install dependencies and run commands from the relevant subdirectory, not the repository root.

## Common commands

### Frontend (`frontend/`)

```bash
npm install
npm run dev
npm run build
npm run lint
npm run format
npm run preview
```

- Dev server runs on `http://localhost:5173`
- Frontend runtime config lives in `frontend/src/config/env.ts`
- API and Socket defaults in code point to port `4300`; if docs or local env mention `3000`, verify which backend port is actually running before debugging integration

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
- Server startup sequence is: create HTTP server, initialize Socket.IO, connect MongoDB, then listen

### Tests

- There is currently no `npm test` script in either `frontend/package.json` or `backend/package.json`
- There is no standard single-test command configured yet
- A standalone file `frontend/verify-i18n.spec.js` exists, but there is no test runner config in the repo to treat it as a normal automated test suite

## Environment

### Frontend env

Expected in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:4300/api/v1
VITE_SOCKET_URL=http://localhost:4300
VITE_GOOGLE_CLIENT_ID=
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

- React Query is configured globally with 5-minute stale time, `retry: 1`, and `refetchOnWindowFocus: false`
- Routing uses `useRoutes()` with a central route table in `frontend/src/routes/index.tsx`
- `App` is thin and mainly bootstraps auth hydration through `useAuthInit()` before rendering the route tree

Key frontend layers:

- `src/routes/` — top-level route tree, lazy loading, protected-route boundaries
- `src/layouts/` — `MainLayout` for general pages and `DebateLayout` for live debate screens
- `src/services/` — Axios-based API clients and feature service wrappers
- `src/stores/` — Zustand stores for auth and debate/session state
- `src/hooks/` — app bootstrapping and socket integration hooks such as `useSocket` / `useDebateSocket`
- `src/pages/` — feature pages grouped by domain (auth, room, debate, ranking, matchmaking, replay, user, matches)
- `src/i18n/` — translation bootstrap loaded at app startup

Authentication flow on the frontend depends on `frontend/src/services/api.ts` and `frontend/src/stores/authStore.ts`:

- auth state is persisted in Zustand storage under `auth-storage`
- every API request attaches the access token from the auth store
- `401` responses trigger refresh-token exchange via `/auth/refresh-token`
- refresh failure logs the user out and redirects to `/login`
- `useAuthInit()` calls `authService.getMe()` on startup when a stored access token exists

Live debate state is split between transport hooks and local store state:

- Socket connections authenticate with the JWT and drive room/debate/chat events
- `debateStore` tracks room metadata, participants, current phase/speaker, timer state, cross-examination counters, chat messages, and per-speaker scores

### Backend

The backend is an Express API plus Socket.IO server:

- `backend/src/server.ts` creates the HTTP server, initializes Socket.IO, connects MongoDB, then starts listening
- `backend/src/app.ts` wires middleware, health check, API rate limiting on `/api`, and mounts REST routes under `/api/v1/*`

Key backend layers:

- `src/config/` — env parsing and Mongo connection
- `src/features/` — feature modules; routes hold most request handling logic directly, with auth and AI using service classes
- `src/models/` — Mongoose persistence models for users, rooms, sessions, queue, and messages
- `src/middleware/` — JWT auth guard, Zod validation, rate limiting, 404, and global error handling
- `src/socket/` — real-time room/chat/debate handlers plus timer coordination
- `src/utils/` — shared error, JWT, token, async, and response helpers

Important backend behavior:

- REST routes are versioned under `/api/v1`
- Socket.IO connections require a JWT in `socket.handshake.auth.token`
- socket auth middleware decodes the access token once and attaches `userId` and `userRole` to the socket before registering handlers
- Socket handlers are registered centrally in `backend/src/socket/index.ts`
- auth logic in `backend/src/features/auth/auth.service.ts` supports local login, Google login, email verification, password reset, change password, and refresh-token issuance
- AI analysis and moderation live in `backend/src/features/ai/ai.service.ts` and currently use the OpenAI SDK with `gpt-4o`

Backend feature boundaries are product-oriented:

- `auth` handles account lifecycle and token issuance
- `room` handles custom room creation, join/leave, role/position selection, and debate start
- `matchmaking` manages ranked queue entry and queue status
- `debate` handles host controls, scoring endpoints, session lookup, and replay data
- `ranking` and `user` expose leaderboard/profile data

## Domain model and product flow

This codebase implements an AI-assisted debate platform with both synchronous API flows and real-time match flows.

Core backend entities:

- `User` — auth, role, profile, ranking, provider, verification/reset state
- `DebateRoom` — room setup, participants, host/judge settings, and live room status
- `DebateSession` — live or completed debate session state, scoring, cards, and replay data
- `MatchQueue` — ranked matchmaking queue
- `Message` — room/debate chat history

Typical live debate flow:

1. Users authenticate through REST endpoints.
2. Users create/join rooms or enter ranked matchmaking through REST APIs.
3. The frontend persists tokens locally, hydrates the current user on reload, and opens Socket.IO connections with the authenticated token.
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

Frontend route definitions are centralized in `frontend/src/routes/index.tsx`:

- `MainLayout` owns public pages and authenticated non-debate pages
- `ProtectedRoute` gates room creation, lobby, matchmaking, change-password, and the live debate route
- live debate uses a separate `/debate/:roomId` layout path via `DebateLayout`
- replay is exposed separately at `/replay/:sessionId`

## Path aliases

Both apps rely on TS path aliases; prefer them over deep relative imports.

- Frontend aliases are configured in `frontend/tsconfig.json` and `frontend/vite.config.ts`
- Backend aliases are configured in `backend/tsconfig.json`

## Project documents worth checking

- `frontend/README.md` and `backend/README.md` contain setup-focused app-specific notes
- `README 2.md` is the real documentation index for product and technical docs
- `docs/04_TRD_Technical_Requirements.md` covers API/schema expectations
- `docs/07_AI_Integration_Guide.md` and `docs/08_Socket_Realtime_Guide.md` describe the intended AI and realtime behavior
- MVP scope was reduced and locked in docs; avoid assuming older features from early planning docs are still in scope

## Suggested improvements to this file

If you revise this file later, the highest-value additions would be:

- exact test commands once a real frontend or backend test runner is added
- deployment or local integration notes only after the frontend/backend port mismatch is resolved in code and docs
- any architectural updates if route handlers are refactored out of route files into controllers/services more consistently
