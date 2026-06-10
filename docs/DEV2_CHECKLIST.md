# DEV 2 — Checklist & Status Report

**Date:** June 10, 2026  
**Feature:** Matchmaking + Custom Room + Debate Engine  
**Complexity:** ⭐⭐⭐⭐⭐ (Highest)

---

## 📊 Overall Progress

| Task Category | Total | Done | Remaining | % Complete |
|--------------|-------|------|-----------|-----------|
| **Backend Endpoints** | 22 | 15 | 7 | **68%** |
| **Frontend Components** | 12 | 3 | 9 | **25%** |
| **Business Logic** | 8 | 5 | 3 | **62%** |
| **Testing & Polish** | 3 | 0 | 3 | **0%** |
| **TOTAL** | **45** | **23** | **22** | **51%** |

---

## ✅ COMPLETED TASKS

### Backend Endpoints (15/22 Done ✓)

#### Room Management
- ✅ **[BE-2-01]** DebateRoom schema (with all fields)
- ✅ **[BE-2-02]** DebateSession schema (with phases, CE state)
- ✅ **[BE-2-03]** MatchQueue schema
- ✅ **[BE-2-04]** `POST /api/v1/rooms/create` — Custom room
- ✅ **[BE-2-05]** `GET /api/v1/rooms` — List with filters
- ✅ **[BE-2-06]** `GET /api/v1/rooms/:id` — Room detail
- ✅ **[BE-2-07]** `PUT /api/v1/rooms/:id` — Edit room
- ✅ **[BE-2-08]** `DELETE /api/v1/rooms/:id` — Delete room

#### Join & Lobby
- ✅ **[BE-2-09]** `POST /api/v1/rooms/:id/join` — Join room
- ✅ **[BE-2-10]** `POST /api/v1/rooms/:id/position` — Select position
- ✅ **[BE-2-11]** `POST /api/v1/rooms/:id/lock` — Lock position

#### Host Controls
- ✅ **[BE-2-12]** `POST /api/v1/debate/:id/host/pause` — Pause
- ✅ **[BE-2-13]** `POST /api/v1/debate/:id/host/resume` — Resume
- ✅ **[BE-2-14]** `POST /api/v1/debate/:id/host/issue-card` — Yellow card
- ✅ **[BE-2-15]** `POST /api/v1/debate/:id/host/kick` — Kick participant

#### Matchmaking
- ✅ **[BE-2-16]** `POST /api/v1/matchmaking/queue` — Join queue
- ✅ **[BE-2-17]** `DELETE /api/v1/matchmaking/queue` — Leave queue
- ✅ **[BE-2-18]** `GET /api/v1/matchmaking/status` — Queue status

---

### Frontend Components (3/12 Done ✓)

- ✅ **[FE-2-01]** Create Custom Room form (basic)
- ✅ **[FE-2-02]** Room card component (basic)
- ✅ **[FE-2-03]** Room filter component (basic)

---

### Business Logic (5/8 Done ✓)

- ✅ **[BE-2-19]** Turn order Pro S1→OPP S1→Pro S2→... (basic)
- ✅ **[BE-2-20]** Matchmaking service (`tryCreateRankMatch`)
- ✅ **[BE-2-21]** Room state management (waiting→ready→active)
- ✅ **[BE-2-22]** Judge scoring endpoint (`POST /debate/:id/judge/submit-score`)
- ✅ **[BE-2-23]** Score aggregation + winner calculation

---

## ❌ REMAINING TASKS (22 to do)

### Backend Endpoints (7 Remaining)

#### Debate Engine
- [ ] **[BE-2-24]** `POST /api/v1/rooms/:id/start` — Start debate (UC-22)
  - Validate room ready (all positions filled/locked)
  - Create DebateSession
  - Initialize debate state (phase, turn, timers)
  - Transition to "active" status
  - **Time estimate:** 2-3 hours

- [ ] **[BE-2-25]** `POST /api/v1/debate/:id/next-turn` — Advance turn
  - Update current turn to next speaker
  - Reset timer for new phase
  - Handle CE turn logic
  - **Time estimate:** 2-3 hours

- [ ] **[BE-2-26]** `POST /api/v1/debate/:id/finish-phase` — End phase
  - Validate phase timer reached 0 OR manual skip
  - Transition to next phase
  - Handle prep→speech, speech→CE logic
  - **Time estimate:** 2-3 hours

#### Cross Examination (CE)
- [ ] **[BE-2-27]** CE state machine logic
  - Track which team is asking/answering
  - CE quota per team (typically 2 questions per side)
  - Auto-advance after all questions asked
  - Handle "Pass Turn" / "Finish CE"
  - **Time estimate:** 3-4 hours

- [ ] **[BE-2-28]** `POST /api/v1/debate/:id/ce/pass-turn` — CE turn pass
  - Only asking team can call this
  - Update CE state (asker→answerer→asker...)
  - **Time estimate:** 1-2 hours

