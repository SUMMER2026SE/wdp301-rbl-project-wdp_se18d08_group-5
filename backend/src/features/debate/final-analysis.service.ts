import { createHash } from 'node:crypto';
import { ENV } from '../../config/env.js';
import {
  DebateSession,
  type IDebateSession,
  type IAIDebateAnalysis,
  type DebateAnalysisWinner,
} from '../../models/DebateSession.js';
import { DebateRoom } from '../../models/DebateRoom.js';
import { aggregateFinalScores, buildRoundScore } from '../../utils/scoring.js';
import { aiService } from '../ai/ai.service.js';
import {
  buildFinalAnalysisTranscriptBundle,
  type FinalAnalysisTranscriptBundle,
} from './transcript.service.js';

type RoundSide = NonNullable<IAIDebateAnalysis['rounds']>[number]['proposition'];
type AnalysisRound = NonNullable<IAIDebateAnalysis['rounds']>[number];

const runningAnalyses = new Map<string, Promise<IAIDebateAnalysis>>();

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function stringList(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => text(entry))
    .filter(Boolean)
    .slice(0, limit);
}

function numberWithin(value: unknown, min: number, max: number, fallback = min) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function score(value: unknown, max: number) {
  return Math.round(numberWithin(value, 0, max));
}

function confidence(value: unknown) {
  return Number(numberWithin(value, 0, 1, 0).toFixed(2));
}

function winner(value: unknown, fallback: DebateAnalysisWinner = 'draw'): DebateAnalysisWinner {
  return value === 'proposition' || value === 'opposition' || value === 'draw'
    ? value
    : fallback;
}

