/**
 * Shared scoring utilities.
 *
 * Per docs/ruleScore.md:
 *   - 5 scoring items (Speaker 1, CE 1, Speaker 2, CE 2, Speaker 3)
 *   - Each item is worth 20 points → Total = 100 points per team
 *   - Tiebreaker: 1) S3 speech, 2) R2 total, 3) judge vote
 *
 * This module is the single source of truth for the per-round scoring
 * aggregation and tiebreaker logic. It is shared between:
 *   - backend/src/features/room/room.routes.ts  (judge submission endpoints)
 *   - backend/src/features/debate/debate.service.ts  (auto-complete + End Match)
 *
 * The original implementation lived inline in room.routes.ts — this file
 * preserves identical semantics so existing sessions behave consistently.
 */

import { type ScoreCriterion, SCORE_LIMITS, clampScore } from './scoring-types.js';

type DebateWinner = 'proposition' | 'opposition' | 'draw';

type AggregatePolicy = {
  humanJudgeWeight: number;
  aiJudgeWeight: number;
  method: string;
  winnerMethod: string;
  scoredRounds: number[];
  verdictCount: number;
  aggregatedAt: Date;
};

const HUMAN_JUDGE_WEIGHT = 1.0;
const AI_JUDGE_WEIGHT = 0.5;

function getVerdictWeight(verdict: any): number {
  // Match the legacy behavior — AI verdicts carry a 0.5 weight to avoid
  // runaway ties, while human judge verdicts carry full weight.
  if (verdict?.source === 'ai' || verdict?.judgeId === null) return AI_JUDGE_WEIGHT;
  return HUMAN_JUDGE_WEIGHT;
}

function getLatestVerdicts(verdicts: any[]): any[] {
  // Dedupe by judge+speaker so that replayed submissions don't skew sums
  const map = new Map<string, any>();
  verdicts.forEach((v: any) => {
    const judgeId = v.judgeId?.toString?.() || 'unknown';
    const key = `${judgeId}::${v.speaker}`;
    const existing = map.get(key);
    if (
      !existing ||
      new Date(v.submittedAt || 0).getTime() > new Date(existing.submittedAt || 0).getTime()
    ) {
      map.set(key, v);
    }
  });
  return Array.from(map.values());
}

function createEmptyScoreBreakdown() {
  return {
    logic: 0,
    rebuttal: 0,
    evidence: 0,
    crossExam: 0,
    strategy: 0,
    communication: 0,
    overall: 0,
  };
}

function aggregateTeamScores(verdicts: any[], team: 'proposition' | 'opposition') {
  const totals = createEmptyScoreBreakdown();
  totals.overall = 0;
  let totalWeight = 0;

  verdicts.forEach((verdict) => {
    const speakerKey = verdict.speaker || '';
    let target: 'proposition' | 'opposition' | null = null;
    if (team === 'proposition' && String(speakerKey).startsWith('PRO')) target = 'proposition';
    else if (team === 'opposition' && String(speakerKey).startsWith('OPP')) target = 'opposition';
    if (target !== team) return;

    const weight = getVerdictWeight(verdict);
    if (weight === 0) {
      return { total: 0, breakdown: totals, weight: 0 };
    }
    totalWeight += weight;

    (Object.keys(SCORE_LIMITS) as ScoreCriterion[]).forEach((criterion) => {
      const cv = clampScore(verdict.score[criterion], SCORE_LIMITS[criterion]);
      totals[criterion] += cv * weight;
      totals.overall += cv * weight;
    });
  });

  if (totalWeight === 0) {
    return { total: 0, breakdown: totals, weight: 0 };
  }

  const breakdown = createEmptyScoreBreakdown();
  (Object.keys(SCORE_LIMITS) as ScoreCriterion[]).forEach((criterion) => {
    breakdown[criterion] = Number((totals[criterion] / totalWeight).toFixed(2));
  });
  breakdown.overall = Number((totals.overall / totalWeight).toFixed(2));

  return {
    total: breakdown.overall,
    breakdown,
    weight: Number(totalWeight.toFixed(2)),
  };
}