- [ ] **[BE-2-29]** `POST /api/v1/debate/:id/ce/finish` — End CE phase
  - Check quota met or time up
  - Transition to next phase
  - **Time estimate:** 1-2 hours

#### Session Completion
- [ ] **[BE-2-30]** `POST /api/v1/debate/:roomId/end` — Complete debate
  - Mark session as "completed"
  - Persist winner/transcript to DebateSession
  - Trigger ELO updates via ranking service
  - Generate replay data
  - **Time estimate:** 2-3 hours

---

### Frontend Components (9 Remaining)

#### Room Management
- [ ] **[FE-2-04]** Rank queue page
  - Join/Leave buttons
  - Queue status + wait time
  - Show matched opponent (when ready)
  - **Time estimate:** 2-3 hours

- [ ] **[FE-2-05]** Lobby page (pre-debate)
  - Show room participants + roles
  - Position selection UI
  - Lock position button
  - Owner controls (Start debate button)
  - **Time estimate:** 3-4 hours

- [ ] **[FE-2-06]** Join room modal
  - Room password input (if private)
  - Validation
  - **Time estimate:** 1-2 hours

#### Live Debate UI
- [ ] **[FE-2-07]** Debate room layout
  - Team display (Pro/Opp)
  - Participants list with avatars
  - Current speaker highlight
  - Phase + turn indicator
  - **Time estimate:** 3-4 hours

- [ ] **[FE-2-08]** Host control panel
  - Pause/Resume buttons
  - Issue card (with reason modal)
  - Kick participant (with confirmation)
  - **Time estimate:** 2-3 hours

- [ ] **[FE-2-09]** Judge scoring form
  - 6 criteria input (logic, rebuttal, evidence, engagement, teamwork, structure)
  - 1-10 scale per criterion
  - Submit button
  - **Time estimate:** 2-3 hours

- [ ] **[FE-2-10]** Result announcement page
  - Winner display
  - Final scores breakdown
  - Team scores comparison
  - Share / Return to home button
  - **Time estimate:** 2-3 hours

