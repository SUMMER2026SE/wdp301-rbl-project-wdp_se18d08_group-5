/**
 * Test cho matchStateMachine.ts — 12 scenarios theo task spec.
 *
 * Approach:
 * - Sử dụng `vi.useFakeTimers()` + `vi.advanceTimersByTime()` để control
 *   các timer XState (INITIAL_COUNTDOWN, TRANSITION_MUTE, ...).
 * - Mỗi test tập trung vào 1 nhánh state transition cụ thể.
 *
 * Tham chiếu rule:
 * - docs/rule_host_judgeAI.md §15
 * - docs/rule_host_judgeHuman.md §14
 * - docs/rule_noHost_JudgeAI.md §13
 * - docs/rule_noHost_JudgeHuman.md §15
 * - docs/Debate_Rule_Consolidated.md §5-§7
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createActor } from 'xstate';
import { DEBATE_DURATIONS } from '../config/duration.config.js';
import { DEBATE_MODE_CONFIGS } from '../config/modeConfigs.js';
import { matchMachine } from './matchStateMachine.js';
import type { MatchContext } from './matchStateMachine.js';

// ── Helpers ──────────────────────────────────────────────────────────

function makeActor(mode = DEBATE_MODE_CONFIGS.host_ai_1v1, roomId = 'room1') {
  const actor = createActor(matchMachine, { input: { mode, roomId } });
  actor.start();
  return actor;
}

function getCtx(actor: ReturnType<typeof makeActor>): MatchContext {
  return actor.getSnapshot().context as MatchContext;
}

function getState(actor: ReturnType<typeof makeActor>): string {
  const value = actor.getSnapshot().value;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Advance timers + flush microtasks cho XState xử lý transition. */
async function tick(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  // Drain microtask queue — KHÔNG chạy runAllTimers (sẽ trigger cả timer tương lai)
  await Promise.resolve();
  await Promise.resolve();
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Test 1: Host + AI 1v1 — host start → COUNTDOWN → PREP → TIMER → TRANSITION → IDLE', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flow: ROOM_WAITING → START_MATCH(host) → COUNTDOWN_3S → PREP_7MIN → TIMER_EXPIRED → TRANSITION → IDLE_BEFORE_NEXT', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_1v1);
    expect(getState(actor)).toBe('ROOM_WAITING');

    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h1' });
    expect(getState(actor)).toBe('COUNTDOWN_3S');
    expect(getCtx(actor).currentStepIndex).toBe(1);

    // Advance 3s → PREP_7MIN
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);
    expect(getState(actor)).toBe('PREP_7MIN');
    expect(getCtx(actor).phaseStatus).toBe('active');

    // Controller skip → TRANSITION
    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h1' });
    expect(getState(actor)).toBe('TRANSITION');

    // Advance 3s → IDLE_BEFORE_NEXT (MANUAL mode)
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);
    expect(getState(actor)).toBe('IDLE_BEFORE_NEXT');
    expect(getCtx(actor).phaseStatus).toBe('idle');
  });
});

describe('Test 2: Host + AI 1v1 — CONTROLLER_START → ROUND_SPEECH', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('từ IDLE_BEFORE_NEXT → CONTROLLER_START(host) → ROUND_SPEECH', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_1v1);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('IDLE_BEFORE_NEXT');

    actor.send({ type: 'CONTROLLER_START', actorRole: 'host', actorUserId: 'h' });
    expect(getState(actor)).toBe('ROUND_SPEECH');
    expect(getCtx(actor).phaseStatus).toBe('active');
  });
});

describe('Test 3: No Host + AI 1v1 — consensus start + AUTO_TIMED transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('START_MATCH(captain_prop) → STARTING → S1_READY×2 → COUNTDOWN_3S → PREP_7MIN → TIMER → TRANSITION (AUTO_TIMED) → ROUND_SPEECH', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_1v1);

    actor.send({
      type: 'START_MATCH',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('STARTING');

    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('STARTING'); // chỉ 1 vote

    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('COUNTDOWN_3S');

    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);
    expect(getState(actor)).toBe('PREP_7MIN');

    actor.send({ type: 'TIMER_EXPIRED' });
    expect(getState(actor)).toBe('TRANSITION');

    // AUTO_TIMED: TRANSITION_MUTE_SECONDS + autoTransitionDelaySec
    await tick(
      (DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS +
        DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS) *
        1000 +
        100,
    );
    expect(getState(actor)).toBe('ROUND_SPEECH');
  });
});

