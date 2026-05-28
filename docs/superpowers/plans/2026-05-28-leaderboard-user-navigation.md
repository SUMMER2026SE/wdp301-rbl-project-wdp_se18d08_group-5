# Leaderboard User Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click another player in the leaderboard to open that player's public profile, then navigate to that player's debate history from the profile page, while keeping the current user's own row non-clickable.

**Architecture:** Reuse the existing public profile route (`/profile/:userId`) and history route (`/profile/:userId/history`) instead of adding new pages or backend endpoints. The change stays entirely in the frontend leaderboard presentation layer: render other users as navigation controls in the player column, preserve the current row highlight for the signed-in user, and keep the profile page as the single entry point to history.

**Tech Stack:** React 18, TypeScript, React Router v6, React Query, React Bootstrap, Vite, ESLint

---

## File Structure

- **Modify:** `frontend/src/pages/ranking/LeaderboardPage.tsx`
  - Add router navigation behavior for leaderboard entries.
  - Render non-self player cells as clickable controls.
  - Keep the signed-in user row visually highlighted but not clickable.
- **Verify only:** `frontend/src/pages/user/ProfilePage.tsx`
  - Confirm the existing `Xem lịch sử tranh biện` button already routes to `/profile/:userId/history` and needs no code change.
- **Verify only:** `frontend/src/routes/index.tsx`
  - Confirm the existing public routes already support `/profile/:userId` and `/profile/:userId/history`.

### Task 1: Make leaderboard players navigable

**Files:**
- Modify: `frontend/src/pages/ranking/LeaderboardPage.tsx`
- Verify: `frontend/src/pages/user/ProfilePage.tsx:120-126`
- Verify: `frontend/src/routes/index.tsx:46-57`

- [ ] **Step 1: Read the current leaderboard page and confirm the existing player cell structure**

Review this block in `frontend/src/pages/ranking/LeaderboardPage.tsx` so the implementation keeps the current avatar/name layout and row highlight logic:

```tsx
<tbody>
  {entries.map((entry) => (
    <tr key={entry._id} className={entry._id === currentUserId ? 'table-primary' : undefined}>
      <td>{entry.rank}</td>
      <td>
        <div className="d-flex align-items-center gap-2">
          <img
            src={entry.avatar || 'https://via.placeholder.com/40?text=U'}
            alt={entry.displayName || entry.username}
            width={40}
            height={40}
            className="rounded-circle object-fit-cover"
          />
          <div>
            <div className="fw-semibold">{entry.displayName || entry.username}</div>
            <div className="text-muted small">@{entry.username}</div>
          </div>
        </div>
      </td>
      <td>{entry.elo}</td>
      <td>
        <RankBadge tier={entry.tier} />
      </td>
      <td>{entry.wins}/{entry.losses}</td>
    </tr>
  ))}
</tbody>
```

- [ ] **Step 2: Write the minimal leaderboard navigation implementation**

Update `frontend/src/pages/ranking/LeaderboardPage.tsx` to import `useNavigate`, compute whether a row belongs to the current user, and wrap only other users' player cells in a button-styled control:

```tsx
import { useState } from 'react';
import { Alert, Button, Container, Pagination, Table } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { RankBadge } from '@components/ranking/RankBadge';
import { rankingService } from '@services/rankingService';
import { useAuthStore } from '@stores/authStore';

const PAGE_SIZE = 20;
const fallbackAvatar = 'https://via.placeholder.com/40?text=U';

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?._id);

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: async () => {
      const response = await rankingService.getLeaderboard({ page, limit: PAGE_SIZE });
      return response.data.data;
    },
  });

  if (leaderboardQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (leaderboardQuery.isError) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{(leaderboardQuery.error as Error).message || 'Không thể tải leaderboard.'}</Alert>
      </Container>
    );
  }

  const entries = leaderboardQuery.data ?? [];

  return (
    <Container className="py-4">
      <div className="mb-4">
        <h2>
          <i className="bi bi-trophy me-2" />
          Bảng xếp hạng
        </h2>
        <p className="landing-subtitle mb-0">Xếp hạng ELO hiện tại của người chơi.</p>
      </div>

      {entries.length === 0 ? (
        <Alert variant="info">No rankings yet.</Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table hover bordered>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Người chơi</th>
                  <th>ELO</th>
                  <th>Tier</th>
                  <th>W/L</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isCurrentUser = entry._id === currentUserId;
                  const playerContent = (
                    <div className="d-flex align-items-center gap-2 text-start">
                      <img
                        src={entry.avatar || fallbackAvatar}
                        alt={entry.displayName || entry.username}
                        width={40}
                        height={40}
                        className="rounded-circle object-fit-cover"
                      />
                      <div>
                        <div className="fw-semibold">{entry.displayName || entry.username}</div>
                        <div className="text-muted small">@{entry.username}</div>
                      </div>
                    </div>
                  );

                  return (
                    <tr key={entry._id} className={isCurrentUser ? 'table-primary' : undefined}>
                      <td>{entry.rank}</td>
                      <td>
                        {isCurrentUser ? (
                          playerContent
                        ) : (
                          <Button
                            variant="link"
                            className="p-0 text-decoration-none text-reset w-100"
                            onClick={() => navigate(`/profile/${entry._id}`)}
                          >
                            {playerContent}
                          </Button>
                        )}
                      </td>
                      <td>{entry.elo}</td>
                      <td>
                        <RankBadge tier={entry.tier} />
                      </td>
                      <td>{entry.wins}/{entry.losses}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <Pagination className="justify-content-center mb-0">
            <Pagination.Prev disabled={page === 1} onClick={() => setPage((current) => current - 1)} />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next disabled={entries.length < PAGE_SIZE} onClick={() => setPage((current) => current + 1)} />
          </Pagination>
        </>
      )}
    </Container>
  );
}
```

- [ ] **Step 3: Run frontend lint to catch TypeScript/JSX issues**

Run: `npm run lint --prefix frontend`
Expected: command exits successfully with no ESLint errors in `LeaderboardPage.tsx`

- [ ] **Step 4: Start the frontend and verify the interaction manually**

Run: `npm run dev --prefix frontend`
Then open the app at `http://localhost:5173/leaderboard` and verify:

1. Clicking another user's avatar/name area opens `/profile/<their-id>`.
2. The signed-in user's row remains highlighted and is not clickable.
3. On the opened profile page, clicking `Xem lịch sử tranh biện` opens `/profile/<their-id>/history`.
4. The existing history list still loads and the back button returns to that user's profile.

Expected: all four checks pass with no console errors.

- [ ] **Step 5: Commit the change**

```bash
git add frontend/src/pages/ranking/LeaderboardPage.tsx
git commit -m "feat(ranking): open public profile from leaderboard"
```

## Self-Review

- **Spec coverage:** The approved design required clicking another user from the leaderboard, landing on that user's profile first, preserving self-row behavior, and reusing the existing history flow. Task 1 covers all of those requirements.
- **Placeholder scan:** No TODO/TBD placeholders remain. Every step names the exact file or command to use.
- **Type consistency:** The plan consistently uses `entry._id`, `currentUserId`, `/profile/:userId`, and `/profile/:userId/history`, matching the current route and page code.
