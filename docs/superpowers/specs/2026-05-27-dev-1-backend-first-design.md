# Dev 1 Backend-First Implementation Design

**Date:** 2026-05-27
**Scope:** Dev 1 work across backend and frontend, delivered in two phases with backend first.

## Goal

Complete the Dev 1 responsibilities in a way that is shippable end-to-end without depending on unfinished debate-engine or socket orchestration work. The work should first establish stable user-facing backend APIs, then connect the frontend pages and flows that depend on them.

## Why this is split into two phases

The frontend Dev 1 scope depends on user/profile/history data contracts that are currently incomplete. Implementing the backend first reduces rework, gives the frontend clear payloads to consume, and keeps testing more reliable.

## In scope

### Phase 1 — Backend Dev 1
- Add `GET /users/:id/history`
- Add `GET /users/search?q=`
- Tighten avatar URL validation in `backend/src/features/user/user.schema.ts`
- Update docs that track API/todo state after implementation

### Phase 2 — Frontend Dev 1
- Complete `ProfilePage`
- Add `HistoryPage`
- Complete leaderboard-related Dev 1 UI
- Connect frontend services/routes/query usage to the new backend APIs
- Close any auth/token-refresh gaps that block the Dev 1 flows in practice

## Out of scope

- Matchmaking service
- Debate orchestration service
- Socket event expansion beyond what Dev 1 pages strictly need
- Ranking algorithm / ELO engine redesign
- Broad refactors unrelated to Dev 1 deliverables
- Advanced search features (fuzzy search, filters, pagination-heavy search UX, admin moderation search)

## Current codebase constraints

### Backend
- User routes currently include public profile, stats, and profile update, but not history or search.
- `DebateSession` exists, but the response shape for history is not yet standardized for frontend consumption.
- `User` profile update validation already exists, so avatar validation should extend the existing schema rather than introducing a separate validation layer.

### Frontend
- `authStore` and `api.ts` already implement a token + refresh-token-in-store flow.
- `ProfilePage`, `LeaderboardPage`, and service files already exist, so the work should prefer completing them rather than replacing them.
- There is no existing `HistoryPage` route in the current route table, so this will need to be added explicitly.

## Recommended backend design

### 1. User history API

Add `GET /api/v1/users/:id/history` to `backend/src/features/user/user.routes.ts`.

**Behavior:**
- Accept `page` and `limit` query params with simple defaults.
- Query completed `DebateSession` rows related to the user.
- Return paginated results in the existing success/pagination response style already used elsewhere in the backend.

**Recommended payload shape:**
Each item should give the frontend enough information to render a history card/list without extra API joins:
- `sessionId`
- `roomId`
- `roomTitle`
- `motion`
- `format`
- `status`
- `startedAt`
- `endedAt`
- `userSide` or equivalent user role/team indicator if derivable
- winner/result summary if present in session/room

**Design principle:**
Do not try to backfill the entire ideal debate transcript model. Return a minimal, stable list payload that matches the current stored data and can support a history page immediately.

### 2. User search API

Add `GET /api/v1/users/search?q=` to `backend/src/features/user/user.routes.ts`.

**Behavior:**
- Require a non-empty `q` query string.
- Match against `username` and `profile.displayName`.
- Return a small fixed result set (for example 10–20 items max).
- Exclude sensitive/internal fields.

**Why this design:**
The goal is to support Dev 1 product flows, not build a general search subsystem. A bounded query keeps implementation simple and protects performance.

### 3. Avatar validation

Tighten the existing profile update schema in `backend/src/features/user/user.schema.ts`.

**Behavior:**
- If `avatar` is provided, it must be a valid URL.
- Allow omission / empty nullable behavior only if that already matches the current profile editing semantics.

**Why here:**
This is the narrowest change that improves data quality without adding new middleware or broader validation infrastructure.

## Recommended frontend design

### 1. Profile page

Complete `frontend/src/pages/user/ProfilePage.tsx` so it can:
- load public profile data
- allow the owner to edit profile fields supported by the backend
- submit avatar updates through the existing user service flow
- display validation/API errors clearly enough for user correction

### 2. History page

Add a dedicated history page and route.

**Behavior:**
- Load `GET /users/:id/history`
- Render a paginated list of past debates
- Show the minimum useful summary per item: room title/motion/format/result/date
- Empty state when there is no history

