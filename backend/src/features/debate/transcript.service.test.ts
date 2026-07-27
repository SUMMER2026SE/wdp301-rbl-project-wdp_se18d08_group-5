import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { IDebateRoom } from '../../models/DebateRoom.js';
import type { IDebateSession, ISpeechTranscript } from '../../models/DebateSession.js';
import {
  buildFinalAnalysisTranscriptBundle,
  detectTranscriptRound,
} from './transcript.service.js';

const roomId = new mongoose.Types.ObjectId();
const proId = new mongoose.Types.ObjectId();
const oppId = new mongoose.Types.ObjectId();
const hostId = new mongoose.Types.ObjectId();

function transcript(overrides: Partial<ISpeechTranscript>): ISpeechTranscript {
  const now = new Date('2026-07-23T00:00:00.000Z');
  return {
    roomId,
    segmentKey: 'segment',
    round: 1,
    phase: 'speech',
    speaker: 'PRO_S1',
    isActiveSpeaker: true,
    userId: proId,
    username: 'Pro Speaker',
    role: 'debater',
    team: 'proposition',
    speakerSlot: 'S1',
    language: 'vi',
    originalText: 'Proposition argument',
    isToxic: false,
    source: 'gemini-live',
    judgeType: 'ai',
    hostType: 'human',
    format: '1v1',
    updatedAt: now,
    createdAt: now,
    ...overrides,
  };
}

const room = {
  format: '1v1',
  participants: [
    { userId: proId, username: 'Pro Speaker', roomRole: 'debater', team: 'proposition', speakerSlot: 'S1' },
    { userId: oppId, username: 'Opp Speaker', roomRole: 'debater', team: 'opposition', speakerSlot: 'S1' },
    { userId: hostId, username: 'Host', roomRole: 'owner', primaryRole: 'host' },
  ],
} as unknown as Pick<IDebateRoom, 'format' | 'participants'>;

describe('final analysis transcript bundle', () => {
  it('detects speech and cross-examination round identifiers', () => {
    expect(detectTranscriptRound({ speaker: 'PRO_S2', phase: 'speech' })).toBe(2);
    expect(detectTranscriptRound({ speaker: 'CE_ROUND_1', phase: 'cross_exam' })).toBe(1);
    expect(detectTranscriptRound({ speaker: 'CROSS_EXAM_2', phase: 'cross_exam' })).toBe(2);
  });

  it('keeps active debater speech and CE, excluding host and off-turn speech', () => {
    const bundle = buildFinalAnalysisTranscriptBundle(room, {
      speechTranscripts: [
        transcript({ segmentKey: 'pro-speech' }),
        transcript({
          segmentKey: 'opp-off-turn',
          userId: oppId,
          username: 'Opp Speaker',
          team: 'opposition',
          speaker: 'PRO_S1',
          originalText: 'Should not be scored',
          isActiveSpeaker: false,
        }),
        transcript({
          segmentKey: 'opp-ce',
          userId: oppId,
          username: 'Opp Speaker',
          team: 'opposition',
          speaker: 'CE_ROUND_1',
          phase: 'cross_exam',
          originalText: 'Opposition cross examination',
          isActiveSpeaker: false,
        }),
        transcript({
          segmentKey: 'host-speech',
          userId: hostId,
          username: 'Host',
          role: 'host',
          team: undefined,
          speakerSlot: undefined,
          originalText: 'Administrative announcement',
        }),
      ],
      turnHistory: [],
    } as unknown as Pick<IDebateSession, 'speechTranscripts' | 'turnHistory'>);

    expect(bundle.participants).toHaveLength(2);
    expect(bundle.segments.map((entry) => entry.segmentKey)).toEqual(['pro-speech', 'opp-ce']);
    expect(bundle.expectedRounds[2].proposition.userId).toBe(proId.toString());
    expect(bundle.expectedRounds[2].opposition.userId).toBe(oppId.toString());
  });

  it('uses turn history only when a saved segment for that turn is missing', () => {
    const bundle = buildFinalAnalysisTranscriptBundle(room, {
      speechTranscripts: [transcript({ segmentKey: 'saved-pro' })],
      turnHistory: [
        { speaker: 'PRO_S1', transcript: 'duplicate fallback', crossExamination: null },
        { speaker: 'OPP_S2', transcript: 'legacy opposition speech', crossExamination: null },
      ],
    } as unknown as Pick<IDebateSession, 'speechTranscripts' | 'turnHistory'>);

    expect(bundle.segments).toHaveLength(2);
    expect(bundle.segments.some((entry) => entry.text === 'duplicate fallback')).toBe(false);
    expect(bundle.segments.some((entry) => entry.text === 'legacy opposition speech')).toBe(true);
  });
});
