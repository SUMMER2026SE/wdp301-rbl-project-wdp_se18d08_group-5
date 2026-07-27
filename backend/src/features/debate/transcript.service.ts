import mongoose from 'mongoose';
import { DebateRoom, IDebateRoom } from '../../models/DebateRoom.js';
import {
  DebateSession,
  IDebateSession,
  ISpeechTranscript,
  TranscriptRole,
  TranscriptSource,
  TranscriptTeam,
} from '../../models/DebateSession.js';

const MAX_TRANSCRIPT_LENGTH = 50_000;
export const MAX_FINAL_ANALYSIS_CHARACTERS = 650_000;

type TranscriptParticipant = {
  userId: mongoose.Types.ObjectId;
  username: string;
  role: TranscriptRole;
  team?: TranscriptTeam;
  speakerSlot?: 'S1' | 'S2' | 'S3';
};

type CurrentTurnLike = {
  speaker?: string;
  phase?: string;
  startTime?: Date | string;
};

type TranscriptSessionLike = Pick<IDebateSession, 'speechTranscripts'> & {
  currentTurn?: CurrentTurnLike;
};

export type StructuredTranscript = {
  round: number;
  team?: TranscriptTeam;
  userId: string;
  username: string;
  speaker: string;
  transcript: string;
};

export type FinalAnalysisTranscriptSegment = {
  segmentKey: string;
  round: 0 | 1 | 2 | 3;
  phase: string;
  speaker: string;
  userId: string;
  username: string;
  team?: TranscriptTeam;
  speakerSlot?: 'S1' | 'S2' | 'S3';
  language: string;
  text: string;
  source: TranscriptSource | 'turn-history';
};

export type FinalAnalysisTranscriptBundle = {
  participants: Array<{
    userId: string;
    username: string;
    team: TranscriptTeam;
    speakerSlot?: 'S1' | 'S2' | 'S3';
  }>;
  expectedRounds: Array<{
    round: 1 | 2 | 3;
    proposition: { speaker: string; userId: string; username: string };
    opposition: { speaker: string; userId: string; username: string };
  }>;
  segments: FinalAnalysisTranscriptSegment[];
  stats: {
    participantCount: number;
    segmentCount: number;
    totalCharacters: number;
    truncated: boolean;
  };
};

export function mergeTranscriptText(existing: string | undefined, incoming: string): string {
  const current = existing?.trim() || '';
  const next = incoming.trim();
  if (!current) return next.slice(0, MAX_TRANSCRIPT_LENGTH);
  if (!next) return current;
  if (next.startsWith(current)) return next.slice(0, MAX_TRANSCRIPT_LENGTH);
  if (current.includes(next)) return current;

  const maxOverlap = Math.min(current.length, next.length);
  for (let overlap = maxOverlap; overlap >= 3; overlap -= 1) {
    if (current.endsWith(next.slice(0, overlap))) {
      return `${current}${next.slice(overlap)}`.slice(0, MAX_TRANSCRIPT_LENGTH);
    }
  }

  return `${current} ${next}`.slice(0, MAX_TRANSCRIPT_LENGTH);
}

export function detectTranscriptRound(turn?: CurrentTurnLike): 0 | 1 | 2 | 3 {
  const value = `${turn?.speaker || ''} ${turn?.phase || ''}`;
  const match = value.match(/(?:S|ROUND_|FB_|CROSS_EXAM_)([123])\b/i);
  if (!match) return 0;
  return Number(match[1]) as 1 | 2 | 3;
}

export function resolveTranscriptParticipant(
  room: Pick<IDebateRoom, 'participants'>,
  userId: string,
): TranscriptParticipant | null {
  const participant = room.participants.find((entry) => entry.userId.toString() === userId);
  if (!participant) return null;

  const effectiveRole = participant.roomRole === 'owner'
    ? participant.primaryRole || 'owner'
    : participant.roomRole;
  const role = effectiveRole as TranscriptRole;
  const team = participant.team === 'proposition' || participant.team === 'opposition'
    ? participant.team
    : undefined;
  const speakerSlot = participant.speakerSlot === 'S1' || participant.speakerSlot === 'S2' || participant.speakerSlot === 'S3'
    ? participant.speakerSlot
    : undefined;

  return {
    userId: participant.userId,
    username: participant.username,
    role,
    team,
    speakerSlot,
  };
}