**Placement:**
This should live under the user-facing routes and be reachable from the profile area or an equivalent user route pattern already present in the app.

### 3. Leaderboard UI

Complete `frontend/src/pages/ranking/LeaderboardPage.tsx` and any small helper UI needed for Dev 1 scope.

**Behavior:**
- consume the existing leaderboard API
- show rank, identity, ELO, and tier in a stable list/table UI
- only introduce a badge/helper component if the existing page is already too cluttered or if a small reusable view is obviously warranted

### 4. Auth / API flow gap handling

Do not redesign auth. Only fix frontend auth/data-layer behavior if it blocks the Dev 1 pages from functioning end-to-end.

Examples of acceptable fixes:
- query/auth bootstrapping issue that prevents page loads after refresh
- user service wiring issue that blocks profile update/history fetch
- refresh flow mismatch that prevents Dev 1 pages from loading authenticated data

## Data flow

### Phase 1 backend flow
1. Client requests `/users/:id/history` or `/users/search?q=`.
2. User routes validate params/query.
3. Route queries `User`, `DebateSession`, and related room data as needed.
4. Route shapes a minimal frontend-friendly payload.
5. Route returns via existing response helpers.

### Phase 2 frontend flow
1. Route/page loads based on URL and current auth state.
2. Service calls backend through `api.ts`.
3. React Query caches and exposes loading/error/data states.
4. Page renders list/form states.
5. Profile edits post back through the existing user service.

## Testing strategy

### Backend
- Verify new user routes with focused route-level/manual API checks.
- Validate search edge cases: empty query, no matches, partial matches.
- Validate history pagination and empty-history behavior.
- Validate avatar URL acceptance/rejection cases.

### Frontend
- Verify profile edit golden path.
- Verify invalid avatar input surfaces backend validation failure cleanly.
- Verify history page for both empty and populated history.
- Verify leaderboard page renders with live API data.
- Verify authenticated refresh/reload still works for these pages.

## Risks and mitigations

### Risk: DebateSession data is incomplete for ideal history UX
**Mitigation:** shape the API around currently reliable fields and degrade gracefully where winner/result detail is missing.

### Risk: Search scope expands beyond Dev 1
**Mitigation:** keep search to a single simple query parameter and bounded results.

### Risk: Frontend pages pull in unrelated auth or routing bugs
**Mitigation:** only fix the smallest auth/routing/data issues required for Dev 1 flows.

## File-level design targets

### Backend likely touched
- `backend/src/features/user/user.routes.ts`
- `backend/src/features/user/user.schema.ts`
- possibly `backend/src/models/User.ts` only if needed for search projection expectations
- possibly `backend/src/models/DebateSession.ts` only if current fields make history shaping impossible without a small additive change

### Frontend likely touched
- `frontend/src/pages/user/ProfilePage.tsx`
- `frontend/src/pages/user/HistoryPage.tsx` (new)
- `frontend/src/pages/ranking/LeaderboardPage.tsx`
- `frontend/src/routes/index.tsx`
- `frontend/src/services/userService.ts`
- possibly `frontend/src/services/rankingService.ts`
- possibly `frontend/src/types/index.ts`
- possibly a small shared component if needed, but only if it reduces duplication cleanly

## Recommended delivery sequence

1. Implement backend history API
2. Implement backend search API
3. Tighten avatar validation
4. Update backend docs status
5. Implement frontend history page and route
6. Complete profile page against real backend contract
7. Complete leaderboard page
8. Fix only the auth/data-layer gaps that block those pages
9. Reconcile docs status again after frontend completion

## Acceptance criteria

### Backend complete when
- `GET /users/:id/history` works with pagination
- `GET /users/search?q=` returns bounded user results
- invalid avatar URLs are rejected by profile update validation
- docs reflect the new backend status accurately

### Frontend complete when
- profile page can view and update supported fields
- history page loads and renders real backend data
- leaderboard page renders current ranking data cleanly
- these flows work with the existing auth/token refresh mechanism in practice

## Recommendation

Proceed with the backend-first plan exactly as scoped above. It gives the Dev 1 work a usable vertical slice without waiting on unfinished debate/matchmaking systems, and it avoids overbuilding features that are outside MVP-critical flow.
