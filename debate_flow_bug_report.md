# Senior QA Audit Report: Debate Room & Phase Transition Flows

**Project:** AI Debate Platform  
**Target Flow:** Room Creation, Role Assignment (4 Accounts / 4 Roles), Phase Skipping & State Management  
**Scope:** Frontend & Backend Code Integration, Socket Realtime Sync, REST API boundaries  
**Auditor Profile:** Senior QA / Debugging Specialist

---

## Executive Summary

During a detailed code audit of the custom room creation, role selection (4 accounts, 4 roles), and debate execution state machine, we identified **13 key bugs** ranging from critical security/permission logic blocks to race conditions, UI desynchronizations, and biased AI analysis. 

The most severe issues surround the **Room Owner** being blocked from participating as either a debater or judge, the **lack of unique role/slot validation** in the lobby, and **race conditions** when skipping phases quickly, which can spawn concurrent state machine timers and lock the room.

---

## 1. Critical Severity Bugs (Blocking Core Flow)

### BUG-01: Room Owner Blocked from Selecting Position (Debater Role)
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L885-L906)
* **Description:** 
  When the Room Owner assigns themselves to the `'debater'` role in the lobby, the `assign-role` endpoint correctly sets `participant.roomRole = 'owner'` and `participant.primaryRole = 'debater'`. However, when they try to choose their team or speaker slot using the `/position` endpoint, the API guards the call with:
  ```typescript
  if (participant.roomRole !== 'debater') {
    throw new ForbiddenError('Only assigned debaters can select team and speaker slot');
  }
  ```
  Since the owner's `roomRole` remains `'owner'`, they are blocked with a `403 Forbidden` error.
* **Reproduction Steps:**
  1. Create a custom room (Account A becomes Room Owner).
  2. Assign Account A as a Debater (via the admin assignment panel).
  3. Try to select a team (Proposition) and slot (S1) for Account A.
  4. The request will fail with `403 Forbidden`.
* **Expected Behavior:** 
  The position endpoint should evaluate the *effective role* (i.e. check both `roomRole` and `primaryRole`). If `primaryRole === 'debater'`, they should be allowed to select their position.
* **Fix Suggestion:**
  Change the guard check to:
  ```typescript
  const effectiveRole = participant.roomRole === 'owner' ? participant.primaryRole : participant.roomRole;
  if (effectiveRole !== 'debater') { ... }
  ```

---

### BUG-02: Room Owner Blocked from Submitting Scores (Judge Role)
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L1522-L1524) and [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L1704-L1706)
* **Description:**
  Similar to Bug 01, if the Room Owner decides to judge the debate, their role is set to `roomRole: 'owner'` and `primaryRole: 'judge'`. When submitting round scores or overall scores, the REST handlers `/submit-score` and `/submit-round-scores` enforce:
  ```typescript
  if (judge.roomRole !== 'judge') {
    throw new ForbiddenError('Only human judges assigned to this room can submit scores');
  }
  ```
  This immediately blocks the Room Owner from submitting judge evaluations, making it impossible to progress or complete a debate where the owner is the judge.
* **Reproduction Steps:**
  1. Create a custom room (Account A becomes Room Owner).
  2. Assign Account A as a Judge.
  3. Start the debate.
  4. Attempt to submit scores as Account A.
  5. The API returns `403 Forbidden`.
* **Fix Suggestion:**
  Change the guard check to evaluate the effective role:
  ```typescript
  const effectiveRole = judge.roomRole === 'owner' ? judge.primaryRole : judge.roomRole;
  if (effectiveRole !== 'judge') {
    throw new ForbiddenError('Only human judges assigned to this room can submit scores');
  }
  ```

---

