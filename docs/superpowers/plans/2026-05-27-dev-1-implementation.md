# Dev 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all Dev 1 backend-first features: user history API, user search API, avatar validation, then connect frontend history/profile/leaderboard pages to real APIs.

**Architecture:** Backend exposes two new REST endpoints (`/users/:id/history`, `/users/search`) and tightens avatar Zod validation. Frontend adds a history page + route, completes the leaderboard page, and wires existing profile page to real backend. No auth redesign.

**Tech Stack:** Express + Mongoose (backend), React + React Query + Axios (frontend), Zod (validation).

---

## File Map

### Backend (Phase 1)

| File | Role |
|------|------|
| `backend/src/features/user/user.routes.ts` | Add history + search routes |
| `backend/src/features/user/user.schema.ts` | Tighten avatar validation |
| `backend/src/models/DebateSession.ts` | Read-only — confirm field names for history shaping |
| `backend/src/models/DebateRoom.ts` | Read-only — confirm room title/motion fields |
| `docs/12_API_Endpoints_MVP.md` | Mark history + search as ✅ |
| `docs/13_Todo_List_MVP.md` | Mark A1-01, A1-02, A1-03 as ✅ |

### Frontend (Phase 2)

| File | Role |
|------|------|
| `frontend/src/routes/index.tsx` | Add `/users/:id/history` route |
| `frontend/src/pages/user/HistoryPage.tsx` | New — paginated history list |
| `frontend/src/services/userService.ts` | Add `getHistory`, `searchUsers` methods |
| `frontend/src/pages/ranking/LeaderboardPage.tsx` | Replace placeholder with real data |
| `frontend/src/pages/user/ProfilePage.tsx` | Verify backend contract, minor polish |
| `frontend/src/types/index.ts` | Add `DebateHistoryItem`, `UserSearchResult` types |
| `docs/12_API_Endpoints_MVP.md` | Mark F6-01 as ✅ |
| `docs/13_Todo_List_MVP.md` | Mark F1-03, F1-04, F6-01 as ✅ |

---

## Phase 1 — Backend

### Task 1: `GET /users/:id/history`

**Files:**
- Modify: `backend/src/features/user/user.routes.ts`
- Read: `backend/src/models/DebateSession.ts`, `backend/src/models/DebateRoom.ts`

**Route:** `GET /api/v1/users/:id/history?page=1&limit=10`
**Actor:** Authenticated user (any actor can view any user's public history — scope kept simple per design spec)

**Payload shape per item:**
```json
{
  "sessionId": "string",
  "roomId": "string",
  "roomTitle": "string",
  "motion": "string",
  "format": "1v1 | 3v3",
  "status": "completed | cancelled | ...",
  "startedAt": "ISO8601",
  "endedAt": "ISO8601 | null",
  "userSide": "proposition | opposition",
  "userRole": "debater | judge | viewer",
  "result": "win | loss | draw | null"
}
```

**Implementation path:**
1. Read `DebateSession` and `DebateRoom` models to confirm exact field names for `motion`, `format`, `status`, `startedAt`, `endedAt`.
2. Confirm how to derive `userSide` and `userRole` from session participants — likely join with `participants` array on session.
3. Add route with `page`/`limit` query params, simple defaults.
4. Return paginated response in existing `{ success, data, message, pagination }` pattern.

**Acceptance:** Returns paginated list for a known user ID; empty list for user with no history; 404 if user not found.

---

### Task 2: `GET /users/search?q=`

**Files:**
- Modify: `backend/src/features/user/user.routes.ts`

**Route:** `GET /api/v1/users/search?q=query`
**Actor:** Any authenticated user

**Constraints:**
- Require non-empty `q` (minimum 2 chars)
- Match against `username` and `profile.displayName` using `$or` regex
- Max 20 results
- Exclude sensitive fields (`email`, `password`, tokens, `refreshToken`)

**Payload shape:**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "username": "string",
      "displayName": "string",
      "avatar": "string | null",
      "elo": number,
      "tier": "string"
    }
  ]
}
```

**Implementation path:**
1. Add route with Zod query validation (require `q`, min length 2).
2. Query `User` model with `$or` on `username` and `profile.displayName`, case-insensitive regex.
3. Project only needed fields (`_id`, `username`, `profile.displayName`, `profile.avatar`, `stats.elo`, `stats.tier`).
4. Limit to 20 results.
5. Return flat `{ success, data }` (no pagination needed for search).

**Acceptance:** Returns matching users for `q`; returns empty array for no match; 400 for missing/too-short `q`.

---

### Task 3: Avatar URL validation

**Files:**
- Modify: `backend/src/features/user/user.schema.ts`
- Modify: `backend/src/features/user/user.routes.ts` (add validate middleware if not already)

**Current state:** `updateProfileSchema` likely allows arbitrary string for `avatar` field.

**Target:** If `avatar` is present in the update body, it must pass `z.string().url()` validation.

**Implementation path:**
1. Read current `updateProfileSchema` in `user.schema.ts`.
2. Add conditional URL check for `avatar` field — either as part of the schema or as a custom refinement.
3. If the schema is already correctly configured (common pattern: `z.string().url().nullable()`), verify it and do nothing.
4. Verify the `validate(updateProfileSchema)` middleware is already applied to the profile PUT route.

**Acceptance:** Submitting `{ avatar: "not-a-url" }` returns 400 with Zod validation error; submitting `{ avatar: "https://..." }` passes.

---

### Task 4: Reconcile docs

**Files:**
- Modify: `docs/12_API_Endpoints_MVP.md`
- Modify: `docs/13_Todo_List_MVP.md`

**Changes:**
- In 12_API_Endpoints_MVP.md: mark `#9 GET /users/:id/history` row as ✅, add `#9b GET /users/search` row as ✅
- In 13_Todo_List_MVP.md: mark A1-01, A1-02, A1-03 as ✅