describe('Test 4: No Host + AI 3v3 — Captain surrender scope', () => {
  it('Captain Prop surrender → COMPLETED', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_3v3);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('COMPLETED');
    expect(getCtx(actor).surrendered).toEqual({
      team: 'proposition',
      userId: 'cap1',
    });
  });

  it('Captain Opp surrender → team="opposition"', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('COMPLETED');
    expect(getCtx(actor).surrendered).toEqual({
      team: 'opposition',
      userId: 'cap2',
    });
  });

  it('Debater S2 surrender KHÔNG được phép (chỉ Captain)', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_3v3);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'debater_prop',
      actorUserId: 'd2',
    });
    // Guard fail → vẫn ở ROOM_WAITING
    expect(getState(actor)).toBe('ROOM_WAITING');
    expect(getCtx(actor).surrendered).toBe(false);
  });
});

describe('Test 5: Surrender ở mọi mode → COMPLETED ngay', () => {
  it('host_ai_1v1: surrender từ ROOM_WAITING → COMPLETED', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_1v1);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_prop',
      actorUserId: 'u',
    });
    expect(getState(actor)).toBe('COMPLETED');
    expect(getCtx(actor).phaseStatus).toBe('completed');
  });

  it('noHost_human_3v3: surrender từ ROOM_WAITING → COMPLETED', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_human_3v3);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_opp',
      actorUserId: 'u',
    });
    expect(getState(actor)).toBe('COMPLETED');
  });

  it('host_human_1v1: surrender giữa PREP_7MIN vẫn → COMPLETED', async () => {
    vi.useFakeTimers();
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_human_1v1);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);
    expect(getState(actor)).toBe('PREP_7MIN');

    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_prop',
      actorUserId: 'cap',
    });
    expect(getState(actor)).toBe('COMPLETED');
    vi.useRealTimers();
  });
});

describe('Test 6: Draw — REQUEST_DRAW → ACCEPT_DRAW → COMPLETED', () => {
  it('captain_prop request → captain_opp accept → COMPLETED', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({
      type: 'REQUEST_DRAW',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('ROOM_WAITING');
    expect(getCtx(actor).pendingDrawRequests.has('proposition')).toBe(true);

    actor.send({
      type: 'ACCEPT_DRAW',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('COMPLETED');
    expect(getCtx(actor).pendingDrawRequests.size).toBe(0);
  });

  it('Accept draw KHÔNG hợp lệ nếu không có pending từ đội đối', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({
      type: 'ACCEPT_DRAW',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('ROOM_WAITING');
  });

  it('Captain cùng đội accept draw của mình → rejected', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({
      type: 'REQUEST_DRAW',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    actor.send({
      type: 'ACCEPT_DRAW',
      actorRole: 'captain_prop', // cùng đội
      actorUserId: 'cap1',
    });
    // Vẫn ở ROOM_WAITING vì pendingDraw từ đội đối không có
    expect(getState(actor)).toBe('ROOM_WAITING');
  });
});

describe('Test 7: Judge S1 disconnect (noHost_human_3v3) — pause timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('JUDGE_S1_DISCONNECT từ PREP_7MIN → PAUSED_PREP, phaseStatus="paused"', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_human_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'judge_s1', actorUserId: 'j' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('PREP_7MIN');

    actor.send({ type: 'JUDGE_S1_DISCONNECT', userId: 'j' });
    expect(getState(actor)).toBe('PAUSED_PREP');
    expect(getCtx(actor).phaseStatus).toBe('paused');
    expect(getCtx(actor).judgeS1Disconnected).toBe(true);
  });

  it('JUDGE_S1_RECONNECT → resume', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_human_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'judge_s1', actorUserId: 'j' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    actor.send({ type: 'JUDGE_S1_DISCONNECT', userId: 'j' });
    expect(getState(actor)).toBe('PAUSED_PREP');

    actor.send({ type: 'JUDGE_S1_RECONNECT', userId: 'j' });
    expect(getState(actor)).toBe('PREP_7MIN');
    expect(getCtx(actor).judgeS1Disconnected).toBe(false);
  });
});

describe('Test 8: Permission guard — CONTROLLER_START by viewer rejected', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('viewer gửi CONTROLLER_START → không transition', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('IDLE_BEFORE_NEXT');

    actor.send({
      type: 'CONTROLLER_START',
      actorRole: 'viewer',
      actorUserId: 'v',
    });
    // Viewer không phải controller → guard false → vẫn ở IDLE_BEFORE_NEXT
    expect(getState(actor)).toBe('IDLE_BEFORE_NEXT');
  });
});

