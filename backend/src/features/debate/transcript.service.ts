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
  const match = value.match(/(?:S|ROUND_|FB_)([123])\b/i);
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

export function shouldUseTranscriptForAI(judgeType: string): boolean {
  return judgeType === 'ai';
}

async function updateExistingSegment(
  sessionId: mongoose.Types.ObjectId,
  segmentKey: string,
  existingText: string,
  incomingText: string,
  language: string,
) {
  const mergedText = mergeTranscriptText(existingText, incomingText);
  await DebateSession.updateOne(
    { _id: sessionId, 'speechTranscripts.segmentKey': segmentKey },
    {
      $set: {
        'speechTranscripts.$.originalText': mergedText,
        'speechTranscripts.$.language': language || 'und',
        'speechTranscripts.$.updatedAt': new Date(),
      },
    },
  );
  return mergedText;
}

export async function persistSourceCaption(input: {
  roomId: string;
  userId: string;
  text: string;
  language?: string;
  source: TranscriptSource;
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
    );
    return {
      ...existing,
      originalText: mergedText,
      language: input.language || 'und',
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
      );
    }
  }

  return transcript;
}
