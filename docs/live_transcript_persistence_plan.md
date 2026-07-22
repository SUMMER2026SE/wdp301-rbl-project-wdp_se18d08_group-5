# Live Transcript Persistence Plan

Implementation status: completed on 2026-07-22.

## Goal

Store speech-to-text transcripts from debate microphones in the database with enough structure for replay, review, and AI analysis when the room uses an AI judge.

Current live captions already work through Gemini Live:

- Frontend `MicToggle.tsx` captures microphone audio.
- Frontend sends PCM chunks through Socket.IO event `translation:audio`.
- Backend `translation.socket.ts` streams audio to Gemini Live.
- Gemini returns `inputTranscription.text`.
- Backend emits `translation:caption` with `kind: "source"`.
- Frontend `LiveTranslationCaptions.tsx` displays that text in the `Original` tab.

Previously, the transcript was mostly browser-local until a phase was skipped or finished. The implementation now persists canonical source captions as structured records while keeping `turnHistory[].transcript` for backward compatibility.

This feature must support different room types:

- `judgeType: human`: persist transcripts only. Human judges still score manually. The transcript is used for review, replay, and audit.
- `judgeType: ai`: persist transcripts and use them as structured input for AI judge analysis/scoring.
- `hostType: human` or no-host modes: transcript persistence should work the same way. Host mode only affects who can start/skip phases, not whether speech is saved.
- `format: 1v1` and `format: 3v3`: transcript segments must include round, speaker, team, and slot so AI/human review can separate each speaker correctly.

## Problem

The current approach can lose or mix transcripts in these cases:

- Host skips a debater turn from another browser, but the host does not have the debater transcript in local state.
- Multiple participants speak in the same phase.
- Reconnect or refresh clears browser-local caption state.
- AI judge rooms need structured context by round, speaker, team, and phase, but `turnHistory[].transcript` is only a string.
- Human judge rooms still need accurate transcript storage, even if the transcript is not used for automatic scoring.
- Translation captions are emitted live but not saved as first-class records.

## Implemented Data Model

Add a new array field to `DebateSession`:

```ts
speechTranscripts: Array<{
  roomId: ObjectId;
  round: 0 | 1 | 2 | 3;
  phase: string;
  speaker: string;
  isActiveSpeaker: boolean;
  userId: ObjectId;
  username: string;
  role: 'host' | 'debater' | 'judge' | 'viewer' | 'owner';
  team?: 'proposition' | 'opposition';
  speakerSlot?: 'S1' | 'S2' | 'S3';
  language: string;
  originalText: string;
  translatedText?: string;
  source: 'gemini-live' | 'native-client';
  judgeType: 'human' | 'ai';
  hostType: 'human' | 'ai';
  format: '1v1' | '3v3';
  startedAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}>;
```

Recommended indexes:

- `roomId`
- `speechTranscripts.userId`
- `speechTranscripts.round`
- `speechTranscripts.speaker`
- `speechTranscripts.phase`

If the array becomes too large later, move it into a separate `DebateTranscript` collection. For the current room size, embedding in `DebateSession` is simpler.

## Backend Flow

Update `backend/src/socket/translation.socket.ts`.

When Gemini returns `inputTranscription.text`:

1. Keep emitting `translation:caption` so the UI still updates live.
2. Resolve the speaker metadata from:
   - `DebateRoom.participants`
   - `DebateSession.currentTurn`
   - current phase and speaker code
3. Detect round from `currentTurn.phase` and `currentTurn.speaker`.
4. Upsert/append the transcript segment into `DebateSession.speechTranscripts`.

Important rule:

- Persist only `kind: "source"` as the canonical original transcript.
- Store translation text only as optional helper data.
- Human judge rooms should not auto-score from transcripts. They only save the script/transcript.
- AI judge rooms should primarily use `originalText` for analysis and scoring.
- Store captions from every participant, but AI scoring must only use segments where `isActiveSpeaker: true` during speech phases.

## Room Mode Rules

### Human Judge Rooms

For `judgeType: human`:

- Save transcript segments to `DebateSession.speechTranscripts`.
- Keep showing live captions in the `Original` tab.
- Do not trigger AI scoring from transcript persistence alone.
- Human judges continue submitting scores through the existing judge form.
- At the end of the game, transcript can be shown in replay/result pages for transparency.