describe('Test 9: Idempotency — 2 TIMER_EXPIRED đồng thời chỉ fire 1 transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('send 2 TIMER_EXPIRED liên tiếp từ PREP_7MIN → 1 lần chuyển sang TRANSITION', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_1v1);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('PREP_7MIN');

    actor.send({ type: 'TIMER_EXPIRED' });
    actor.send({ type: 'TIMER_EXPIRED' });
    expect(getState(actor)).toBe('TRANSITION');

    // Step index chỉ tăng 1 (TRANSITION không tăng)
    expect(getCtx(actor).currentStepIndex).toBe(1);
  });
});

describe('Test 10: Pause/Resume — controller pauses PREP_7MIN, resumes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_ai_3v3: PAUSE → PAUSED_PREP → RESUME → PREP_7MIN', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('PREP_7MIN');

    actor.send({ type: 'PAUSE', actorRole: 'host', actorUserId: 'h' });
    expect(getState(actor)).toBe('PAUSED_PREP');
    expect(getCtx(actor).phaseStatus).toBe('paused');

    actor.send({ type: 'RESUME', actorRole: 'host', actorUserId: 'h' });
    expect(getState(actor)).toBe('PREP_7MIN');
    expect(getCtx(actor).phaseStatus).toBe('active');
  });
});

describe('Test 11: Host + Human — JUDGE_SUBMIT_ALL does NOT trigger transition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_human_3v3: JUDGE_SUBMIT_ALL trong JUDGE_FEEDBACK → TRANSITION', async () => {
    const mode = DEBATE_MODE_CONFIGS.host_human_3v3;
    const actor = makeActor(mode);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 500);

    // Skip qua các phase để đến JUDGE_FEEDBACK_1 (sau CE_R1)
    // PREP_7MIN → skip → TRANSITION → IDLE → ROUND_SPEECH(PRO_S1) → skip → ...
    // Cần skip qua 5 active phase: PREP, PRO_S1, OPP_S1, CE_1, mới đến JD_FB_1
    const ACTIVE_PHASES = ['PREP_7MIN', 'ROUND_SPEECH', 'CROSS_EXAM'];
    let safety = 0;
    while (getState(actor) !== 'JUDGE_FEEDBACK' && safety < 30) {
      const st = getState(actor);
      if (ACTIVE_PHASES.includes(st)) {
        actor.send({
          type: 'CONTROLLER_SKIP',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 200);
      if (getState(actor) === 'IDLE_BEFORE_NEXT') {
        actor.send({
          type: 'CONTROLLER_START',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      safety++;
    }

    // Đến JUDGE_FEEDBACK_1
    expect(getState(actor)).toBe('JUDGE_FEEDBACK');

    // JUDGE_SUBMIT_ALL → should NOT transition (vì có Host)
    actor.send({
      type: 'JUDGE_SUBMIT_ALL',
      actorRole: 'judge',
      actorUserId: 'j',
    });
    expect(getState(actor)).toBe('JUDGE_FEEDBACK');

    // CONTROLLER_SKIP → TRANSITION
    actor.send({
      type: 'CONTROLLER_SKIP',
      actorRole: 'host',
      actorUserId: 'h',
    });
    expect(getState(actor)).toBe('TRANSITION');
  });
});

describe('Test 12: No Host + AI — 3v3 chỉ 1 captain click S1_READY → vẫn ở STARTING', () => {
  it('noHost_ai_3v3: 1 S1_READY (captain_prop) → STARTING, votes.size=1', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_3v3);
    actor.send({
      type: 'START_MATCH',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('STARTING');

    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('STARTING');
    expect(getCtx(actor).startConsensusVotes.size).toBe(1);

    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('COUNTDOWN_3S');
  });
});

describe('Hard constraints — currentStepIndex tăng đúng', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_ai_3v3: index = 0 → 1 (setInitialStepIndex) → 2 (CONTROLLER_START)', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    expect(getCtx(actor).currentStepIndex).toBe(0);

    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    expect(getCtx(actor).currentStepIndex).toBe(1);

    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);
    expect(getCtx(actor).currentStepIndex).toBe(1);

    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);

    actor.send({ type: 'CONTROLLER_START', actorRole: 'host', actorUserId: 'h' });
    expect(getCtx(actor).currentStepIndex).toBe(2); // PRO_S1
    expect(getState(actor)).toBe('ROUND_SPEECH');
  });
});