function createSegmentKey(roomId: string, userId: string, turn: CurrentTurnLike, round: number) {
  return [roomId, userId, turn.speaker || 'UNKNOWN', turn.phase || 'unknown', round].join(':');
}

function isActiveSpeaker(
  room: Pick<IDebateRoom, 'format'>,
  participant: TranscriptParticipant,
  turn: CurrentTurnLike,
) {
  if (turn.phase !== 'speech' || participant.role !== 'debater') return false;

  const speaker = turn.speaker || '';
  const expectedTeam = speaker.startsWith('PRO_')
    ? 'proposition'
    : speaker.startsWith('OPP_')
      ? 'opposition'
      : undefined;
  if (!expectedTeam || participant.team !== expectedTeam) return false;
  if (room.format === '1v1') return true;

  const expectedSlot = speaker.match(/_(S[123])$/)?.[1];
  return Boolean(expectedSlot && participant.speakerSlot === expectedSlot);
}

function transcriptValues(transcript: ISpeechTranscript) {
  return {
    round: transcript.round,
    team: transcript.team,
    userId: transcript.userId.toString(),
    username: transcript.username,
    speaker: transcript.speaker,
    transcript: transcript.originalText,
  };
}

export function getTranscriptForTurn(
  session: TranscriptSessionLike,
  speaker: string,
  phase?: string,
  options?: { activeSpeakerOnly?: boolean },
): string {
  const matching = (session.speechTranscripts || [])
    .filter((entry) =>
      entry.speaker === speaker
      && (!phase || entry.phase === phase)
      && (!options?.activeSpeakerOnly || entry.isActiveSpeaker),
    )
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());

  return matching.reduce(
    (combined, entry) => mergeTranscriptText(combined, entry.originalText),
    '',
  );
}

export function buildStructuredRoundTranscripts(
  session: TranscriptSessionLike,
  round: number,
): StructuredTranscript[] {
  const grouped = new Map<string, StructuredTranscript>();

  for (const entry of session.speechTranscripts || []) {
    if (entry.round !== round || entry.phase !== 'speech' || !entry.isActiveSpeaker) continue;
    const key = `${entry.userId.toString()}:${entry.speaker}`;
    const current = grouped.get(key);
    const values = transcriptValues(entry);
    grouped.set(key, {
      ...values,
      transcript: mergeTranscriptText(current?.transcript, values.transcript),
    });
  }

  return Array.from(grouped.values());
}

function effectiveParticipantRole(participant: IDebateRoom['participants'][number]) {
  return participant.roomRole === 'owner'
    ? participant.primaryRole || 'owner'
    : participant.roomRole;
}

function expectedRoundParticipant(
  room: Pick<IDebateRoom, 'format' | 'participants'>,
  team: TranscriptTeam,
  round: 1 | 2 | 3,
) {
  const debaters = room.participants.filter((participant) =>
    effectiveParticipantRole(participant) === 'debater' && participant.team === team,
  );
  if (room.format === '1v1') return debaters[0];
  return debaters.find((participant) => participant.speakerSlot === `S${round}`) || debaters[round - 1];
}

function appendWithinLimit(
  segments: FinalAnalysisTranscriptSegment[],
  segment: FinalAnalysisTranscriptSegment,
  state: { used: number; total: number; truncated: boolean },
  maxCharacters: number,
) {
  const text = segment.text.trim();
  if (!text) return;
  state.total += text.length;
  const remaining = Math.max(0, maxCharacters - state.used);
  if (remaining === 0) {
    state.truncated = true;
    return;
  }
  const accepted = text.slice(0, remaining);
  if (accepted.length < text.length) state.truncated = true;
  segments.push({ ...segment, text: accepted });
  state.used += accepted.length;
}

