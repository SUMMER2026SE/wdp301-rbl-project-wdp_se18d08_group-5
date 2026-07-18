/**
 * Duration Config — single source of truth for all time-based constants
 * in the Debate Engine.
 *
 * Theo rule_host_judgeAI.md §15, rule_host_judgeHuman.md §14,
 * rule_noHost_JudgeAI.md §13, rule_noHost_JudgeHuman.md §15:
 * - Prep: 7 phút (420s)
 * - Mỗi speech: 3 phút (180s)
 * - Cross Examination: 2 phút (120s)
 * - Transition mute: 3 giây
 * - Auto-transition countdown (chỉ No-Host + AI): 10 giây
 * - Final redirect: 10 giây
 *
 * Đổi 1 dòng ở đây = thay đổi toàn bộ engine. KHÔNG hard-code
 * magic number trong state machine hay handler.
 */

export const DEBATE_DURATIONS = {
  /** Preparation phase: thời gian chuẩn bị trước round 1 (rule §13-15 lifecycle) */
  PREPARATION_SECONDS: 7 * 60, // 420

  /** Mỗi lượt speech (S1/S2/S3, Prop hoặc Opp) */
  SPEECH_SECONDS: 3 * 60, // 180

  /** Cross Examination giữa 2 đội */
  CROSS_EXAMINATION_SECONDS: 2 * 60, // 120

  /** Thời gian mute + lock chat + popup đếm ngược giữa 2 phase (mọi mode) */
  TRANSITION_MUTE_SECONDS: 3,

  /**
   * No-Host + AI Judge: sau TRANSITION_MUTE, tự đếm thêm bao nhiêu giây rồi
   * tự động chuyển phase. Theo rule_noHost_JudgeAI.md §9: 10 giây.
   * Mode khác (Host, No-Host + Human) = 0 (không auto, chờ controller bấm Start).
   */
  AUTO_TRANSITION_COUNTDOWN_SECONDS: 10,

  /**
   * Sau khi COMPLETED, page tự động redirect sang /result.
   * Theo mọi rule §Match End & Result: 10 giây.
   */
  MATCH_END_REDIRECT_SECONDS: 10,

  /**
   * Host + Human Judge: sau JUDGE_FEEDBACK_3 (Human Judge chấm xong),
   * Host có 5 phút (300s) countdown để bấm End. Hết 5 phút → auto-complete.
   * Không áp dụng cho host_ai_*, noHost_*.
   */
  HOST_END_COUNTDOWN_SECONDS: 5 * 60, // 300s

  /** Initial countdown khi Start (motion announcement): 3 giây */
  INITIAL_COUNTDOWN_SECONDS: 3,
} as const;

export type DurationKey = keyof typeof DEBATE_DURATIONS;