/**
 * Test cho transitionAnnouncements.ts — thay thế 9 if-chain trong debate.service.ts:603-653.
 *
 * Tham chiếu:
 * - docs/Debate_Rule_Consolidated.md §5 (Luồng trận chung)
 * - docs/rule_host_judgeAI.md §13-15
 * - docs/rule_host_judgeHuman.md §14
 * - docs/rule_noHost_JudgeAI.md §13
 * - docs/rule_noHost_JudgeHuman.md §15
 */
import { describe, it, expect } from 'vitest';
import {
  getTransitionAnnouncement,
  speakerForRound,
} from './transitionAnnouncements';
import type { DebateModeId, Phase } from './types';

describe('getTransitionAnnouncement — rule §13-15 mọi mode', () => {
  // per rule_noHost_JudgeAI.md §13 + Consolidated §5 — cuối Round 3
  it('OPP_S3 → judge_feedback: "End of Round 3"', () => {
    expect(
      getTransitionAnnouncement('OPP_S3', 'judge_feedback', 'host_ai_3v3'),
    ).toBe('End of Round 3');
    expect(
      getTransitionAnnouncement('OPP_S3', 'judge_feedback', 'noHost_ai_3v3'),
    ).toBe('End of Round 3');
  });

  it('OPP_S3 → final_judging: "End of Round 3"', () => {
    expect(
      getTransitionAnnouncement('OPP_S3', 'final_judging', 'host_human_3v3'),
    ).toBe('End of Round 3');
  });

  // per rule_host_judgeAI.md §15 — "Tới lượt Opposition" popup
  it('PROP_S3 → speech: "Opposition turn"', () => {
    expect(
      getTransitionAnnouncement('PROP_S3', 'speech', 'host_ai_3v3'),
    ).toBe('Opposition turn');
  });

  it('PROP_S3 → speech (noHost_human): "Opposition turn"', () => {
    expect(
      getTransitionAnnouncement('PROP_S3', 'speech', 'noHost_human_3v3'),
    ).toBe('Opposition turn');
  });

  // per Consolidated §5 — verdict phase
  it('JUDGES_FB_3 → final_judging với AI Judge: "AI Verdict"', () => {
    expect(
      getTransitionAnnouncement('JUDGES_FB_3', 'final_judging', 'host_ai_3v3'),
    ).toBe('AI Verdict');
    expect(
      getTransitionAnnouncement(
        'JUDGES_FB_3',
        'final_judging',
        'noHost_ai_1v1',
      ),
    ).toBe('AI Verdict');
  });

  it('JUDGES_FB_3 → final_judging với Human Judge: "Final Verdict"', () => {
    expect(
      getTransitionAnnouncement(
        'JUDGES_FB_3',
        'final_judging',
        'host_human_3v3',
      ),
    ).toBe('Final Verdict');
    expect(
      getTransitionAnnouncement(
        'JUDGES_FB_3',
        'final_judging',
        'noHost_human_3v3',
      ),
    ).toBe('Final Verdict');
  });

  // per rule_host_judgeHuman.md §14 — "Chuẩn bị CE" popup
  it('OPP_S1 → cross_exam: "Get ready for cross-examination"', () => {
    expect(
      getTransitionAnnouncement('OPP_S1', 'cross_exam', 'host_human_3v3'),
    ).toBe('Get ready for cross-examination');
  });

  it('OPP_S2 → cross_exam: "Get ready for cross-examination"', () => {
    expect(
      getTransitionAnnouncement('OPP_S2', 'cross_exam', 'noHost_human_3v3'),
    ).toBe('Get ready for cross-examination');
  });

  // per rule_host_judgeAI.md §15 — "Hết Round N"
  it('CE_N → judge_feedback (Round 1): "End of Round 1"', () => {
    expect(
      getTransitionAnnouncement('OPP_S1', 'judge_feedback', 'host_ai_3v3'),
    ).toBe('End of Round 1');
  });

  it('CE_N → judge_feedback (Round 2): "End of Round 2"', () => {
    expect(
      getTransitionAnnouncement('OPP_S2', 'judge_feedback', 'host_ai_3v3'),
    ).toBe('End of Round 2');
  });

  // per Consolidated §5 — next round starting
  it('JUDGES_FB_1 → speech: "Next round starting"', () => {
    expect(
      getTransitionAnnouncement('JUDGES_FB_1', 'speech', 'host_ai_3v3'),
    ).toBe('Next round starting');
  });

  it('JUDGES_FB_2 → speech: "Next round starting"', () => {
    expect(
      getTransitionAnnouncement('JUDGES_FB_2', 'speech', 'noHost_ai_3v3'),
    ).toBe('Next round starting');
  });

  // per rule_noHost_JudgeAI.md §13 — prep → first speech
  it('BOTH_TEAMS_PREP → speech: "Get ready to speak"', () => {
    expect(
      getTransitionAnnouncement('BOTH_TEAMS_PREP', 'speech', 'noHost_ai_1v1'),
    ).toBe('Get ready to speak');
    expect(
      getTransitionAnnouncement('BOTH_TEAMS_PREP', 'speech', 'host_ai_3v3'),
    ).toBe('Get ready to speak');
  });

  // per rule_host_judgeAI.md §4 — Host announcement trước prep
  it('HOST → prep_7: "Preparation starts"', () => {
    expect(
      getTransitionAnnouncement('HOST', 'prep_7', 'host_ai_3v3'),
    ).toBe('Preparation starts');
    expect(
      getTransitionAnnouncement('HOST', 'prep_7', 'host_human_3v3'),
    ).toBe('Preparation starts');
  });

  // default fallback
  it('default: "Phase transition"', () => {
    expect(
      getTransitionAnnouncement('PROP_S1', 'transition', 'host_ai_3v3'),
    ).toBe('Phase transition');
    expect(
      getTransitionAnnouncement(
        'BOTH_TEAMS_PREP',
        'completed',
        'noHost_ai_1v1',
      ),
    ).toBe('Phase transition');
  });
});

