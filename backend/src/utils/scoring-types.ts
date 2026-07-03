/**
 * Shared types and constants for the scoring subsystem.
 *
 * `SCORE_LIMITS` represents the legacy 6-criteria aggregate model
 * (logic + rebuttal + evidence + crossExam + strategy + communication).
 * It coexists with the round-based scoring model in scoring.ts.
 */

export const SCORE_LIMITS = {
  logic: 30,
  rebuttal: 20,
  evidence: 15,
  crossExam: 15,
  strategy: 10,
  communication: 10,
} as const;

export type ScoreCriterion = keyof typeof SCORE_LIMITS;

export function clampScore(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}
