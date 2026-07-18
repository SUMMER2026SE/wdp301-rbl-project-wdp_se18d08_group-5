# Debate Lifecycle Test Report

Date: 2026-07-04  
Branch tested: `roomDeabte` after merge `origin/roomDebatev2`  
Scope: 4 rule docs:

- `docs/rule_host_judgeAI.md`
- `docs/rule_host_judgeHuman.md`
- `docs/rule_noHost_JudgeAI.md`
- `docs/rule_noHost_JudgeHuman.md`

## Test Method

I created a temporary smoke-test harness, ran it against a temporary local MongoDB test database, then removed the harness. No backend fix was kept.

Command used:

```bash
$env:NODE_PATH=(Resolve-Path backend\node_modules).Path
backend\node_modules\.bin\tsx scripts/debate-lifecycle-smoke.ts
```

The test seeded 4 room modes:

- Host + AI Judge
- Host + Human Judge
- No Host + AI Judge
- No Host + Human Judge

It covered:

- Host/Judge controller skip
- Debater speech skip
- Prep skip by both teams
- Cross-exam skip by both teams
- Pause/resume by host
- Pause/resume by Judge S1 controller
- Debater team pause/resume
- Draw
- Surrender

## Summary

PASS:

- Pause/resume works for Host.
- Pause/resume works for Judge S1 controller through the HTTP guard.
- Debater team pause/resume works.
- Draw works in all 4 room modes.
- Surrender works in all 4 room modes.

FAIL:

- Backend 3v3 lifecycle order does not match docs/frontend in Round 3.
- No Host + AI Judge does not actually wait for both S1 debaters before starting.
- No Host + Human Judge start fails when Judge S1 has `speakerSlot = null`.
- Host skip / prep consensus skip can get stuck because `currentTurn.status = "transition"` is not allowed by schema.
- Because of the transition schema error, host skip and prep/CE consensus skip cannot be trusted end-to-end yet.

## Findings

### 1. Round 3 backend order conflicts with docs/frontend

Expected from docs and frontend:

```text
PRO_S3 -> OPP_S3 -> JUDGES_FB_3
```

Actual backend flow:

```text
OPP_S3 -> PRO_S3 -> JUDGES_FB_3
```

Evidence:

- Backend Host 3v3 uses `OPP_S3` before `PRO_S3`: `backend/src/features/debate/debate.service.ts:64`
- Backend Host 1v1 uses `OPP_S3` before `PRO_S3`: `backend/src/features/debate/debate.service.ts:100`
- Backend NoHost 3v3 uses `OPP_S3` before `PRO_S3`: `backend/src/features/debate/debate.service.ts:144`
- Frontend shows `PRO_S3` before `OPP_S3`: `frontend/src/pages/debate/DebateRoomPage.tsx:78`

Impact:

- UI highlights one speaker order, backend authorizes another.
- Debater skip can fail for the person frontend thinks is active.
- Round 3 scoring/announcements can be misleading.

### 2. NoHost + AI Judge does not wait for both S1 starts

Rule says both teams' S1 debaters must press Start.

Actual behavior from smoke test:

- First S1 debater pressing Start immediately creates the debate session.
- No pending consensus response is returned.
- The old `debater:s1-start` socket flow is absent in current backend.

Evidence:

- `startDebate()` authorizes any S1 debater directly: `backend/src/features/debate/debate.service.ts:362`
- Search found no active `s1StartConsensus` / `debater:s1-start` implementation in backend socket files.
- Frontend still lets NoHost+AI S1 press Start via `/rooms/:id/start`: `frontend/src/pages/room/LobbyPage.tsx:230`

Impact:

- One team can start the match without the other team agreeing.
- This breaks `rule_noHost_JudgeAI.md`.

### 3. NoHost + Human Judge S1 can be blocked by `speakerSlot === 'S1'`

Rule says Judge S1 is the controller. In this codebase, judge assignment sets `speakerSlot = null`.

Evidence:

- Assigning judge sets `speakerSlot = null`: `backend/src/features/room/room.routes.ts:821`
- Shared permission helper treats first judge in `room.judges` as controller: `backend/src/utils/roomPermissions.ts:21`
- But `startDebate()` requires judge `speakerSlot === 'S1'`: `backend/src/features/debate/debate.service.ts:366`
- Other service methods repeat the same direct check: `backend/src/features/debate/debate.service.ts:415`, `452`, `527`, `1190`, `1293`

Smoke-test result:

```text
FAIL NoHost+Human Judge S1 can start even when judge speakerSlot is null
Error: Only the room owner or authorized debate controller can start the debate
```

Impact:

- Judge S1 may see controller UI permission but backend service still rejects start/skip/end.
- NoHost+Human lifecycle can be blocked at match start or controller actions.

### 4. Host skip / transition fails because schema rejects `transition`

`triggerTransition()` writes `currentTurn.status = "transition"`, but schema only allows:

```text
active, paused, completed, waiting_to_start
```

Evidence:

- `triggerTransition()` sets transition phase/status: `backend/src/features/debate/debate.service.ts:652`
- Schema enum does not include `transition`: `backend/src/models/DebateSession.ts:98`

Smoke-test error:

```text
DebateSession validation failed:
currentTurn.status: `transition` is not a valid enum value for path `currentTurn.status`
```

Impact:

- Host skip from preparation stayed stuck at `BOTH_TEAMS_PREP`.
- Prep consensus skip also stayed stuck.
- Any phase transition path that saves `"transition"` can fail before advancing.

### 5. Skip / consensus test results

Host skip:

- Expected: prep -> PRO_S1
- Actual: stayed at `BOTH_TEAMS_PREP`
- Root cause: schema rejects `currentTurn.status = "transition"`

Debater speech skip:

- Unauthorized speaker was correctly rejected.
- Active speaker path depends on transition working; current schema issue blocks reliable end-to-end result.

Prep consensus skip:

- First S1 skip alone did not transition: correct.
- After both teams S1 skip, expected transition to `PRO_S1`.
- Actual stayed at prep because of transition schema error.

CE consensus skip:

- Test was included, but transition reliability is blocked by the same schema issue.

## Actions Verified As Working

### Pause / Resume

Test result: PASS.

Covered:

- Host pause/resume: PASS
- Judge S1 controller pause/resume via route guard: PASS
- Debater team pause/resume: PASS

### Draw

Test result: PASS.

Covered all 4 modes:

- Host + AI Judge
- Host + Human Judge
- No Host + AI Judge
- No Host + Human Judge

Observed behavior:

- First team request stores pending draw.
- Opposite team request completes match as `draw`.

### Surrender

Test result: PASS.

Covered all 4 modes.

Observed behavior:

- Proposition surrender completes match.
- Winner becomes `opposition`.

## Final Verdict

The debate lifecycle is not fully correct yet.

Most severe blockers:

1. `currentTurn.status = "transition"` is invalid in schema, causing skip/transition failures.
2. NoHost+AI does not enforce both S1 debaters pressing Start.
3. NoHost+Human Judge S1 controller logic is inconsistent: guard allows first judge, service checks `speakerSlot === 'S1'`.
4. Backend Round 3 order conflicts with frontend/docs.

No fixes were kept in this report pass.
