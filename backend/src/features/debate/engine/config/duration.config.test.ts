/**
 * Test cho duration.config.ts — đảm bảo mọi constant đúng giá trị rule.
 * Trong tương lai, đổi rule "Prep 7' → 10'" chỉ cần sửa 1 dòng + update test.
 */
import { describe, it, expect } from 'vitest';
import { DEBATE_DURATIONS } from './duration.config';

describe('DEBATE_DURATIONS', () => {
  it('PREPARATION = 7 phút (420s) theo rule §13-15 mọi mode', () => {
    expect(DEBATE_DURATIONS.PREPARATION_SECONDS).toBe(420);
  });

  it('SPEECH = 3 phút (180s) theo rule §13-15', () => {
    expect(DEBATE_DURATIONS.SPEECH_SECONDS).toBe(180);
  });

  it('CROSS_EXAMINATION = 2 phút (120s) theo rule §13-15', () => {
    expect(DEBATE_DURATIONS.CROSS_EXAMINATION_SECONDS).toBe(120);
  });

  it('TRANSITION_MUTE = 3 giây theo rule §9-11 (mọi mode)', () => {
    expect(DEBATE_DURATIONS.TRANSITION_MUTE_SECONDS).toBe(3);
  });

  it('AUTO_TRANSITION_COUNTDOWN = 10 giây theo rule_noHost_JudgeAI.md §9', () => {
    expect(DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS).toBe(10);
  });

  it('MATCH_END_REDIRECT = 10 giây theo rule §Match End & Result', () => {
    expect(DEBATE_DURATIONS.MATCH_END_REDIRECT_SECONDS).toBe(10);
  });

  it('INITIAL_COUNTDOWN = 3 giây (motion announcement)', () => {
    expect(DEBATE_DURATIONS.INITIAL_COUNTDOWN_SECONDS).toBe(3);
  });

  it('AI_FINAL_VERDICT_DELAY = 10 giây theo rule_noHost_JudgeAI.md §13', () => {
    expect(DEBATE_DURATIONS.AI_FINAL_VERDICT_DELAY_SECONDS).toBe(10);
  });
});