export function buildFinalAnalysisTranscriptBundle(
  room: Pick<IDebateRoom, 'format' | 'participants'>,
  session: Pick<IDebateSession, 'speechTranscripts' | 'turnHistory'>,
  maxCharacters = MAX_FINAL_ANALYSIS_CHARACTERS,
): FinalAnalysisTranscriptBundle {
  const participants = room.participants
    .filter((participant) =>
      effectiveParticipantRole(participant) === 'debater'
      && (participant.team === 'proposition' || participant.team === 'opposition'),
    )
    .map((participant) => ({
      userId: participant.userId.toString(),
      username: participant.username,
      team: participant.team as TranscriptTeam,
      speakerSlot: participant.speakerSlot === 'S1' || participant.speakerSlot === 'S2' || participant.speakerSlot === 'S3'
        ? participant.speakerSlot as 'S1' | 'S2' | 'S3'
        : undefined,
    }));

  const expectedRounds = ([1, 2, 3] as const).map((round) => {
    const proposition = expectedRoundParticipant(room, 'proposition', round);
    const opposition = expectedRoundParticipant(room, 'opposition', round);
    return {
      round,
      proposition: {
        speaker: `PRO_S${round}`,
        userId: proposition?.userId.toString() || '',
        username: proposition?.username || `Proposition S${round}`,
      },
      opposition: {
        speaker: `OPP_S${round}`,
        userId: opposition?.userId.toString() || '',
        username: opposition?.username || `Opposition S${round}`,
      },
    };
  });

  const segments: FinalAnalysisTranscriptSegment[] = [];
  const state = { used: 0, total: 0, truncated: false };
  const sortedTranscripts = [...(session.speechTranscripts || [])].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );

  for (const entry of sortedTranscripts) {
    if (entry.role !== 'debater') continue;
    if (entry.phase === 'speech' && !entry.isActiveSpeaker) continue;
    if (entry.phase !== 'speech' && entry.phase !== 'cross_exam') continue;
    appendWithinLimit(segments, {
      segmentKey: entry.segmentKey,
      round: entry.round,
      phase: entry.phase,
      speaker: entry.speaker,
      userId: entry.userId.toString(),
      username: entry.username,
      team: entry.team,
      speakerSlot: entry.speakerSlot,
      language: entry.language,
      text: entry.originalText,
      source: entry.source,
    }, state, maxCharacters);
  }

  for (const [index, turn] of (session.turnHistory || []).entries()) {
    const text = turn.transcript?.trim();
    if (!text) continue;
    const phase = turn.crossExamination ? 'cross_exam' : 'speech';
    const alreadyCaptured = segments.some((segment) =>
      segment.speaker === turn.speaker && segment.phase === phase,
    );
    if (alreadyCaptured) continue;
    const round = detectTranscriptRound({ speaker: turn.speaker, phase });
    const expected = expectedRounds.find((item) => item.round === round);
    const side = turn.speaker.startsWith('PRO_') ? expected?.proposition : expected?.opposition;
    appendWithinLimit(segments, {
      segmentKey: `turn-history:${index}:${turn.speaker}`,
      round,
      phase,
      speaker: turn.speaker,
      userId: side?.userId || '',
      username: side?.username || turn.speaker,
      team: turn.speaker.startsWith('PRO_') ? 'proposition' : turn.speaker.startsWith('OPP_') ? 'opposition' : undefined,
      language: 'und',
      text,
      source: 'turn-history',
    }, state, maxCharacters);
  }

  return {
    participants,
    expectedRounds,
    segments,
    stats: {
      participantCount: participants.length,
      segmentCount: segments.length,
      totalCharacters: state.total,
      truncated: state.truncated,
    },
  };
}

export function shouldUseTranscriptForAI(judgeType: string): boolean {
  return judgeType === 'ai';
}