#### Additional UI
- [ ] **[FE-2-11]** Cross Examination panel (Dev 3's responsibility, but Dev 2 supports)
  - CE status display
  - "Pass Turn" / "Finish" buttons
  - Question quota display
  - **Time estimate:** 2-3 hours (collaboration with Dev 3)

- [ ] **[FE-2-12]** Score breakdown display
  - Visual representation (bars, tables)
  - Per-team comparison
  - Final verdict
  - **Time estimate:** 2-3 hours

---

### Business Logic (3 Remaining)

- [ ] **[BE-2-31]** Debate engine orchestration (25-step complete flow)
  - Implement full state machine (motion→prep→speech→CE→judge feedback→prep→closing→final judging→completed)
  - Each step validates preconditions
  - Handle edge cases (timer 0, early finish, disconnect)
  - **Time estimate:** 4-5 hours

- [ ] **[BE-2-32]** Replay data generation
  - Capture speech transcripts (from Socket.IO)
  - Persist debate timeline
  - Store decision rationale from judges
  - **Time estimate:** 2-3 hours

- [ ] **[BE-2-33]** Error handling + edge cases
  - Disconnect during speech → forfeit?
  - Not enough judges → fallback to 1 judge?
  - Password-protected room access
  - Timeout handling
  - **Time estimate:** 3-4 hours

---

### Testing & Polish (3 Remaining)

- [ ] **[TEST-2-01]** Backend API tests (Jest/Postman)
  - Test room lifecycle (create→join→start→end)
  - Test matchmaking matching logic
  - Test CE state transitions
  - **Time estimate:** 4-5 hours

- [ ] **[TEST-2-02]** Frontend integration tests (React Testing Library)
  - Test room creation flow
  - Test lobby position locking
  - Test debate transitions
  - **Time estimate:** 4-5 hours

- [ ] **[TEST-2-03]** E2E testing (Cypress/Playwright)
  - Full debate flow from join to end
  - Matchmaking to debate transition
  - Judge scoring → result display
  - **Time estimate:** 4-5 hours

---

## 📅 Priority & Timeline

### CRITICAL (Must do first)
1. **[BE-2-24]** START debate endpoint — 2-3h
2. **[BE-2-25]** NEXT-TURN endpoint — 2-3h
3. **[BE-2-31]** Debate engine orchestration — 4-5h
4. **[FE-2-05]** Lobby page — 3-4h
5. **[FE-2-07]** Debate room layout — 3-4h

**Subtotal: 14-18 hours** (2-3 days if focused)

### HIGH PRIORITY (Do next)
6. **[BE-2-27]** CE state machine — 3-4h
7. **[BE-2-26]** FINISH-PHASE endpoint — 2-3h
8. **[BE-2-28, 29]** CE endpoints — 2-3h
9. **[BE-2-30]** END debate endpoint — 2-3h
10. **[FE-2-08]** Host controls panel — 2-3h
11. **[FE-2-09]** Judge scoring form — 2-3h

**Subtotal: 15-19 hours** (2-3 days if focused)

### MEDIUM PRIORITY (Polish & Edge cases)
12. **[FE-2-10]** Result page — 2-3h
13. **[BE-2-32]** Replay data — 2-3h
14. **[BE-2-33]** Error handling — 3-4h

**Subtotal: 7-10 hours** (1 day)

### TESTING (Final phase)
15. All 3 test suites — 12-15h (2-3 days)

---

## 🔗 Dependencies

### Depends On (Dev 3)
- ❌ **Socket.IO timer events** — needed for real-time phase transitions
- ❌ **Socket.IO CE state sync** — needed for CE to work in real-time
- ❌ **Chat messages** — for debate transcript capture

### Dev 2 Provides To
- ✓ **Room state** → Dev 3 broadcasts via Socket.IO
- ✓ **Debate phase/turn** → Dev 3 syncs timer
- ✓ **Judge scoring endpoints** → Dev 4 may use for AI BGK

---

## 🎯 Key Implementation Notes

### Turn Order (UC-31)
```
Pro S1 (4' speech + 1' cross-exam)
   ↓
Opp S1 (4' speech + 1' cross-exam)
   ↓
Pro S2 (4' speech + 1' cross-exam)
   ↓
Opp S2 (4' speech + 1' cross-exam)
   ↓
Pro S3 (4' speech + 1' cross-exam)
   ↓
Opp S3 (4' speech + 1' cross-exam)
   ↓
Judges: submit scores within 10 minutes
```

### CE State Machine (UC-32)
```
CE Phase:
- Team A asks question (3 minutes combined)
- Team B answers
- Team A can ask follow-up (within quota)
- Repeat until:
  * All questions asked
  * OR 3 minutes elapsed
  * OR Team A clicks "Finish"

Penalty: If Team B doesn't answer within 1 minute per question → deduction
```

### Phase Transitions
```
Motion (1' prep) 
  → Pro S1 speech (4') 
  → Opp S1 speech (4') 
  → Cross Exam phase 1 (3')
  → Pro S2 speech (4')
  → Opp S2 speech (4')
  → Cross Exam phase 2 (3')
  → Pro S3 speech (4')
  → Opp S3 speech (4')
  → Cross Exam phase 3 (3')
  → Judge Feedback (5')
  → Closing (1' prep + 2' speech per side)
  → Final Judging (10' for judges)
  → Completed
```

---

## 💡 Recommended Implementation Order

### Week 1 (Sprint 1)
1. `POST /rooms/:id/start` — Initialize debate
2. Debate turn/phase logic
3. Debate room component (with turn indicator)
4. Lobby page (position locking)

### Week 2 (Sprint 2)
5. Host control panel (pause/resume/card/kick)
6. CE state machine + endpoints
7. Judge scoring form + submission
8. Debate phase transitions

### Week 3 (Sprint 3)
9. Result announcement page
10. Score breakdown display
11. `GET /replay` endpoint
12. Replay page (Dev 5 supports)

### Week 4-5 (Polish & Testing)
13. Edge case handling
14. Error handling
15. Unit + Integration tests
16. E2E tests

---

## 📝 Related Documentation

| Doc | Reference |
|-----|-----------|
| Debate Rules | [01_Debate_Rule.md](./01_Debate_Rule.md) — Turn order, timing, CE rules |
| Room/Matchmaking | [02_Matchmaking_Room_System.md](./02_Matchmaking_Room_System.md) — Room workflow |
| Use Cases | [05_Use_Cases.md](./05_Use_Cases.md) — UC-12 to UC-66 |
| Role System | [03_Role_System.md](./03_Role_System.md) — Permissions |

---

## 🚀 Quick Start Checklist

```bash
# Backend setup
cd backend
npm install
npm run build  # Should pass

# Create first endpoints
# 1. POST /rooms/:id/start
# 2. POST /debate/:id/next-turn
# 3. POST /debate/:id/finish-phase

# Frontend setup
cd frontend
npm run build  # Should pass

# Create first components
# 1. Lobby page
# 2. Debate room (basic layout)
# 3. Host controls panel
```

---

## 📞 Blockers / Questions to Clarify

- [ ] How to handle judge AI selection? (Fallback if no human judge?)
- [ ] What happens if participant disconnects mid-speech? (Auto-forfeit?)
- [ ] Should speech times be strict or allow +5 sec grace period?
- [ ] How to persist speech transcript? (From Socket.IO messages or from user?)
- [ ] Replay format — video, transcript, score only, or all?

---

## 📊 Stats

**Total Tasks:** 45  
**Estimated Time:** 60-80 hours (if working full-time)  
**Critical Path:** 14-18 hours (2-3 days minimum viable)  
**Recommended Sprint:** 3 weeks with team support

---

**Last Updated:** June 10, 2026  
**Status:** Ready to Execute ✓