### BUG-03: Missing Participant Validation Before Starting Debate
* **Location:** [debate.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.service.ts#L285-L348) and [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L908-L940)
* **Description:**
  The position lock endpoints `/position/lock` and `/lock` unconditionally set the room status to `'ready'` even if there are no participants or if required slots are empty. Subsequently, the `/start` endpoint starts the debate session immediately, checking only the status (`'waiting'` or `'ready'`) and that `motion` is non-empty. 
  This allows starting a debate with zero debaters or judges, leading to application crashes or infinite loops when the state machine tries to assign speaking controls to empty slots.
* **Reproduction Steps:**
  1. Create a custom room.
  2. Without joining any other accounts, click "Lock All" (status becomes `'ready'`).
  3. Click "Start Debate".
  4. The debate starts, but immediately gets stuck on Proposition S1's turn with no player assigned.
* **Expected Behavior:**
  The backend must validate that all required slots for the selected format (1v1 or 3v3) are populated and locked before allowing the room to transition to `'ready'` or starting the debate.
* **Fix Suggestion:**
  Implement a check inside `/start` or `/lock` to ensure all format-specific slots (`PRO_S1`, `OPP_S1`, etc.) have assigned, locked users.

---

## 2. Major Severity Bugs (State Machine & Logic)

### BUG-04: Lack of Role/Slot Conflict Validation in Lobby
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L884-L906)
* **Description:**
  When a player selects their position via `/position`, the backend does not check if the combination of `team` and `speakerSlot` (e.g. `proposition` and `S1`) is already taken by another debater in the room. This allows multiple accounts to occupy the exact same slot.
* **Reproduction Steps:**
  1. Account A joins the room as a debater and selects `Proposition` and `S1`.
  2. Account B joins the room as a debater and selects `Proposition` and `S1`.
  3. Both positions are saved successfully. When the debate starts, the frontend state and backend socket events collide.
* **Expected Behavior:**
  The server should check if the requested slot is already assigned to an active participant and reject duplicates.
* **Fix Suggestion:**
  Add validation to `/position` and `/assign-role` endpoints:
  ```typescript
  const slotTaken = room.participants.some(p => 
    p.userId.toString() !== participant.userId.toString() &&
    p.team === team && 
    p.speakerSlot === speakerSlot
  );
  if (slotTaken) throw new BadRequestError('Speaker slot is already taken');
  ```

---

### BUG-05: Double-Skipping/Skip Race Condition
* **Location:** [debate.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.service.ts#L559-L904)
* **Description:**
  When a user calls `/finish-phase` (clicks "Skip"), the server triggers a transition via `triggerTransition`. This schedules a 3-second `setTimeout` to mute players, show an announcement overlay, and eventually advance the phase. 
  Because there is no "in-progress" lock or guard state, if a client clicks "Skip" multiple times (or two different users click it simultaneously), multiple parallel transition timeouts are registered. When they fire sequentially, they skip multiple phases in a split second, skipping speaking turns entirely.
* **Reproduction Steps:**
  1. During any active speech phase, click "Skip" twice in rapid succession.
  2. The room will skip the current turn, enter transition, and then immediately skip the next turn as well.
* **Expected Behavior:**
  If a transition is already in progress (`session.currentTurn.phaseStatus === 'transition'`), any subsequent start/skip/next requests must be rejected.
* **Fix Suggestion:**
  Introduce a guard check in `triggerTransition`:
  ```typescript
  if (session.currentTurn.status === 'transition') return;
  session.currentTurn.status = 'transition';
  await session.save();
  ```

---

### BUG-06: Infinite Hang on Debate Completion (Owner-Judge Filter Bug)
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L1570-L1580)
* **Description:**
  When a judge submits scores for the final speaker (`OPP_S3`), the system evaluates whether all judges have submitted their scores to autocomplete the debate:
  ```typescript
  const assignedJudges = room.participants.filter((p: any) => p.roomRole === 'judge');
  const allJudgesSubmitted = assignedJudges.every((j: any) => uniqueJudgesSubmitted.has(j.userId.toString()));
  ```
  If the Room Owner is playing as the Judge, their `roomRole` is `'owner'`, so they are completely left out of the `assignedJudges` list. Consequently, the autocomplete check evaluates incorrectly or hangs because the owner-judge is not counted as an assigned judge, preventing the debate status from ever setting to `'completed'`.