### AI Judge Rooms

For `judgeType: ai`:

- Save transcript segments to `DebateSession.speechTranscripts`.
- Use saved transcripts as the source of truth for AI judge prompts.
- Group transcript by round/team/speaker before calling AI.
- Do not rely only on frontend `turnTranscript`, because the browser that skips/ends the phase may not be the browser that captured the speech.

### Host and No-Host Rooms

Transcript persistence should be independent from host mode:

- Human host + human judge: save transcript only.
- Human host + AI judge: save transcript and use it for AI scoring.
- No-host + human judge: save transcript only.
- No-host + AI judge: save transcript and use it for AI scoring.

## Segment Merge Strategy

Gemini can return partial transcript chunks. Do not create one DB row for every tiny chunk.

Use a stable active segment key:

```text
roomId + userId + currentTurn.speaker + currentTurn.phase + round
```

When a new source caption arrives:

- If an active segment exists, merge text into `originalText`.
- If no active segment exists, create a new segment.
- Update `updatedAt` on each merge.

Suggested merge rule:

- Trim incoming text.
- If incoming text already starts with existing text, replace with incoming text.
- If existing text already includes incoming text, keep existing.
- Otherwise append with one space.

This matches the current frontend merge behavior in `LiveTranslationCaptions.tsx`.

## Frontend Flow

Minimal frontend changes:

- Keep `MicToggle.tsx` unchanged for capture.
- Keep `LiveTranslationCaptions.tsx` unchanged for live display.
- Keep `Original` tab showing `kind: "source"`.

Optional frontend improvement:

- Add a small status label such as `Saved` / `Syncing` if backend emits persistence acknowledgements.

Do not rely on frontend `turnTranscript` as the only source of truth anymore. It can remain as a fallback for existing skip/finish endpoints.

## AI Scoring Usage

Only apply this section when `room.judgeType === 'ai'`.

At the end of a round or game:

1. Load `DebateSession.speechTranscripts`.
2. Group by:
   - round
   - team
   - userId
   - speaker
3. Build AI context:

```ts
{
  round: 1,
  proposition: [
    {
      userId,
      username,
      speaker: 'PRO_S1',
      transcript: originalText
    }
  ],
  opposition: [
    {
      userId,
      username,
      speaker: 'OPP_S1',
      transcript: originalText
    }
  ]
}
```

4. Send this structured context to AI judge/AI feedback.

For `room.judgeType === 'human'`, skip this AI step and keep the transcript for review/replay only.

## Compatibility With Current Code

Existing fields should remain:

- `turnHistory[].transcript`
- `currentTurn`
- `finalScores.judgeVerdicts`

When a phase ends, backend can also copy the matching structured transcript into `turnHistory[].transcript` for backward compatibility.

## Implementation Checklist

1. [x] Add `speechTranscripts` to `backend/src/models/DebateSession.ts`.
2. [x] Add helper functions:
   - `resolveTranscriptParticipant(room, userId)`
   - `detectTranscriptRound(currentTurn)`
   - `mergeTranscriptText(existing, incoming)`
   - `persistSourceCaption({ roomId, userId, text, language, source })`
3. [x] Call persistence from `translation.socket.ts` when Gemini returns `inputTranscription.text`.
4. [x] Persist native captions from `translation:text` too.
5. [x] Keep emitting `translation:caption` for UI.
6. [x] Update AI judge call sites to prefer `speechTranscripts` over plain `turnHistory[].transcript` only when `judgeType === 'ai'`.
7. [x] Ensure human judge rooms save scripts without triggering AI scoring.
8. [x] Add focused unit tests for:
   - same user same turn merges into one segment
   - new phase creates a new segment
   - PRO/OPP/user metadata is stored correctly
   - Human Judge room stores the script without an AI path
   - AI input excludes participants who speak outside their assigned 3v3 turn

## Risks

- Gemini partial transcripts may duplicate words if merge logic is too naive.
- Saving every caption too frequently can increase MongoDB writes.
- If multiple tabs are opened by the same account, segments may merge unexpectedly unless socket/session identity is considered.

Mitigation:

- Debounce DB writes every 1-2 seconds per socket.
- Use current turn metadata in the segment key.
- Keep text length capped per segment.