async function updateExistingSegment(
  sessionId: mongoose.Types.ObjectId,
  segmentKey: string,
  existingText: string,
  incomingText: string,
  language: string,
  existingIsToxic: boolean,
  incomingIsToxic: boolean,
  moderationReason?: string,
) {
  const mergedText = mergeTranscriptText(existingText, incomingText);
  const isToxic = existingIsToxic || incomingIsToxic;
  const fields: Record<string, unknown> = {
    'speechTranscripts.$.originalText': mergedText,
    'speechTranscripts.$.language': language || 'und',
    'speechTranscripts.$.isToxic': isToxic,
    'speechTranscripts.$.updatedAt': new Date(),
  };
  if (moderationReason) {
    fields['speechTranscripts.$.moderationReason'] = moderationReason.slice(0, 500);
  }

  await DebateSession.updateOne(
    { _id: sessionId, 'speechTranscripts.segmentKey': segmentKey },
    { $set: fields },
  );
  return mergedText;
}

export async function persistSourceCaption(input: {
  roomId: string;
  userId: string;
  text: string;
  language?: string;
  source: TranscriptSource;
  isToxic?: boolean;
  moderationReason?: string;
}): Promise<ISpeechTranscript | null> {
  const originalText = input.text.trim();
  if (!originalText) return null;

  const [room, session] = await Promise.all([
    DebateRoom.findById(input.roomId).select(
      'participants judgeType hostType format',
    ),
    DebateSession.findOne({ roomId: input.roomId }).select(
      'currentTurn speechTranscripts',
    ),
  ]);
  if (!room || !session?.currentTurn) return null;

  const participant = resolveTranscriptParticipant(room, input.userId);
  if (!participant) return null;

  const turn = session.currentTurn as CurrentTurnLike;
  const round = detectTranscriptRound(turn);
  const segmentKey = createSegmentKey(input.roomId, input.userId, turn, round);
  const existing = session.speechTranscripts?.find((entry) => entry.segmentKey === segmentKey);

  if (existing) {
    const mergedText = await updateExistingSegment(
      session._id as mongoose.Types.ObjectId,
      segmentKey,
      existing.originalText,
      originalText,
      input.language || 'und',
      Boolean(existing.isToxic),
      Boolean(input.isToxic),
      input.moderationReason,
    );
    return {
      ...existing,
      originalText: mergedText,
      language: input.language || 'und',
      isToxic: Boolean(existing.isToxic || input.isToxic),
      moderationReason: input.moderationReason || existing.moderationReason,
      updatedAt: new Date(),
    };
  }

  const now = new Date();
  const transcript: ISpeechTranscript = {
    roomId: room._id as mongoose.Types.ObjectId,
    segmentKey,
    round,
    phase: turn.phase || 'unknown',
    speaker: turn.speaker || 'UNKNOWN',
    isActiveSpeaker: isActiveSpeaker(room, participant, turn),
    userId: participant.userId,
    username: participant.username,
    role: participant.role,
    team: participant.team,
    speakerSlot: participant.speakerSlot,
    language: input.language || 'und',
    originalText: originalText.slice(0, MAX_TRANSCRIPT_LENGTH),
    isToxic: Boolean(input.isToxic),
    moderationReason: input.moderationReason?.slice(0, 500),
    source: input.source,
    judgeType: room.judgeType as 'human' | 'ai',
    hostType: room.hostType as 'human' | 'ai',
    format: room.format as '1v1' | '3v3',
    startedAt: turn.startTime ? new Date(turn.startTime) : undefined,
    updatedAt: now,
    createdAt: now,
  };

  const result = await DebateSession.updateOne(
    { _id: session._id, 'speechTranscripts.segmentKey': { $ne: segmentKey } },
    { $push: { speechTranscripts: transcript } },
  );

  if (result.modifiedCount === 0) {
    const freshSession = await DebateSession.findById(session._id).select('speechTranscripts');
    const concurrent = freshSession?.speechTranscripts?.find((entry) => entry.segmentKey === segmentKey);
    if (concurrent) {
      transcript.originalText = await updateExistingSegment(
        session._id as mongoose.Types.ObjectId,
        segmentKey,
        concurrent.originalText,
        originalText,
        input.language || 'und',
        Boolean(concurrent.isToxic),
        Boolean(input.isToxic),
        input.moderationReason,
      );
      transcript.isToxic = Boolean(concurrent.isToxic || input.isToxic);
      transcript.moderationReason = input.moderationReason || concurrent.moderationReason;
    }
  }

  return transcript;
}