* **Fix Suggestion:**
  Update the judge filtering condition to check the effective role:
  ```typescript
  const assignedJudges = room.participants.filter((p: any) => {
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    return role === 'judge';
  });
  ```

---

### BUG-07: AI Judge Feedback Bias (Only One Speaker Judged Per Round)
* **Location:** [debate.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.service.ts#L913-L944)
* **Description:**
  In AI Judge mode, during `judge_feedback` phases, the backend triggers `generateAIFeedback`. It extracts the speaker prefix matching the round number (e.g. `'1'` for `JUDGES_FB_1`) and judges the last speech matching this number:
  ```typescript
  const speakerPrefix = speaker.replace('JUDGES_FB_', '').toUpperCase(); // '1'
  const lastSpeech = history.filter((t: any) => String(t.speaker).toUpperCase().includes(speakerPrefix));
  ```
  Since `lastSpeech` matches *any* speaker with the number `'1'` in their slot name, it matches both `PRO_S1` and `OPP_S1`. Because the array is ordered chronologically, `OPP_S1` is always the last element, meaning `aiService.judgeTurn` is *only* called for `OPP_S1`. The speech transcript of `PRO_S1` is completely ignored for AI feedback.
* **Reproduction Steps:**
  1. Run a debate in No-Host + AI Judge mode.
  2. Complete Round 1.
  3. The AI feedback generated and displayed on screen will only belong to `OPP_S1`. No analysis is registered for `PRO_S1`.
* **Expected Behavior:**
  AI feedback should be generated for both debaters of the round, or targeted correctly per speaker.
* **Fix Suggestion:**
  Modify `generateAIFeedback` to loop through all speakers of that round and call `aiService.judgeTurn` for both, or refactor to target the specific speaker whose turn just completed.

---

### BUG-08: Incorrect Phase Transition Announcement Labels (PRO_S3 / OPP_S3 Mismatch)
* **Location:** [debate.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.service.ts#L496-L557)
* **Description:**
  In the canonical debate flow, Proposition Speaker 3 (`PRO_S3`) speaks BEFORE Opposition Speaker 3 (`OPP_S3`). However, the transition announcement helper method `computeTransitionAnnouncement` assumes `OPP_S3` speaks before `PRO_S3`:
  ```typescript
  // Round 3 transition: OPP before PRO
  if (curr === 'OPP_S3' && next === 'PRO_S3') {
    return 'Proposition turn';
  }
  // Final judging transition: after PRO_S3 (the closing speech)
  if (curr === 'PRO_S3') {
    return 'Finish Debate';
  }
  ```
  Because the actual flow runs `PRO_S3` -> `OPP_S3`, when `PRO_S3` ends, the transition popup displays the misleading text `"Finish Debate"` (even though OPP S3 has not spoken yet). When `OPP_S3` ends, it falls back to the generic `"Phase transition"` popup instead of `"Finish Debate"`.
* **Fix Suggestion:**
  Adjust the transition rules to match the actual flow order:
  ```typescript
  if (curr === 'PRO_S3' && next === 'OPP_S3') {
    return 'Opposition turn';
  }
  if (curr === 'OPP_S3') {
    return 'Finish Debate';
  }
  ```

---

### BUG-09: Infinite Hang in No-Host Human-Judge Mode
* **Location:** [debate.socket.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/socket/debate.socket.ts#L346-L409)
* **Description:**
  In No-Host + Human-Judge mode, there is no host to advance the phases. The transition out of the `judge_feedback` phase requires judges to emit `judge:next-phase` to vote. 
  If a room is started without human judges (or all judges leave), the debate gets stuck permanently in the feedback phase. The socket handler has a fallback else block:
  ```typescript
  } else if (totalJudges === 0) {
    // No judges present - transition immediately after 10s countdown
    votes.clear();
    triggerTransition(roomId, '', { isJudgeFeedback: true }).catch(console.error);
  }
  ```
  However, this fallback is inside the `judge:next-phase` socket listener, which is guarded by `if (role !== 'judge') return;`. Because there are no judges in the room, nobody can emit the event, making the fallback block completely unreachable dead code.
* **Fix Suggestion:**
  The check for empty judges should be executed during the phase entry in `triggerTransition`, automatically scheduling a timeout transition if `totalJudges === 0`.

---

## 3. Minor Severity Bugs (Performance & UX)

### BUG-10: Reconnection Timer State Desync
* **Location:** [timer.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/socket/timer.service.ts#L39-L62) and [room.socket.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/socket/room.socket.ts#L87-L88)
* **Description:**
  The `TimerService` manages turn timers in-memory and broadcasts updates every second. However, it does not persist the updated `timeRemaining` to the database (MongoDB) as it ticks down.
  If the server restarts, or if a user reconnects when the in-memory timer is paused or has lost sync, `buildRoomStatePayload` falls back to `session.currentTurn.timeRemaining`, which holds the stale initial value (e.g. 180s).
* **Fix Suggestion:**
  Periodically save the timer status to the DB (e.g., every 10 seconds or when paused) or handle in-memory recovery more robustly.

---

### BUG-11: Duplicate REST endpoints with Uncoordinated Database Manipulation
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L1970-L2010) vs [debate.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.routes.ts#L54-L63)
* **Description:**
  There are duplicate endpoints for the same logical actions. For example, `rooms/:id/cross-exam/pass-turn` (registered in `room.routes.ts`) directly pushes to `turnHistory` and calls AI judgment on the turn history *without* coordinate socket timer/room states. This bypasses the socket room broadcasts completely, leading to desynchronization on the frontend.
* **Fix Suggestion:**
  Consolidate and remove the duplicate REST endpoints in `room.routes.ts`, routing all live debate interactions through `debate.routes.ts` or centralizing them inside `debate.service.ts`.

---

### BUG-12: Mongoose Concurrent Save Race Condition in `startDebate`
* **Location:** [debate.service.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/debate/debate.service.ts#L343-L346)
* **Description:**
  When `startDebate` is triggered, it calls `unlockAllParticipantsMic(room)` which internally does `await room.save()`. Right after, `startDebate` performs `await Promise.all([session.save(), room.save()])` using the same document reference. 
  This parallel saving of the same document instance creates a Mongoose version key conflict (`__v`), potentially throwing `VersionError` exceptions or failing to save participant state updates.
* **Fix Suggestion:**
  Remove the `await room.save()` inside `unlockAllParticipantsMic` and let the calling function handle saving the room object once at the end of the execution block.

---

### BUG-13: Incorrect Position Unlock Rollback Logic
* **Location:** [room.routes.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/backend/src/features/room/room.routes.ts#L960-L972)
* **Description:**
  When positions are unlocked in the lobby via `/position/unlock`, the code intends to roll the room status back to `'waiting'` from `'ready'` if no participants are locked. However, the condition implemented is:
  ```typescript
  if (unlockedCount === 0 && room.status === 'ready') {
    room.status = 'waiting';
  }
  ```
  If `unlockedCount === 0`, it means no participants were unlocked. Rolling the status back in this scenario is incorrect. Conversely, if `unlockedCount > 0` (positions were actually unlocked), the status is *not* rolled back, leaving the room status as `'ready'` even though positions are now unlocked.
* **Fix Suggestion:**
  Change the condition to check if any lockable participants are currently locked, or rollback when `unlockedCount > 0`.

---

### BUG-14: Leaked Countdown Interval in Frontend Transition-Start (Vulnerability)
* **Location:** [useDebateSocket.ts](file:///f:/Ky8/project%20main/wdp301-rbl-project-wdp_se18d08_group-5/frontend/src/hooks/useDebateSocket.ts#L138-L152)
* **Description:**
  Inside the `debate:transition-start` event listener on the frontend, a new `setInterval` is created on every event invocation to count down the transition overlay timer. 
  The timer ID is not saved, so if multiple transition events arrive or if the component receives duplicate events due to network issues, multiple intervals run concurrently. This causes the UI countdown overlay to flash, jitter, and close early.
* **Fix Suggestion:**
  Maintain a local ref to hold the active interval ID and clear it before scheduling a new countdown:
  ```typescript
  // Clear any existing active transition interval
  if (activeIntervalRef.current) {
    clearInterval(activeIntervalRef.current);
  }
  activeIntervalRef.current = setInterval(...);
  ```

---

## Conclusion & Verification Recommendation

To verify these issues:
1. Try to join a custom room as the owner, assign yourself as a judge, and try to submit scores. You will experience the `403 Forbidden` error (BUG-02).
2. Start a custom debate room and double-click the "Skip" button. Observe the transition overlays overlapping and skipping multiple phases at once (BUG-05).
3. Check the AI feedback text displayed in No-Host AI Judge mode; it will only evaluate opposition speakers in Round 1, showing that proposition speech transcripts are ignored (BUG-07).

---

## Additional Senior QA Pass - 4 Accounts / 4 Roles / Fast Phase Skipping

**Date:** 2026-06-30  
**Verification:** `npm --prefix backend run build` passed, `npm --prefix frontend run build` passed. The following findings are logic, authorization, realtime, and state-machine defects, not TypeScript compile failures.

### BUG-15: Owner Can Start Any Room Even When Required Roles Are Missing
* **Severity:** Critical
* **Location:** `frontend/src/pages/room/LobbyPage.tsx:204-220`, `backend/src/features/debate/debate.service.ts:293-324`
* **Description:**
  The lobby UI sets `canStartDebate` to true immediately for the room owner. The backend mirrors this by authorizing `isOwner` before checking whether the configured flow has enough debaters, host, judges, locked positions, or opposing teams. In a 4-account test, the owner can start while only owner + one debater are present, or while the no-host AI flow is missing one S1.
* **Reproduction Steps:**
  1. Account A creates a 3v3 custom room.
  2. Do not assign all required debaters/judges/host.
  3. Click `Start Debate` as Account A.
  4. The backend creates a session and moves the room to `active`.
* **Expected Behavior:**
  Start must be blocked until the selected format has all required roles and mandatory slots populated and locked.
* **Risk:**
  Room enters an unrecoverable active state with empty speaker turns.

### BUG-16: No-Host AI Start Consensus Can Trigger With Only One S1 Because Slot Uniqueness Is Not Enforced
* **Severity:** Critical
* **Location:** `backend/src/socket/debate.socket.ts:320-339`, `backend/src/features/room/room.routes.ts:884-904`
* **Description:**
  The no-host AI flow starts when `consensusSet.size >= s1Debaters.length`. Since the backend does not validate one S1 per team, a malformed room with only one S1 debater makes `s1Debaters.length === 1`, so a single account can begin a "both S1 debaters" flow.
* **Reproduction Steps:**
  1. Create no-host + AI judge room.
  2. Assign only Account B as debater S1, or assign duplicate S1 on the same team.
  3. Start room; Account B clicks S1 Start.
  4. Debate proceeds without the opposite S1.
* **Expected Behavior:**
  Require exactly one proposition S1 and one opposition S1 for 1v1/3v3 no-host AI before accepting consensus.

### BUG-17: Frontend No-Host S1 Start Mutation Waits For Socket Ack That Backend Never Sends
* **Severity:** Major
* **Location:** `frontend/src/pages/debate/DebateRoomPage.tsx:327-335`, `backend/src/socket/debate.socket.ts:289-343`
* **Description:**
  The frontend emits `debater:s1-start` with an acknowledgement callback and resolves the mutation only when the callback fires. The backend handler accepts only `{ roomId }` and never invokes an ack callback. Result: the mutation remains pending until React Query treats it as unresolved, causing the Start button to stay loading/stale even though the server recorded the vote and broadcasted `debate:s1-start-update`.
* **Reproduction Steps:**
  1. Start a no-host AI room and enter `waiting_s1`.
  2. Account B (S1) clicks Start.
  3. Watch the button state remain pending or fail to settle.
* **Expected Behavior:**
  Either backend must call `ack({ ok: true })`, or frontend should not model this as an ack-based Promise.

### BUG-18: REST Start Phase Uses Host Flow Even In No-Host Rooms
* **Severity:** Critical
* **Location:** `backend/src/features/room/room.routes.ts:2085-2094`, `backend/src/socket/debate.socket.ts:72-81`
* **Description:**
  `/rooms/:id/host/start-phase` calls `getFlow(format)` without passing `room.hostType`. In no-host rooms, this silently selects the human-host flow. The socket `host:start-phase` path correctly passes `room.hostType`, but the frontend calls the REST endpoint through `roomService.startPhase`.
* **Reproduction Steps:**
  1. Create a no-host human-judge room where Judge S1 controls phases.
  2. Use the UI Start button in the debate room.
  3. The REST endpoint computes the next step using host flow, not no-host flow.
* **Expected Behavior:**
  REST and socket phase start paths must use the same flow resolver: `getFlow(format, room.hostType)`.
* **Risk:**
  Current speaker, round index, and expected next phase can desync between backend session, frontend workflow, and socket broadcasts.

### BUG-19: Starting A Phase Is Not Race-Protected During The 3-Second Countdown
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:2081-2105`, `backend/src/socket/debate.socket.ts:43-60`
* **Description:**
  Both REST and socket start-phase paths set `status = active` immediately and schedule a delayed timer with `setTimeout`. There is no countdown token, transition id, or atomic update condition. Double-clicks or simultaneous host/Judge S1 clicks can queue multiple delayed timer starts for the same phase.
* **Reproduction Steps:**
  1. Enter any `waiting_to_start` phase.
  2. Trigger Start rapidly from two clients or REST + socket.
  3. Multiple delayed handlers can start timers and emit duplicate `debate:phase-started`.
* **Expected Behavior:**
  Use an atomic DB update from `waiting_to_start` to `countdown`, then reject any second start while countdown is active.

### BUG-20: Speaker End-Phase Checks Only Team Prefix, Not Exact Speaker Slot
* **Severity:** Critical
* **Location:** `backend/src/features/debate/debate.service.ts:429-438`
* **Description:**
  `endPhaseBySpeaker` derives `expectedPrefix` from `PRO_S1`/`OPP_S2` and only compares it to the participant team (`PRO` or `OPP`). Any debater on the active team can end the current speaker's phase. In 3v3, PRO_S2 can skip PRO_S1's speech and OPP_S3 can skip OPP_S1's speech.
* **Reproduction Steps:**
  1. Run a 3v3 debate with PRO_S1, PRO_S2, PRO_S3.
  2. During PRO_S1 speech, Account C as PRO_S2 calls `/api/v1/debate/:roomId/finish-phase`.
  3. The backend accepts the skip because the team prefix is `PRO`.
* **Expected Behavior:**
  Only the exact active speaker slot (`team + speakerSlot`) or an authorized controller can end a speech.

### BUG-21: Host `next-turn` Can Advance From Idle/Countdown Without Phase-State Guard
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:1267-1274`, `backend/src/features/debate/debate.routes.ts:432-439`, `backend/src/features/debate/debate.service.ts:559-625`
* **Description:**
  Host next-turn endpoints call `triggerTransition` directly. Unlike `endPhaseBySpeaker`, they do not validate `currentTurn.phaseStatus` is active/paused. A host can advance while the phase is idle and before the intended speaker ever starts.
* **Reproduction Steps:**
  1. Finish prep so the room enters a waiting/idle speaker phase.
  2. Host calls `/rooms/:id/host/next-turn` before clicking Start.
  3. Backend snapshots and advances to the next step.
* **Expected Behavior:**
  Reject next-turn unless phase status is active/paused, or explicitly model "skip idle phase" as a separate audited action.

### BUG-22: Round Judge Form Reloads Existing Scores From Wrong Fields
* **Severity:** Major
* **Location:** `frontend/src/pages/debate/DebateRoomPage.tsx:769-786`, `backend/src/features/room/room.routes.ts:1730-1761`
* **Description:**
  Backend stores round score values in `score.logic` and `score.crossExam` via `buildRoundScore`, but the frontend reloads previous values from `score.speak` and `score.ce`. When a judge reopens a submitted round, the form resets to default 14/14 instead of showing saved scores.
* **Reproduction Steps:**
  1. Judge submits round 1 with non-default values, e.g. 18/5.
  2. Refetch or reopen the judge form.
  3. UI shows 14/14 because `score.speak` and `score.ce` do not exist.
* **Expected Behavior:**
  Read from `score.logic` and `score.crossExam`, or store explicit `speak`/`ce` fields consistently.

### BUG-23: Scores Aggregate Endpoint Message Allows Host/Owner But Code Only Allows Raw Judge Role
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:1877-1886`
* **Description:**
  The error message says "Only host, owner, or judge can aggregate scores", but the code checks only `(req as any).participant.roomRole === 'judge'`. Host, owner, and owner-as-judge are rejected.
* **Reproduction Steps:**
  1. Complete a judge feedback round.
  2. Account A as owner/host clicks Aggregate scores.
  3. API returns forbidden despite the message and intended role boundary.
* **Expected Behavior:**
  Use effective role and allow host/owner/judge consistently.

### BUG-24: Owner Assigned As Judge Is Not Added To `room.judges`
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:780-793`
* **Description:**
  When assigning the creator as judge, the code keeps `roomRole = owner` and `primaryRole = judge`, but only pushes into `room.judges` when `participant.roomRole === 'judge'`. Any UI/API relying on `room.judges` undercounts judges and can show `0/judgeCount` even though the owner is acting as judge.
* **Reproduction Steps:**
  1. Owner assigns self as judge.
  2. Inspect room payload or admin room judge count.
  3. `participants` shows owner primary judge, but `judges` omits owner.
* **Expected Behavior:**
  Judge lists/counts should be derived from effective role or include owner-judge in `room.judges`.

### BUG-25: Kick During Lobby Can Remove Required Participant Without Resetting Ready State
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:1145-1174`
* **Description:**
  The lobby kick endpoint removes a participant and clears host/judges, but does not reset `room.status` from `ready` to `waiting` or revalidate locks/required slots. A room can remain `ready` after the host, judge, or S1 debater is kicked.
* **Reproduction Steps:**
  1. Assign and lock all visible roles so room becomes `ready`.
  2. Owner kicks one required debater/judge/host.
  3. Room still reports ready and may be started.
* **Expected Behavior:**
  Any role/participant removal must invalidate ready state and clear stale lock/consensus state.

### BUG-26: Cross-Exam REST Pass/Finish Endpoints Lack Participant/Controller Authorization
* **Severity:** Critical
* **Location:** `backend/src/features/room/room.routes.ts:1970-2025`
* **Description:**
  `/rooms/:id/cross-exam/pass-turn` and `/rooms/:id/cross-exam/finish` require authentication but do not use `roomParticipantGuard` or controller checks. Any logged-in account that knows a room id can mutate cross-exam turn state while the phase is `cross_exam`.
* **Reproduction Steps:**
  1. Account D is not in the debate room.
  2. During cross-exam, Account D posts to `/api/v1/rooms/:id/cross-exam/finish`.
  3. Session phase changes to `judge_feedback`.
* **Expected Behavior:**
  Require room participant and role/team/controller validation, or remove these duplicate endpoints.

### BUG-27: Cross-Exam Finish Route Mutates Phase Without Updating Room Phase Or Broadcasting State
* **Severity:** Major
* **Location:** `backend/src/features/room/room.routes.ts:2012-2025`
* **Description:**
  The room-level CE finish endpoint sets `session.currentTurn.phase = 'judge_feedback'` and saves only the session. It does not update `room.currentPhase`, does not apply the canonical flow step, does not emit `room:state-restore`, and does not notify clients with `debate:phase-change`.
* **Reproduction Steps:**
  1. Use `/rooms/:id/cross-exam/finish` during CE.
  2. Query room and session.
  3. Session says judge feedback while room/current frontend state can still show cross-exam.
* **Expected Behavior:**
  All phase changes must go through `triggerTransition` or a single transition service.

### BUG-28: Replay And Live Participant Filters Ignore Owner Effective Role
* **Severity:** Minor
* **Location:** `frontend/src/pages/replay/ReplayPage.tsx:108-111`, `frontend/src/pages/matches/LiveMatchesPage.tsx:160`
* **Description:**
  Replay filters debaters/judges using raw `roomRole`, and live matches checks rejoin roles against raw `roomRole`. Owner-debater and owner-judge are excluded or displayed in the wrong section even though many other components use effective role.
* **Reproduction Steps:**
  1. Run a debate where owner is a debater or judge.
  2. Open replay or live matches.
  3. Owner is missing from debater/judge lists or cannot rejoin from the live match card as expected.
* **Expected Behavior:**
  Frontend should consistently use `roomRole === 'owner' ? primaryRole : roomRole`.

### BUG-29: Prep Early-End Consensus Uses S1 Debater Count, Not Required Two Teams
* **Severity:** Major
* **Location:** `backend/src/socket/debate.socket.ts:222-280`, `backend/src/socket/debate.socket.ts:421-430`
* **Description:**
  Prep early-end consensus is based on current S1 debaters found in the room. With duplicate slots, one-sided teams, or kicked/disconnected S1s, the threshold can become 1 or stale. The rejoin path also defaults display to 2 if it cannot compute the value, which can disagree with server trigger logic.
* **Reproduction Steps:**
  1. Create no-host or host room with only one effective S1 due to bad assignment/kick.
  2. During prep, that one S1 clicks `End preparation`.
  3. Server can advance prep without the opposite team being ready.
* **Expected Behavior:**
  Consensus should require required team roles by format, not whatever malformed participants currently match `speakerSlot === 'S1'`.

### BUG-30: `finishCe` Uses Room Creator Identity To End CE, Breaking Owner-Not-Host / No-Host Cases
* **Severity:** Major
* **Location:** `backend/src/features/debate/debate.service.ts:1064-1079`
* **Description:**
  After validating the caller, `finishCe` calls `endPhaseByHost(roomId, room.createdBy.toString(), transcript)`. In human-host rooms where the creator is no longer the host, `endPhaseByHost` re-checks host authority for the creator and rejects. In no-host human-judge rooms, creator authority can also differ from Judge S1 authority.
* **Reproduction Steps:**
  1. Owner transfers host to Account B.
  2. During CE, Account B calls the debate CE finish endpoint.
  3. Service delegates to `endPhaseByHost` as the original creator, causing a forbidden/incorrect control path.
* **Expected Behavior:**
  Pass the actual caller `userId` into `endPhaseByHost`, or centralize CE finish authorization in one transition method.

---

## High-Risk 4-Account Regression Matrix

Run these as the next manual/API regression cases:
1. Account A owner, Account B host, Account C proposition S1, Account D judge: lock, start, rapid Start/Skip across motion -> prep -> speech.
2. Account A owner-as-judge, Account B host, Account C proposition S1, Account D opposition S1: submit round scores and aggregate.
3. No-host AI: Account B proposition S1 and Account C opposition S1 both start; verify socket mutation settles and both S1 votes are required.
4. Negative authorization: Account D not in room attempts `/rooms/:id/cross-exam/finish` during CE.
5. Duplicate slot defense: two debaters attempt `proposition/S1`; backend must reject the second assignment.
