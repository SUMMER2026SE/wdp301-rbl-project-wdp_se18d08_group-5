/**
 * transitionAnnouncements.ts — Thay thế 9 if-chain trong debate.service.ts:603-653.
 *
 * Mỗi cặp (currentSpeaker, nextPhase) sinh ra 1 câu thông báo phase transition,
 * phục vụ popup 3 giây giữa 2 phase (rule §11 mọi mode).
 *
 * Quyết định text:
 * - OPP_S3 → judge_feedback:                'End of Round 3'
 * - PRO_S3 → OPP_S3:                         'Opposition turn'
 * - OPP_SN → CE_N:                           'Get ready for cross-examination'
 * - CE_N → JUDGES_FB_N:                      `End of Round ${N}`
 * - JUDGES_FB_N → PRO_S(N+1)/OPP_S(N+1):     'Next round starting'
 * - BOTH_TEAMS_PREP → first speech:          'Get ready to speak'
 * - HOST (motion) → prep:                    'Preparation starts'
 * - Default:                                 'Phase transition'
 *
 * Tham chiếu:
 * - docs/rule_host_judgeAI.md §13-15
 * - docs/rule_host_judgeHuman.md §14
 * - docs/rule_noHost_JudgeAI.md §13
 * - docs/rule_noHost_JudgeHuman.md §15
 * - docs/Debate_Rule_Consolidated.md §5
 */

import { DEBATE_MODE_CONFIGS } from './modeConfigs.js';
import type { DebateModeId, Phase } from './types.js';

/**
 * Speaker key hiểu được trong engine.
 *
 * - PROP_S1..S3: Proposition team, slot 1..3
 * - OPP_S1..S3:  Opposition team, slot 1..3
 * - HOST:        Host đang nói (motion announcement)
 * - JUDGES_FB_1..3: Judge feedback phase sau Round N
 * - BOTH_TEAMS_PREP: cả 2 đội trong Preparation
 */
export type CurrentSpeaker =
  | 'PROP_S1'
  | 'PROP_S2'
  | 'PROP_S3'
  | 'OPP_S1'
  | 'OPP_S2'
  | 'OPP_S3'
  | 'HOST'
  | 'JUDGES_FB_1'
  | 'JUDGES_FB_2'
  | 'JUDGES_FB_3'
  | 'BOTH_TEAMS_PREP';

/**
 * Sinh câu thông báo cho 1 phase transition.
 *
 * @param currentSpeaker speaker/phase hiện tại đang kết thúc
 * @param nextPhase      phase sắp tới
 * @param _modeId        mode hiện tại (giữ cho backward-compat — hiện không dùng
 *                       vì engine không còn phase `final_judging`)
 */
export function getTransitionAnnouncement(
  currentSpeaker: CurrentSpeaker,
  nextPhase: Phase,
  _modeId: DebateModeId,
): string {
  // 1. End of Round 3 — OPP_S3 sang judge_feedback
  if (currentSpeaker === 'OPP_S3' && nextPhase === 'judge_feedback') {
    return 'End of Round 3';
  }

  // 2. PRO_S3 → OPP_S3: đến lượt Opposition
  if (currentSpeaker === 'PROP_S3' && nextPhase === 'speech') {
    return 'Opposition turn';
  }

  // 3. OPP_SN → CE_N (CE chỉ ở Round 1 & 2)
  if (
    (currentSpeaker === 'OPP_S1' || currentSpeaker === 'OPP_S2') &&
    nextPhase === 'cross_exam'
  ) {
    return 'Get ready for cross-examination';
  }

  // 4. CE_N → JUDGES_FB_N: kết thúc Round N
  if (currentSpeaker === 'OPP_S1' && nextPhase === 'judge_feedback') {
    return 'End of Round 1';
  }
  if (currentSpeaker === 'OPP_S2' && nextPhase === 'judge_feedback') {
    return 'End of Round 2';
  }
  // Fallback cho CE_N nói chung
  if (nextPhase === 'judge_feedback') {
    // Suy ra round từ OPP_SN cuối cùng
    if (currentSpeaker === 'OPP_S1') return 'End of Round 1';
    if (currentSpeaker === 'OPP_S2') return 'End of Round 2';
  }

  // 5. JUDGES_FB_N → PRO_S(N+1) / OPP_S(N+1)
  if (currentSpeaker === 'JUDGES_FB_1' && nextPhase === 'speech') {
    return 'Next round starting';
  }
  if (currentSpeaker === 'JUDGES_FB_2' && nextPhase === 'speech') {
    return 'Next round starting';
  }

  // 6. BOTH_TEAMS_PREP → first speech
  if (currentSpeaker === 'BOTH_TEAMS_PREP' && nextPhase === 'speech') {
    return 'Get ready to speak';
  }

  // 7. HOST (motion) → prep_7
  if (currentSpeaker === 'HOST' && nextPhase === 'prep_7') {
    return 'Preparation starts';
  }

  // 8. Default
  return 'Phase transition';
}

/**
 * Helper phụ — suy ra CurrentSpeaker từ round number + team.
 *
 * Engine state machine dùng để gọi hàm chính mà không cần tự build enum.
 *
 * - team='proposition', round=1 → 'PROP_S1'
 * - team='opposition',  round=2 → 'OPP_S2'
 * - team='judges',      round=1 → 'JUDGES_FB_1'
 */
export function speakerForRound(
  team: 'proposition' | 'opposition' | 'judges',
  round: 1 | 2 | 3,
): CurrentSpeaker {
  if (team === 'proposition') {
    if (round === 1) return 'PROP_S1';
    if (round === 2) return 'PROP_S2';
    return 'PROP_S3';
  }
  if (team === 'opposition') {
    if (round === 1) return 'OPP_S1';
    if (round === 2) return 'OPP_S2';
    return 'OPP_S3';
  }
  if (team === 'judges') {
    if (round === 1) return 'JUDGES_FB_1';
    if (round === 2) return 'JUDGES_FB_2';
    return 'JUDGES_FB_3';
  }
  throw new Error(`speakerForRound: team không hợp lệ ${team}`);
}