type FinalScoreShape = Record<string, unknown> & {
  judgeVerdicts?: unknown[];
  winner?: DebateAnalysisWinner | null;
  resultSource?: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finalScoreValue(value: unknown): FinalScoreShape {
  return objectValue(value) as FinalScoreShape;
}

function expectedSide(
  bundle: FinalAnalysisTranscriptBundle,
  round: 1 | 2 | 3,
  team: 'proposition' | 'opposition',
) {
  return bundle.expectedRounds.find((entry) => entry.round === round)?.[team] || {
    speaker: `${team === 'proposition' ? 'PRO' : 'OPP'}_S${round}`,
    userId: '',
    username: `${team} S${round}`,
  };
}

function normalizeRoundSide(
  raw: unknown,
  bundle: FinalAnalysisTranscriptBundle,
  round: 1 | 2 | 3,
  team: 'proposition' | 'opposition',
): RoundSide {
  const source = objectValue(raw);
  const expected = expectedSide(bundle, round, team);
  return {
    speaker: expected.speaker,
    userId: expected.userId,
    username: expected.username,
    speechScore: score(source.speechScore, 20),
    crossExamScore: round === 3 ? 0 : score(source.crossExamScore, 20),
    transcriptConfidence: confidence(source.transcriptConfidence),
    summary: text(source.summary, 'No reliable transcript summary was produced.'),
    strengths: stringList(source.strengths),
    improvements: stringList(source.improvements),
    fallacies: stringList(source.fallacies),
  };
}

export function normalizeFinalDebateAnalysis(input: {
  raw: Record<string, unknown>;
  bundle: FinalAnalysisTranscriptBundle;
  judgeMode: 'ai' | 'human';
  officialWinner: DebateAnalysisWinner | null;
  sourceFingerprint: string;
}): IAIDebateAnalysis {
  const rawRounds = Array.isArray(input.raw.rounds) ? input.raw.rounds : [];
  const rounds = ([1, 2, 3] as const).map((round): AnalysisRound => {
    const rawRound = objectValue(rawRounds.find((entry) => Number(objectValue(entry).round) === round));
    return {
      round,
      proposition: normalizeRoundSide(rawRound.proposition, input.bundle, round, 'proposition'),
      opposition: normalizeRoundSide(rawRound.opposition, input.bundle, round, 'opposition'),
    };
  });

  const derivedTeamScore = (team: 'proposition' | 'opposition') => rounds.reduce(
    (total, round) => total + round[team].speechScore + round[team].crossExamScore,
    0,
  );
  const rawTeams = objectValue(input.raw.teams);
  const normalizeTeam = (team: 'proposition' | 'opposition') => {
    const rawTeam = objectValue(rawTeams[team]);
    return {
      score: derivedTeamScore(team),
      keyArguments: stringList(rawTeam.keyArguments),
      strengths: stringList(rawTeam.strengths),
      weaknesses: stringList(rawTeam.weaknesses),
    };
  };

  const rawParticipants = Array.isArray(input.raw.participants) ? input.raw.participants : [];
  const participants = input.bundle.participants.map((participant) => {
    const rawParticipant = objectValue(rawParticipants.find(
      (entry) => text(objectValue(entry).userId) === participant.userId,
    ));
    return {
      userId: participant.userId,
      username: participant.username,
      team: participant.team,
      transcriptConfidence: confidence(rawParticipant.transcriptConfidence),
      summary: text(rawParticipant.summary, 'No participant summary was produced.'),
      strengths: stringList(rawParticipant.strengths),
      improvements: stringList(rawParticipant.improvements),
    };
  });

  const rawQuality = objectValue(input.raw.transcriptQuality);
  const rawJudgeSynthesis = objectValue(input.raw.judgeSynthesis);
  const recommendedWinner = input.judgeMode === 'human' && input.officialWinner
    ? input.officialWinner
    : winner(input.raw.recommendedWinner);

  return {
    status: 'completed',
    judgeMode: input.judgeMode,
    affectsOfficialResult: input.judgeMode === 'ai',
    model: ENV.GEMINI_AGENT_MODEL,
    sourceFingerprint: input.sourceFingerprint,
    generatedAt: new Date(),
    transcriptStats: input.bundle.stats,
    transcriptQuality: {
      overallConfidence: confidence(rawQuality.overallConfidence),
      issues: stringList(rawQuality.issues),
      notes: text(rawQuality.notes),
    },
    summary: text(input.raw.summary, 'AI debate analysis is unavailable.'),
    keyClashes: stringList(input.raw.keyClashes),
    teams: {
      proposition: normalizeTeam('proposition'),
      opposition: normalizeTeam('opposition'),
    },
    rounds,
    participants,
    judgeSynthesis: {
      summary: text(rawJudgeSynthesis.summary),
      agreements: stringList(rawJudgeSynthesis.agreements),
      disagreements: stringList(rawJudgeSynthesis.disagreements),
    },
    recommendedWinner,
    officialWinner: input.officialWinner,
    winnerReason: text(input.raw.winnerReason),
  };
}

export function buildAIJudgeVerdicts(analysis: IAIDebateAnalysis) {
  const submittedAt = analysis.generatedAt || new Date();
  return (analysis.rounds || []).flatMap((round) => (
    (['proposition', 'opposition'] as const).map((team) => {
      const side = round[team];
      return {
        judgeId: null,
        judgeName: 'AI Judge',
        round: round.round,
        speaker: side.speaker,
        winner: analysis.recommendedWinner || 'draw',
        score: buildRoundScore({
          speak: side.speechScore,
          ce: side.crossExamScore,
        }, round.round),
        notes: side.summary,
        source: 'ai' as const,
        submittedAt,
      };
    })
  ));
}

function analysisFingerprint(bundle: FinalAnalysisTranscriptBundle, judgeVerdicts: unknown[]) {
  return createHash('sha256')
    .update(JSON.stringify({ segments: bundle.segments, judgeVerdicts }))
    .digest('hex');
}

function isProtectedOutcome(value: unknown) {
  const source = finalScoreValue(value).resultSource;
  return source === 'surrender' || source === 'agreed_draw' || source === 'forfeit';
}

async function emitAnalysisReady(roomId: string, analysis: IAIDebateAnalysis) {
  try {
    const { getIO } = await import('../../socket/index.js');
    getIO()?.to(roomId).emit('debate:final-analysis-ready', { roomId, analysis });
  } catch {
    // Analysis is also available from the replay endpoint; sockets are optional here.
  }
}

async function runFinalDebateAnalysis(roomId: string): Promise<IAIDebateAnalysis> {
  const [room, session] = await Promise.all([
    DebateRoom.findById(roomId),
    DebateSession.findOne({ roomId }),
  ]);
  if (!room || !session) throw new Error('Debate room or session not found');

  const judgeMode = room.judgeType === 'ai' ? 'ai' : 'human';
  const currentFinalScores = finalScoreValue(session.finalScores);
  const judgeVerdicts = Array.isArray(currentFinalScores.judgeVerdicts)
    ? currentFinalScores.judgeVerdicts
    : [];
  const bundle = buildFinalAnalysisTranscriptBundle(room, session);
  const sourceFingerprint = analysisFingerprint(bundle, judgeVerdicts);
  const existing = session.aiDebateAnalysis;
  if (existing?.status === 'completed' && existing.sourceFingerprint === sourceFingerprint) {
    return existing;
  }

  session.aiDebateAnalysis = {
    status: 'processing',
    judgeMode,
    affectsOfficialResult: false,
    model: ENV.GEMINI_AGENT_MODEL,
    sourceFingerprint,
  };
  session.markModified('aiDebateAnalysis');
  await session.save();

  const officialWinner = currentFinalScores.winner || null;
  try {
    const raw = await aiService.analyzeFinalDebate({
      roomId,
      motion: room.motion || '',
      format: room.format as '1v1' | '3v3',
      judgeMode,
      officialWinner,
      transcriptBundle: bundle,
      judgeVerdicts,
    });
    if (!raw) throw new Error('Gemini did not return a final analysis');

    const analysis = normalizeFinalDebateAnalysis({
      raw,
      bundle,
      judgeMode,
      officialWinner,
      sourceFingerprint,
    });
    const controlsOfficialResult = judgeMode === 'ai' && !isProtectedOutcome(session.finalScores);

    if (controlsOfficialResult) {
      const preserved = finalScoreValue(session.finalScores);
      session.finalScores = {
        ...preserved,
        judgeVerdicts: buildAIJudgeVerdicts(analysis),
        resultSource: 'judging',
      } as unknown as IDebateSession['finalScores'];
      const aggregate = aggregateFinalScores(session, room);
      aggregate.aiVerdict = aggregate.winner;
      analysis.officialWinner = aggregate.winner;
      analysis.recommendedWinner = aggregate.winner;
      analysis.affectsOfficialResult = true;
      analysis.sourceFingerprint = analysisFingerprint(bundle, aggregate.judgeVerdicts || []);
      session.markModified('finalScores');
    } else {
      analysis.officialWinner = finalScoreValue(session.finalScores).winner || officialWinner;
      analysis.affectsOfficialResult = false;
    }

    session.aiDebateAnalysis = analysis;
    session.aiSummary = analysis.summary || session.aiSummary;
    session.markModified('aiDebateAnalysis');
    await session.save();
    await emitAnalysisReady(roomId, analysis);
    return analysis;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI analysis error';
    const failed: IAIDebateAnalysis = {
      status: 'failed',
      judgeMode,
      affectsOfficialResult: false,
      model: ENV.GEMINI_AGENT_MODEL,
      sourceFingerprint,
      generatedAt: new Date(),
      error: message,
      transcriptStats: bundle.stats,
      officialWinner,
    };
    session.aiDebateAnalysis = failed;
    session.markModified('aiDebateAnalysis');
    await session.save();
    throw error;
  }
}

export function generateFinalDebateAnalysis(roomId: string): Promise<IAIDebateAnalysis> {
  const running = runningAnalyses.get(roomId);
  if (running) return running;
  const analysis = runFinalDebateAnalysis(roomId).finally(() => {
    runningAnalyses.delete(roomId);
  });
  runningAnalyses.set(roomId, analysis);
  return analysis;
}