function resolveWinnerFromVerdicts(
  verdicts: any[],
  propositionTotal: number,
  oppositionTotal: number,
): DebateWinner {
  const votes: Record<DebateWinner, number> = {
    proposition: 0,
    opposition: 0,
    draw: 0,
  };

  verdicts.forEach((verdict) => {
    if (!['proposition', 'opposition', 'draw'].includes(verdict?.winner)) return;
    votes[verdict.winner as DebateWinner] += getVerdictWeight(verdict);
  });

  const voteEntries = Object.entries(votes) as Array<[DebateWinner, number]>;
  const [topVote, secondVote] = voteEntries.sort((a, b) => b[1] - a[1]);
  if (topVote && topVote[1] > 0 && (!secondVote || topVote[1] > secondVote[1])) {
    return topVote[0];
  }

  const scoreDelta = propositionTotal - oppositionTotal;
  if (Math.abs(scoreDelta) < 0.5) return 'draw';
  return scoreDelta > 0 ? 'proposition' : 'opposition';
}

function resolveWinnerFromTeamScores(
  propositionTotal: number,
  oppositionTotal: number,
): DebateWinner {
  const scoreDelta = propositionTotal - oppositionTotal;
  if (Math.abs(scoreDelta) < 0.5) return 'draw';
  return scoreDelta > 0 ? 'proposition' : 'opposition';
}