---

## Phase 2 — Frontend

### Task 5: Add history types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Add:**
```ts
export interface DebateHistoryItem {
  sessionId: string;
  roomId: string;
  roomTitle: string;
  motion: string;
  format: '1v1' | '3v3';
  status: string;
  startedAt: string;
  endedAt: string | null;
  userSide: 'proposition' | 'opposition';
  userRole: 'debater' | 'judge' | 'viewer';
  result: 'win' | 'loss' | 'draw' | null;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  elo: number;
  tier: string;
}

export interface PaginatedHistoryResponse {
  items: DebateHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

---

### Task 6: Wire history + search into userService

**Files:**
- Modify: `frontend/src/services/userService.ts`

**Add:**
```ts
export const userService = {
  // ... existing methods ...

  getHistory(userId: string, params?: { page?: number; limit?: number }) {
    return api.get<ApiResponse<PaginatedHistoryResponse>>(`/users/${userId}/history`, { params });
  },

  searchUsers(query: string) {
    return api.get<ApiResponse<UserSearchResult[]>>('/users/search', { params: { q: query } });
  },
};
```

**Note:** Import `ApiResponse`, `PaginatedHistoryResponse`, `UserSearchResult` from types.

---

### Task 7: Add history route

**Files:**
- Modify: `frontend/src/routes/index.tsx`

**Add route:**
```tsx
{
  path: '/users/:id/history',
  element: <HistoryPage />,
},
```

**Place near** existing user routes (e.g., near `ProfilePage`).

**Also add** a nav link or link from the profile page to the history page for the current user.

---

### Task 8: HistoryPage component

**Files:**
- Create: `frontend/src/pages/user/HistoryPage.tsx`

**Behavior:**
- Read `userId` from URL params.
- Load `userService.getHistory(userId)` via React Query.
- Render paginated list: room title, motion, format, result badge (Win/Loss/Draw), date.
- Empty state: "No debate history yet."
- Loading state: `LoadingScreen` or skeleton.
- Error state: error message with retry.
- Pagination: simple prev/next buttons driven by `page`/`limit`.

**Key implementation details:**
- Use `useQuery` from `@tanstack/react-query`.
- Format dates with `new Date(...).toLocaleDateString()`.
- Color-code result: green (win), red (loss), gray (draw/null).
- Show motion truncated to 80 chars with ellipsis.
- Link each row to the room or replay (if replay URL is available).

---

### Task 9: Complete LeaderboardPage

**Files:**
- Modify: `frontend/src/pages/ranking/LeaderboardPage.tsx`

**Current state:** Placeholder with `TODO: Global ELO leaderboard table`.

**Target:** Consume `rankingService.getLeaderboard()` and render real data.

**Implementation:**
1. `useQuery(['leaderboard', page], () => rankingService.getLeaderboard({ page, limit: 20 }))`
2. Table columns: `#` (rank), Avatar+Name, ELO, Tier badge.
3. Tier badge: color-coded chip (Novice=gray, Bronze=orange, Silver=gray-silver, Gold=yellow, Platinum=cyan, Diamond=purple, Master=gold-bold, Grandmaster=rainbow).
4. Pagination controls.
5. Loading skeleton (table row placeholders).
6. Empty state ("No rankings yet.").
7. Current user row highlighted if in response.