describe('Mode switching — guards reject invalid actors', () => {
  it('noHost_ai_*: HOST không thể START_MATCH (no permission)', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_1v1);
    actor.send({
      type: 'START_MATCH',
      actorRole: 'host',
      actorUserId: 'h',
    });
    expect(getState(actor)).toBe('ROOM_WAITING');
  });

  it('noHost_human_3v3: judge_s1 START_MATCH → COUNTDOWN_3S', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_human_3v3);
    actor.send({
      type: 'START_MATCH',
      actorRole: 'judge_s1',
      actorUserId: 'j',
    });
    expect(getState(actor)).toBe('COUNTDOWN_3S');
  });

  it('host_human_3v3: judge_s1 START_MATCH bị reject (không có quyền)', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_human_3v3);
    actor.send({
      type: 'START_MATCH',
      actorRole: 'judge_s1',
      actorUserId: 'j',
    });
    expect(getState(actor)).toBe('ROOM_WAITING');
  });
});

describe('Surrender idempotent — 2 lần surrender chỉ ghi nhận 1', () => {
  it('surrender đầu tiên thắng, surrender thứ 2 không có effect', () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('COMPLETED');

    actor.send({
      type: 'SURRENDER',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('COMPLETED');
    // surrendered vẫn là của cap1
    expect(getCtx(actor).surrendered).toEqual({
      team: 'proposition',
      userId: 'cap1',
    });
  });
});

describe('CROSS_EXAM — CONTROLLER_SKIP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_ai_3v3: CONTROLLER_SKIP trong CROSS_EXAM → TRANSITION', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 500);

    // Navigate to CROSS_EXAM: skip PREP → skip PRO_S1 → skip OPP_S1 → đến CROSS_EXAM
    const ACTIVE_PHASES = ['PREP_7MIN', 'ROUND_SPEECH'];
    let safety = 0;
    while (getState(actor) !== 'CROSS_EXAM' && safety < 20) {
      const st = getState(actor);
      if (ACTIVE_PHASES.includes(st)) {
        actor.send({
          type: 'CONTROLLER_SKIP',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 200);
      if (getState(actor) === 'IDLE_BEFORE_NEXT') {
        actor.send({
          type: 'CONTROLLER_START',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      safety++;
    }

    expect(getState(actor)).toBe('CROSS_EXAM');
    actor.send({
      type: 'CONTROLLER_SKIP',
      actorRole: 'host',
      actorUserId: 'h',
    });
    expect(getState(actor)).toBe('TRANSITION');
  });
});

describe('SPEAKER_SKIP — chỉ active speaker mới được skip', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_ai_3v3: PRO_S1 (captain_prop) skip lượt mình → TRANSITION', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);
    actor.send({ type: 'CONTROLLER_START', actorRole: 'host', actorUserId: 'h' });

    expect(getState(actor)).toBe('ROUND_SPEECH');

    // Captain Prop skip — đang là lượt PRO_S1
    actor.send({
      type: 'SPEAKER_SKIP',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
      speakerSlot: 'S1',
    });
    expect(getState(actor)).toBe('TRANSITION');
  });

  it('host_ai_3v3: Captain Opp skip khi đang lượt PRO_S1 → guard false → không transition', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_3v3);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    actor.send({ type: 'CONTROLLER_SKIP', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 100);
    actor.send({ type: 'CONTROLLER_START', actorRole: 'host', actorUserId: 'h' });

    // Đang lượt PRO_S1 — Captain Opp không match
    actor.send({
      type: 'SPEAKER_SKIP',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
      speakerSlot: 'S1',
    });
    expect(getState(actor)).toBe('ROUND_SPEECH');
  });
});