describe('getTransitionAnnouncement — 1v1 vs 3v3 (cùng flow)', () => {
  // Mỗi case đại diện cho cả 1v1 và 3v3 phải cho ra cùng text
  const allModes: DebateModeId[] = [
    'host_ai_1v1',
    'host_ai_3v3',
    'host_human_1v1',
    'host_human_3v3',
    'noHost_ai_1v1',
    'noHost_ai_3v3',
    'noHost_human_1v1',
    'noHost_human_3v3',
  ];

  it('PROP_S3 → OPP_S3: "Opposition turn" cho tất cả 8 modes', () => {
    for (const mode of allModes) {
      expect(getTransitionAnnouncement('PROP_S3', 'speech', mode)).toBe(
        'Opposition turn',
      );
    }
  });

  it('HOST → prep_7: "Preparation starts" cho tất cả host_* modes', () => {
    const hostModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'host_human_1v1',
      'host_human_3v3',
    ];
    for (const mode of hostModes) {
      expect(getTransitionAnnouncement('HOST', 'prep_7', mode)).toBe(
        'Preparation starts',
      );
    }
  });
});

describe('speakerForRound — helper', () => {
  it('proposition round 1/2/3 → PROP_S1/S2/S3', () => {
    expect(speakerForRound('proposition', 1)).toBe('PROP_S1');
    expect(speakerForRound('proposition', 2)).toBe('PROP_S2');
    expect(speakerForRound('proposition', 3)).toBe('PROP_S3');
  });

  it('opposition round 1/2/3 → OPP_S1/S2/S3', () => {
    expect(speakerForRound('opposition', 1)).toBe('OPP_S1');
    expect(speakerForRound('opposition', 2)).toBe('OPP_S2');
    expect(speakerForRound('opposition', 3)).toBe('OPP_S3');
  });

  it('judges round 1/2/3 → JUDGES_FB_1/2/3', () => {
    expect(speakerForRound('judges', 1)).toBe('JUDGES_FB_1');
    expect(speakerForRound('judges', 2)).toBe('JUDGES_FB_2');
    expect(speakerForRound('judges', 3)).toBe('JUDGES_FB_3');
  });

  it('tích hợp: speakerForRound(prop,1) → "Get ready to speak" sau prep', () => {
    const speaker = speakerForRound('proposition', 1);
    expect(
      getTransitionAnnouncement('BOTH_TEAMS_PREP', 'speech', 'host_ai_1v1'),
    ).toBe('Get ready to speak');
    // sanity: speaker có thể dùng trong các transition khác
    expect(getTransitionAnnouncement(speaker, 'speech', 'host_ai_1v1')).toBe(
      'Phase transition',
    );
  });
});

describe('Mọi phase × speaker combo đều trả string hợp lệ', () => {
  // sanity: không throw, không trả undefined
  const speakers = [
    'PROP_S1',
    'PROP_S2',
    'PROP_S3',
    'OPP_S1',
    'OPP_S2',
    'OPP_S3',
    'HOST',
    'JUDGES_FB_1',
    'JUDGES_FB_2',
    'JUDGES_FB_3',
    'BOTH_TEAMS_PREP',
  ] as const;

  const phases: Phase[] = [
    'motion',
    'prep_7',
    'speech',
    'cross_exam',
    'judge_feedback',
    'final_judging',
    'completed',
    'transition',
  ];

  const modes: DebateModeId[] = [
    'host_ai_1v1',
    'host_ai_3v3',
    'host_human_1v1',
    'host_human_3v3',
    'noHost_ai_1v1',
    'noHost_ai_3v3',
    'noHost_human_1v1',
    'noHost_human_3v3',
  ];

  it('combo explosion không throw, luôn trả string', () => {
    for (const speaker of speakers) {
      for (const phase of phases) {
        for (const mode of modes) {
          const result = getTransitionAnnouncement(speaker, phase, mode);
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
