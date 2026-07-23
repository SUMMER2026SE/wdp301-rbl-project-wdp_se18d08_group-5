import { describe, expect, it } from 'vitest';
import type { FinalAnalysisTranscriptBundle } from './transcript.service.js';
import {
  buildAIJudgeVerdicts,
  normalizeFinalDebateAnalysis,
} from './final-analysis.service.js';

const bundle: FinalAnalysisTranscriptBundle = {
  participants: [
    { userId: 'pro-user', username: 'Pro User', team: 'proposition', speakerSlot: 'S1' },
    { userId: 'opp-user', username: 'Opp User', team: 'opposition', speakerSlot: 'S1' },
  ],
  expectedRounds: ([1, 2, 3] as const).map((round) => ({
    round,
    proposition: { speaker: `PRO_S${round}`, userId: 'pro-user', username: 'Pro User' },
    opposition: { speaker: `OPP_S${round}`, userId: 'opp-user', username: 'Opp User' },
  })),
  segments: [],
  stats: { participantCount: 2, segmentCount: 0, totalCharacters: 0, truncated: false },
};

function rawAnalysis() {
  return {
    summary: 'Summary',
    recommendedWinner: 'opposition',
    transcriptQuality: { overallConfidence: 1.8, issues: [], notes: 'Noisy ASR' },
    teams: { proposition: {}, opposition: {} },
    rounds: ([1, 2, 3] as const).map((round) => ({
      round,
      proposition: {
        speechScore: round === 1 ? 99 : 14,
        crossExamScore: 12,
        transcriptConfidence: 0.8,
        summary: `Pro round ${round}`,
      },
      opposition: {
        speechScore: 13,
        crossExamScore: 11,
        transcriptConfidence: 0.7,
        summary: `Opp round ${round}`,
      },
    })),
    participants: [],
    judgeSynthesis: { summary: 'Judge synthesis', agreements: [], disagreements: [] },
  };
}

describe('final debate analysis normalization', () => {
  it('clamps scores and always removes cross-exam points from round 3', () => {
    const analysis = normalizeFinalDebateAnalysis({
      raw: rawAnalysis(),
      bundle,
      judgeMode: 'ai',
      officialWinner: null,
      sourceFingerprint: 'fingerprint',
    });

    expect(analysis.rounds?.[0].proposition.speechScore).toBe(20);
    expect(analysis.rounds?.[2].proposition.crossExamScore).toBe(0);
    expect(analysis.transcriptQuality?.overallConfidence).toBe(1);
    expect(analysis.teams?.proposition.score).toBe(72);
  });

  it('keeps the official human winner and marks the AI result as advisory', () => {
    const analysis = normalizeFinalDebateAnalysis({
      raw: rawAnalysis(),
      bundle,
      judgeMode: 'human',
      officialWinner: 'proposition',
      sourceFingerprint: 'fingerprint',
    });

    expect(analysis.recommendedWinner).toBe('proposition');
    expect(analysis.officialWinner).toBe('proposition');
    expect(analysis.affectsOfficialResult).toBe(false);
  });

  it('creates exactly one AI verdict per team for all three rounds', () => {
    const analysis = normalizeFinalDebateAnalysis({
      raw: rawAnalysis(),
      bundle,
      judgeMode: 'ai',
      officialWinner: null,
      sourceFingerprint: 'fingerprint',
    });
    const verdicts = buildAIJudgeVerdicts(analysis);

    expect(verdicts).toHaveLength(6);
    expect(verdicts.every((verdict) => verdict.judgeId === null && verdict.source === 'ai')).toBe(true);
    expect(verdicts.find((verdict) => verdict.round === 3)?.score.crossExam).toBe(0);
  });
});