**Note:** `rankingService.getLeaderboard` and `getUserRank` already exist and return `LeaderboardEntry[]`. Read `types/index.ts` to confirm `LeaderboardEntry` shape — if it has `rank`, `user` (with id/name/avatar), `elo`, `tier`, use those directly.

---

### Task 10: ProfilePage — verify backend contract

**Files:**
- Modify: `frontend/src/pages/user/ProfilePage.tsx`

**Current state:** Already has owner editing, avatar Zod validation, `userService.updateProfile` call.

**Checks to perform:**
- Confirm `displayName`, `bio`, `school`, `club` fields sent to backend match what `UpdateProfileRequest` type declares.
- Confirm avatar validation in frontend matches the tightened backend schema (frontend should already have `z.string().url()` for avatar).
- Add a refresh of profile after successful update to sync displayed data.
- Ensure non-owner view (read-only) works without access token.

**No major rewrite needed** — the page is already substantially implemented. Polish only.

---

### Task 11: Docs reconciliation — frontend

**Files:**
- Modify: `docs/12_API_Endpoints_MVP.md`
- Modify: `docs/13_Todo_List_MVP.md`

**Changes:**
- In 12: add frontend column notes or verify B. User/Profile section reflects history endpoint.
- In 13: mark F1-03 (Profile page), F1-04 (History page), F6-01 (Leaderboard page) as ✅.
- Mark B2-01 (API interceptors) as ⚠️ partial if token refresh works but not perfect.

---

## Testing Checklist

### Backend
- [ ] `GET /users/:id/history` — paginated response for user with history
- [ ] `GET /users/:id/history` — empty array for user with no history
- [ ] `GET /users/:id/history` — 404 for non-existent user ID
- [ ] `GET /users/search?q=alice` — returns matching users
- [ ] `GET /users/search?q=alice` — excludes sensitive fields
- [ ] `GET /users/search?q=` — 400 for missing/empty query
- [ ] `PUT /users/:id/profile` with invalid avatar URL — 400 validation error
- [ ] `PUT /users/:id/profile` with valid avatar URL — 200 + updated profile

### Frontend
- [ ] Profile page loads for public user (read-only)
- [ ] Profile page loads for own profile (editable)
- [ ] Profile edit submits and shows updated data on success
- [ ] Profile edit shows validation error for bad avatar URL
- [ ] History page loads and renders paginated debate list
- [ ] History page shows empty state when no history
- [ ] Leaderboard page renders real ELO/tier data
- [ ] Authenticated reload (F5, navigate to profile/history/leaderboard) works without crash

---

## Self-Review Against Spec

| Spec Requirement | Task |
|-----------------|------|
| `GET /users/:id/history` paginated | Task 1 |
| Search `username` + `displayName` | Task 2 |
| Bounded results (max 20) | Task 2 |
| Avatar URL validation (Zod) | Task 3 |
| History page route + component | Tasks 5, 7, 8 |
| Leaderboard page real data | Task 9 |
| Profile page completion | Task 10 |
| Docs reconciliation | Tasks 4, 11 |

No placeholder steps, no "similar to X" steps, no TODOs left in plan.
