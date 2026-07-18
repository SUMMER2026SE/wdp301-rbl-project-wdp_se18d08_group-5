# Debate Engine — Architecture

**Module:** `backend/src/features/debate/engine/`
**Trạng thái:** ✅ Foundation + adapter wiring complete (Task #1–7 done)
**Phiên bản:** Engine v1.0 (XState v5)

---

## 1. Tổng quan kiến trúc

Debate Engine được thiết kế theo **3-layer modular architecture**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Application Layer                             │
│              backend/src/features/debate/debate.service.ts          │
│  (DB writes, socket events, AI integration, scoring — KHÔNG đổi)    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  imports
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Adapter Layer (backward-compat)               │
│                       engine/adapter.ts                              │
│  getFlowAdapter() · checkStartMatchParticipantsAdapter()             │
│  canPerformAdapter() · getModeConfigForRoom()                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  delegates
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Core Engine (3 modules)                            │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────┐        │
│  │   Config   │  │    State     │  │    Permissions       │        │
│  │   Layer    │  │    Layer     │  │                      │        │
│  │            │  │              │  │  permissionMatrix.ts │        │
│  │ duration   │  │ flowGen      │  │  deriveRole()        │        │
│  │ modeCfgs   │  │ matchStates  │  │  canPerform()        │        │
│  │ types      │  │ matchMachine │  │                      │        │
│  │ announce   │  │ mutex        │  │                      │        │
│  └────────────┘  └──────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │  single source of truth
                              ▼
                ┌──────────────────────────────┐
                │   docs/Debate_Rule_*.md       │
                │   (5 rule documents)          │
                └──────────────────────────────┘
```

### Triết lý thiết kế

| Nguyên tắc | Cách áp dụng |
|---|---|
| **Rules tách khỏi engine** | `config/` chứa rule-derived configs, KHÔNG có logic điều phối |
| **Explicit state machine** | `matchStateMachine.ts` dùng XState v5, mọi transition được khai báo tường minh |
| **Permission layer riêng** | `permissionMatrix.ts` map role × mode → action, không hard-code trong handler |
| **Idempotency by design** | `idempotencyGuard.ts` serialize transitions per-room |
| **Single source of truth** | `duration.config.ts` cho mọi time constants — không magic number |
| **Config-driven, không code-driven** | Thêm case mới = thêm 1 entry vào `modeConfigs.ts`, không sửa logic |

---

## 2. File Map

### Config Layer — `engine/config/`

| File | Vai trò | Exports |
|---|---|---|
| `duration.config.ts` | Tất cả hằng số thời gian (Prep 7m, Speech 3m, CE 2m, Transition 3s, Countdown 3s/10s, Host End 5m) | `DEBATE_DURATIONS`, `DurationKey` |
| `types.ts` | TypeScript contracts chung cho toàn engine | `DebateModeConfig`, `PermissionAction`, `Role`, `Phase`, `Team`, `SpeakerSlot`, `ParticipantDescriptor`, `RoomLike` |
| `modeConfigs.ts` | 8 `DebateModeConfig` cho 8 case (host/noHost × AI/Human × 1v1/3v3) | `DEBATE_MODE_CONFIGS`, `getModeConfig(room)`, `getAllModeIds()` |
| `permissionMatrix.ts` | Map (role × modeId) → tập `PermissionAction` cho phép | `canPerform(role, action, modeId)`, `getPermissions(role, modeId)`, `deriveRole(participant)` |
| `transitionAnnouncements.ts` | Text thông báo khi chuyển phase (i18n-aware) | `getTransitionAnnouncement(speaker, phase, modeId)` |

### State Layer — `engine/state/`

| File | Vai trò | Exports |
|---|---|---|
| `flowGenerator.ts` | Generate `FlowStep[]` từ `DebateModeConfig` (thay 4 hard-coded arrays cũ) | `generateFlowFromMode(mode)`, `findStepIndex(steps, speaker, phase)` |
| `matchStates.ts` | TypeScript types cho XState machine | `MatchContext`, `MatchEvent`, `PhaseLifecycleStatus`, `createInitialContext(mode, roomId)` |
| `matchStateMachine.ts` | XState v5 state machine — toàn bộ lifecycle | `matchMachine`, `MatchContext`, `MatchEvent`, `createInitialContext`, `debugTransitionInfo` |
| `idempotencyGuard.ts` | Per-room mutex chống double-transition | `TransitionMutex`, `globalTransitionMutex` |

### Adapter Layer — `engine/adapter.ts`

Backward-compat wrappers giữ signature cũ để `debate.service.ts` không phải sửa nhiều:

| Function | Thay thế cho |
|---|---|
| `getFlowAdapter(format, hostType, judgeType)` | `DEBATE_FLOW_HOST_3V3/1V1/NOHost_*` (4 arrays cũ) |
| `checkStartMatchParticipantsAdapter(room)` | `checkStartMatchParticipants(room)` cũ với magic numbers |
| `canPerformAdapter(participant, action, roomContext)` | Inline permission checks trong handlers |
| `getModeConfigForRoom(room)` | Debug/observability helper |

---

## 3. DebateModeConfig — Cấu trúc 1 mode

```typescript
interface DebateModeConfig {
  id: DebateModeId;             // 'host_ai_3v3' | ...
  hasHost: boolean;             // Có host người hay không
  judgeType: 'AI' | 'HUMAN_SINGLE' | 'HUMAN_MULTI';
  teamSize: '1v1' | '3v3';
  controllerRole: 'HOST' | 'JUDGE_S1' | 'CAPTAIN_CONSENSUS';
  phaseTransition: 'MANUAL' | 'AUTO_TIMED';
  autoTransitionDelaySec: number;  // từ DEBATE_DURATIONS
  rounds: {
    prep: boolean;
    speechCount: 3;
    crossExamRounds: 1 | 2;     // 1 cho 1v1, 2 cho 3v3
  };
  consensusRule?: {
    role: 'BOTH_DEBATERS' | 'BOTH_CAPTAINS';  // chỉ noHost_ai_*
  };
  requiredParticipants: {
    debatersPerTeam: 1 | 3;     // 1 cho 1v1, 3 cho 3v3
    needsHost: boolean;         // = hasHost
    needsJudges: 0 | 1;         // 0 cho AI, 1 cho Human
  };
  aiTieBreak: 'SPLIT_TOTAL';
  judgeS1DisconnectBehavior: 'PAUSE_NO_HANDOFF';
}
```

### 8 mode IDs

```
host_ai_1v1, host_ai_3v3         — Case 1: Host + AI Judge
host_human_1v1, host_human_3v3   — Case 2: Host + Human Judge
noHost_ai_1v1, noHost_ai_3v3     — Case 3,4: No Host + AI
noHost_human_1v1, noHost_human_3v3 — Case 5,6: No Host + Human
```

---

## 4. State Machine — matchMachine

XState v5 state machine mô hình toàn bộ debate lifecycle.

### States chính

```
ROOM_WAITING
   │ START_MATCH (host / judge_s1) hoặc S1_READY ×2 (consensus)
   ▼
COUNTDOWN_3S (auto 3s)
   ▼
PREP_7MIN (BOTH_TEAMS_PREP, 420s)
   │ TIMER_EXPIRED | CONTROLLER_SKIP | CONSENSUS_SKIP
   ▼
TRANSITION (3s mute — auto-advance countdown overlay)
   │
   ├── MANUAL mode → IDLE_BEFORE_NEXT → CONTROLLER_START → ...
   └── AUTO_TIMED mode → AUTO_ADVANCE_WAIT (10s) → ...
                            ▼
              NEXT_ACTIVE_PHASE (route dựa trên flow[currentStepIndex].phase)
                  ├── ROUND_SPEECH
                  ├── CROSS_EXAM
                  └── JUDGE_FEEDBACK
                            ▼
                        COMPLETED (final)
```

### Side states (pause)

`PAUSED_PREP`, `PAUSED_SPEECH`, `PAUSED_CE`, `PAUSED_JUDGE_FEEDBACK`
— được enter khi `PAUSE` event (host có control) hoặc `JUDGE_S1_DISCONNECT` (noHost_human).
Resume qua `RESUME` (host) hoặc `JUDGE_S1_RECONNECT` (noHost_human).

Lưu ý: Phase `final_judging` đã bỏ khỏi state machine (refactor 2026-07).
AI Judge auto-verdict inline trong JUDGE_FEEDBACK_3, Human Judge (host_human_*)
chờ Host End (5 phút countdown) rồi mới COMPLETED.

### Events chính

| Event | Trigger | Effect |
|---|---|---|
| `START_MATCH` | Host / Judge S1 / Captain consensus | ROOM_WAITING → COUNTDOWN_3S |
| `S1_READY` | Captain Prop/Opp | Add to consensus votes |
| `TIMER_EXPIRED` | Internal timer | Phase → TRANSITION |
| `CONTROLLER_START` | Host / Judge S1 | IDLE_BEFORE_NEXT → NEXT_ACTIVE_PHASE |
| `CONTROLLER_SKIP` | Host / Judge S1 | Active phase → TRANSITION |
| `CONTROLLER_END` | Host (host_human_*) | Từ JUDGMENT_FEEDBACK_3 → COMPLETED (sớm) |
| `SPEAKER_SKIP` | Captain/Debater during own speech | Speech → TRANSITION |
| `CONSENSUS_SKIP` | Both Captains (noHost_ai_*) | Phase → TRANSITION |
| `JUDGE_SUBMIT_ALL` | Human Judge | JUDGE_FEEDBACK → TRANSITION |
| `AI_VERDICT_READY` | AI service | JUDGE_FEEDBACK → COMPLETED |
| `PAUSE` / `RESUME` | Host (host_*) or Judge S1 (noHost_human_*) | Toggle paused state |
| `SURRENDER` | Captain | ROOM_WAITING or any active → COMPLETED |
| `REQUEST_DRAW` / `ACCEPT_DRAW` | Captain pair | COMPLETED if both teams accept |

---

## 5. Permission Matrix

`permissionMatrix.ts` implement tất cả permission checks cho 8 mode × n role.

### Roles

```
host               — Chỉ có ở host_*
judge_s1           — Judge điều khiển ở noHost_human_*
judge              — Judge thường (không phải S1) ở HUMAN_MULTI
captain_prop       — Debater team Prop, slot S1
captain_opp        — Debater team Opp, slot S1
debater_prop       — Debater team Prop, slot S2/S3
debater_opp        — Debater team Opp, slot S2/S3
viewer             — Audience
```

### Permission Actions (excerpt)

```
// Điều phối phase / timer
start_phase, skip_phase, skip_consensus_phase,
pause_timer, resume_timer, end_match

// Điều phối participant
mute_participant, enable_chat, grant_viewer_speaking

// Private room
enter_prop_room, enter_opp_room, enter_judge_room

// Match start (controller gate)
start_match

// Captain consensus
surrender, request_draw, accept_draw

// Judge
submit_score, submit_feedback

// Media (always for non-viewer)
toggle_mic, toggle_camera
```

### Pattern gọi permission

```typescript
// Trong handler — thay vì inline check
if (participant.roomRole === 'host') { ... }

// Engine-driven
const allowed = canPerformAdapter(
  { userId, roomRole, primaryRole, team, speakerSlot, hasControlPanel },
  'skip_phase',
  { format, hostType, judgeType, judgeCount },
);
if (!allowed) throw new ForbiddenError(...);
```

---

## 6. Idempotency — TransitionMutex

`globalTransitionMutex.withLock(roomId, async () => ...)` đảm bảo:
- 2 event cùng tick cho cùng room → chạy tuần tự
- Race condition: Host click Skip 2 lần liên tiếp → chỉ transition 1 lần
- 2 user cùng trigger START_MATCH → consensus vote accumulate đúng

Implementation: Promise chain per-roomId. Count waiter để cleanup lock đúng cách.

---

## 7. Flow Generation — flowGenerator

`generateFlowFromMode(mode)` trả `FlowStep[]` cho mỗi mode:

```
[
  { speaker: 'HOST',           phase: 'motion',         dur: 0    },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7',         dur: 420  },
  // Round 1
  { speaker: 'PRO_S1',          phase: 'speech',         dur: 180  },
  { speaker: 'OPP_S1',          phase: 'speech',         dur: 180  },
  { speaker: 'CE_ROUND_1',      phase: 'cross_exam',     dur: 120  },
  { speaker: 'JUDGES_FB_1',     phase: 'judge_feedback', dur: 0    },
  // Round 2
  { speaker: 'PRO_S2', ... }, ...
  // Round 3
  { speaker: 'PRO_S3', ... }, { speaker: 'OPP_S3', ... },
  { speaker: 'JUDGES_FB_3',     phase: 'judge_feedback', dur: 0    },
  { speaker: 'COMPLETED',       phase: 'completed',      dur: 0    },
]
```

Số steps (đã bỏ FINAL_JUDGING):
- 1v1 (1 CE round): 13 steps
- 3v3 (2 CE rounds): 14 steps

Số CE rounds dựa vào `mode.rounds.crossExamRounds` (1 cho 1v1, 2 cho 3v3).

---

## 8. Extending the Engine

### Thêm mode mới

Ví dụ: thêm "Host + AI Judge 1v1" — đã có. Muốn thêm 2v2 (không có trong rule hiện tại):

1. Thêm `'host_ai_2v2'` vào `DebateModeId` type union (types.ts)
2. Thêm `host_ai_2v2: buildModeConfig({...})` vào `DEBATE_MODE_CONFIGS`
3. Update `resolveModeId()` trong adapter.ts để map `format === '2v2'`
4. Update `buildModeConfig` params nếu cần (e.g., `debatersPerTeam: 2`)
5. Engine tự động derive flow + permission + transition cho mode mới

### Thêm permission action

1. Thêm vào `PermissionAction` union (types.ts)
2. Add vào `permissionsForXxx()` function thích hợp (permissionMatrix.ts)
3. Handler gọi `canPerform(role, 'new_action', modeId)` — không sửa handler logic

### Thêm state mới vào state machine

1. Update `MatchContext` / `MatchEvent` types (matchStates.ts)
2. Add state và transitions vào `matchMachine` (matchStateMachine.ts)
3. Update `flowGenerator.ts` nếu state mới dựa trên phase mới

---

## 9. Testing

```
backend/src/features/debate/engine/
├── config/
│   ├── duration.config.test.ts          (8 tests)
│   ├── modeConfigs.test.ts              (25 tests)
│   ├── permissionMatrix.test.ts         (53 tests)
│   └── transitionAnnouncements.test.ts  (22 tests)
├── state/
│   ├── flowGenerator.test.ts            (11 tests)
│   ├── matchStateMachine.test.ts        (29 tests)
│   └── idempotencyGuard.test.ts         (6 tests)
└── adapter.test.ts                      (24 tests)
```

**Tổng: 178 tests pass.**

### Chạy test

```bash
cd backend
npm test                # chạy 1 lần
npm run test:watch      # watch mode
npm run build           # TypeScript check
```

### Test commands cụ thể

```bash
# Chỉ chạy engine tests
npx vitest run src/features/debate/engine/

# Chỉ 1 file
npx vitest run src/features/debate/engine/adapter.test.ts
```

---

## 10. Migration Status

### ✅ Done — engine foundation + adapter wiring

- 4 hard-coded arrays cũ → `getFlowAdapter()`
- Magic number constants → `DEBATE_DURATIONS`
- `checkStartMatchParticipants` → adapter version dùng `requiredParticipants` config
- `startDebate()` → dùng `canPerformAdapter('start_match')`
- `endPhaseByHost()` → dùng `canPerformAdapter('skip_phase')`

### ⏸️ Còn lại (backlog)

- Replace các inline permission checks còn lại trong debate.service.ts (~8 chỗ)
- Wire `matchMachine` vào `triggerTransition()` — hiện tại logic transition vẫn dùng setTimeout cascade thủ công
- Add integration tests (socket end-to-end)
- Add ELO/ranking integration (Matchmaking service layer riêng — task riêng)

---

## 11. Diagrams

### Data flow: User click "Skip" trong DebateRoomPage

```
[Frontend socket]
   │ emit('debate:skip-phase', { roomId, userId, transcript })
   ▼
[socket/index.ts handler]
   │ permission check via canPerformAdapter('skip_phase')
   │ idempotency lock via globalTransitionMutex.withLock(roomId, ...)
   ▼
[triggerTransition()]
   │ mutate DebateSession.currentTurn
   │ emit socket events to room
   ▼
[Frontend store update] — useDebateStore picks up new turn
   │ update timer / phase indicator / speaker card
   ▼
[UI re-render] — React component reflects new state
```

### Data flow: Permission check

```
[Handler] participant = await getParticipant(userId)
              │
              ▼
[canPerformAdapter] participant + action + roomContext
              │
              ├─► resolveModeId(format, hostType, judgeType) → DebateModeId
              ├─► DEBATE_MODE_CONFIGS[modeId] → DebateModeConfig
              ├─► deriveRole(participant) → Role
              └─► canPerform(role, action, modeId) → boolean
                          │
                          ▼
                   permission cache lookup
                          │
                          ▼
                   return true | false
```

---

## 12. References

- **Rule documents:** `docs/rule_host_judgeAI.md`, `docs/rule_host_judgeHuman.md`, `docs/rule_noHost_JudgeAI.md`, `docs/rule_noHost_JudgeHuman.md`, `docs/ruleScore.md`
- **Consolidated:** `docs/Debate_Rule_Consolidated.md`
- **Backend:** `backend/src/features/debate/`
- **Test runner:** Vitest 2.1.x (`backend/package.json`)
- **State machine:** XState v5 (`xstate@^5.18.2`)