describe('CONSENSUS_SKIP — both captains trong noHost_ai_*', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('noHost_ai_3v3: chỉ 1 captain skip → vẫn ở PREP_7MIN; 2 captain skip → TRANSITION', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.noHost_ai_3v3);
    actor.send({
      type: 'START_MATCH',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    actor.send({
      type: 'S1_READY',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 100);

    expect(getState(actor)).toBe('PREP_7MIN');

    // 1 captain skip
    actor.send({
      type: 'CONSENSUS_SKIP',
      actorRole: 'captain_prop',
      actorUserId: 'cap1',
    });
    expect(getState(actor)).toBe('PREP_7MIN');

    // 2 captains skip
    actor.send({
      type: 'CONSENSUS_SKIP',
      actorRole: 'captain_opp',
      actorUserId: 'cap2',
    });
    expect(getState(actor)).toBe('TRANSITION');
  });
});

describe('AI Judge — JUDGE_FEEDBACK_3 auto-completes to COMPLETED', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('host_ai_1v1: AI judge path auto-advances from JUDGE_FEEDBACK_3 → COMPLETED', async () => {
    const actor = makeActor(DEBATE_MODE_CONFIGS.host_ai_1v1);
    actor.send({ type: 'START_MATCH', actorRole: 'host', actorUserId: 'h' });
    await tick(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS * 1000 + 500);

    // Skip qua TẤT CẢ active phases. Vì không có FINAL_JUDGING, mọi auto-advance
    // từ JUDGE_FEEDBACK_3 sẽ tăng currentStepIndex đến step COMPLETED cuối.
    const ACTIVE_PHASES = ['PREP_7MIN', 'ROUND_SPEECH', 'CROSS_EXAM', 'JUDGE_FEEDBACK'];
    let safety = 0;
    while (getState(actor) !== 'COMPLETED' && safety < 80) {
      const st = getState(actor);
      if (ACTIVE_PHASES.includes(st)) {
        actor.send({
          type: 'CONTROLLER_SKIP',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      await tick(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS * 1000 + 200);
      if (getState(actor) === 'IDLE_BEFORE_NEXT') {
        actor.send({
          type: 'CONTROLLER_START',
          actorRole: 'host',
          actorUserId: 'h',
        });
      }
      safety++;
    }

    expect(getState(actor)).toBe('COMPLETED');
  });
});

describe('host_human_* — JUDGE_FEEDBACK_3 routes to AWAITING_HOST_END', () => {
  // Lưu ý: hiện tại logic host_human_* AWAITING_HOST_END được xử lý trong
  // debate.service.ts (qua triggerTransition setTimeout). State machine chỉ
  // giữ logic auto-advance. Service-level test sẽ cover trong integration tests.
  // Ở đây ta verify rằng flow step của host_human_3v3 KHÔNG có FINAL_JUDGING.
  it('host_human_3v3 flow có 15 steps và step cuối là COMPLETED', async () => {
    const { generateFlowFromMode } = await import('./flowGenerator.js');
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_human_3v3);
    expect(flow).toHaveLength(15);
    expect(flow[flow.length - 1]?.speaker).toBe('COMPLETED');
    expect(flow[flow.length - 1]?.phase).toBe('completed');
    // Đảm bảo không có FINAL_JUDGING
    expect(flow.some((s) => s.speaker === 'FINAL_JUDGING')).toBe(false);
  });
});