export function aggregateFinalScores(session: any, _room?: any) {
  if (!session.finalScores) {
    session.finalScores = {
      teamProposition: { total: 0, breakdown: {} },
      teamOpposition: { total: 0, breakdown: {} },
      winner: 'draw',
      aiVerdict: 'pending',
      judgeVerdicts: [],
    };
  }

  const finalScores = session.finalScores as {
    teamProposition: any;
    teamOpposition: any;
    winner: DebateWinner;
    winnerTeam?: DebateWinner;
    aiVerdict: string | null;
    judgeVerdicts: any[];
    aggregatePolicy?: any;
  };
  const verdicts = getLatestVerdicts(finalScores.judgeVerdicts || []);
  const isRoundBased = verdicts.some((v: any) => v.round !== undefined);

  if (isRoundBased) {
    const judgeIds = Array.from(
      new Set(verdicts.map((v) => v.judgeId?.toString() || 'unknown')),
    );

    let sumProp = 0;
    let sumOpp = 0;
    let validJudgesCount = 0;

    let sumPropS3 = 0;
    let sumOppS3 = 0;
    let countS3 = 0;

    let sumPropR2 = 0;
    let sumOppR2 = 0;
    let countR2 = 0;

    const judgeVotes = { proposition: 0, opposition: 0, draw: 0 };

    judgeIds.forEach((jId) => {
      const judgeVerdicts = verdicts.filter(
        (v) => (v.judgeId?.toString() || 'unknown') === jId,
      );

      let judgePropTotal = 0;
      let judgeOppTotal = 0;

      judgeVerdicts.forEach((v) => {
        const isProp = String(v.speaker).startsWith('PRO');
        // buildRoundScore stores speak in score.logic and ce in score.crossExam
        const speakVal = Number(v.score?.logic) || 0;
        const ceVal = Number(v.score?.crossExam) || 0;
        const scoreVal = speakVal + ceVal;

        if (isProp) {
          judgePropTotal += scoreVal;
        } else {
          judgeOppTotal += scoreVal;
        }

        const roundNum = Number(v.round);
        if (roundNum === 3) {
          if (isProp) sumPropS3 += scoreVal;
          else sumOppS3 += scoreVal;
          countS3 += 1;
        } else if (roundNum === 2) {
          if (isProp) sumPropR2 += scoreVal;
          else sumOppR2 += scoreVal;
          countR2 += 1;
        }
      });

      sumProp += judgePropTotal;
      sumOpp += judgeOppTotal;
      validJudgesCount += 1;

      if (judgePropTotal > judgeOppTotal) {
        judgeVotes.proposition += 1;
      } else if (judgePropTotal < judgeOppTotal) {
        judgeVotes.opposition += 1;
      } else {
        judgeVotes.draw += 1;
      }
    });

    const propositionTotal = validJudgesCount ? sumProp / validJudgesCount : 0;
    const oppositionTotal = validJudgesCount ? sumOpp / validJudgesCount : 0;

    const scoredRounds = new Set(
      verdicts
        .map((v: any) => Number(v.round))
        .filter((r: number) => r >= 1 && r <= 3),
    );
    const allRoundsScored = scoredRounds.has(1) && scoredRounds.has(2) && scoredRounds.has(3);

    let winnerTeam: DebateWinner | null = null;
    if (allRoundsScored) {
      const delta = propositionTotal - oppositionTotal;
      if (Math.abs(delta) < 0.01) {
        const avgPropS3 = countS3 ? sumPropS3 / countS3 : 0;
        const avgOppS3 = countS3 ? sumOppS3 / countS3 : 0;
        const s3Delta = avgPropS3 - avgOppS3;

        if (Math.abs(s3Delta) > 0.01) {
          winnerTeam = s3Delta > 0 ? 'proposition' : 'opposition';
        } else if (countR2 > 0) {
          const avgPropR2 = sumPropR2 / countR2;
          const avgOppR2 = sumOppR2 / countR2;
          const r2Delta = avgPropR2 - avgOppR2;

          if (Math.abs(r2Delta) > 0.01) {
            winnerTeam = r2Delta > 0 ? 'proposition' : 'opposition';
          } else {
            if (judgeVotes.proposition > judgeVotes.opposition) {
              winnerTeam = 'proposition';
            } else if (judgeVotes.proposition < judgeVotes.opposition) {
              winnerTeam = 'opposition';
            } else {
              winnerTeam = 'draw';
            }
          }
        } else {
          if (judgeVotes.proposition > judgeVotes.opposition) {
            winnerTeam = 'proposition';
          } else if (judgeVotes.proposition < judgeVotes.opposition) {
            winnerTeam = 'opposition';
          } else {
            winnerTeam = 'draw';
          }
        }
      } else {
        winnerTeam = delta > 0 ? 'proposition' : 'opposition';
      }
    }

    finalScores.teamProposition = { total: propositionTotal, breakdown: {} };
    finalScores.teamOpposition = { total: oppositionTotal, breakdown: {} };
    finalScores.winner = winnerTeam as any;
    finalScores.winnerTeam = winnerTeam as any;
    finalScores.aiVerdict = null;
    finalScores.aggregatePolicy = {
      humanJudgeWeight: HUMAN_JUDGE_WEIGHT,
      aiJudgeWeight: AI_JUDGE_WEIGHT,
      method: 'round_based_average_with_tie_breakers',
      winnerMethod: allRoundsScored ? 'tie_breaker_rules_applied' : 'pending_more_rounds',
      scoredRounds: Array.from(scoredRounds),
      verdictCount: verdicts.length,
      aggregatedAt: new Date(),
    } satisfies AggregatePolicy;
  } else {
    // Legacy criteria-based aggregation (kept for sessions predating the
    // round-based scoring model).
    const proposition = aggregateTeamScores(verdicts, 'proposition');
    const opposition = aggregateTeamScores(verdicts, 'opposition');
    resolveWinnerFromVerdicts(
      verdicts,
      proposition.total,
      opposition.total,
    );
    const winnerTeam = resolveWinnerFromTeamScores(proposition.total, opposition.total);

    const aiVotes = verdicts.filter((verdict) => verdict?.source === 'ai' && verdict?.winner);
    const latestAIVote = aiVotes[aiVotes.length - 1]?.winner || null;

    finalScores.teamProposition = {
      total: proposition.total,
      breakdown: proposition.breakdown,
      weight: proposition.weight,
    };
    finalScores.teamOpposition = {
      total: opposition.total,
      breakdown: opposition.breakdown,
      weight: opposition.weight,
    };
    finalScores.winner = winnerTeam;
    finalScores.winnerTeam = winnerTeam;
    finalScores.aiVerdict = latestAIVote;
    finalScores.aggregatePolicy = {
      humanJudgeWeight: HUMAN_JUDGE_WEIGHT,
      aiJudgeWeight: AI_JUDGE_WEIGHT,
      method: 'criteria_based_legacy',
      winnerMethod: 'score_delta_with_judge_vote',
      scoredRounds: [],
      verdictCount: verdicts.length,
      aggregatedAt: new Date(),
    } satisfies AggregatePolicy;
  }

  return finalScores;
}

// Round-based per-team score helpers exposed for both the score-submission
// endpoint (room.routes.ts) and the auto-complete path (debate.service.ts).
// Per docs/ruleScore.md each round is worth 20 points for the speech + 20
// for cross-examination (rounds 1 & 2); round 3 has no CE.
export function clampRoundSpeak(value: unknown): number {
  return clampScore(value, 20);
}

export function clampRoundCe(value: unknown, round?: number): number {
  if (round === 3) return 0;
  return clampScore(value, 20);
}

export function buildRoundScore(input: { speak: number; ce: number }, round?: number) {
  const speakClamped = clampRoundSpeak(input.speak);
  const ceClamped = clampRoundCe(input.ce, round);

  return {
    logic: speakClamped,
    rebuttal: 0,
    evidence: 0,
    crossExam: ceClamped,
    strategy: 0,
    communication: 0,
    overall: speakClamped + ceClamped,
  };
}
