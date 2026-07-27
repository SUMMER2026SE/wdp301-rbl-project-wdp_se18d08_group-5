import { Server, Socket } from 'socket.io';
import WebSocket from 'ws';
import { ENV } from '../config/env.js';
import { DebateRoom } from '../models/DebateRoom.js';
import {
  mergeTranscriptText,
  persistSourceCaption,
} from '../features/debate/transcript.service.js';
import {
  BLOCKED_CONTENT_MESSAGE,
  detectLocalToxicContent,
  redactToxicContent,
} from '../features/moderation/content-moderation.service.js';
import {
  buildLiveTranslationAudio,
  buildLiveTranslationSetup,
  buildLiveTranslationUrl,
  type TranslationLanguage,
} from './translation.protocol.js';

type TranslationStartPayload = {
  roomId?: string;
};

type TranslationAudioPayload = {
  roomId?: string;
  data?: string;
};

// Native clients transcribe locally (iOS/Android speech services) and use this
// event to publish the same caption shape as Gemini Live. Keeping one caption
// contract means web and mobile participants can see each other's captions.
type TranslationTextPayload = {
  roomId?: string;
  sourceLanguage?: string;
  sourceText?: string;
  translatedLanguage?: string;
  translatedText?: string;
};

type TranslationAck = (payload: { success: boolean; message?: string }) => void;

type LiveConnection = {
  targetLanguage: TranslationLanguage;
  isPrimary: boolean;
  socket: WebSocket;
  ready: boolean;
  pendingAudio: string[];
};

type TranslationSession = {
  roomId: string;
  userId: string;
  senderName: string;
  connections: LiveConnection[];
  hasReceivedAudio: boolean;
  pendingSourceCaption?: {
    text: string;
    language: string;
    isToxic: boolean;
    moderationReason?: string;
  };
  lastModerationWarningAt?: number;
  redactTranslationsUntil?: number;
  persistenceTimer?: ReturnType<typeof setTimeout>;
  persistenceChain: Promise<void>;
};

const sessionsBySocketId = new Map<string, TranslationSession>();
const MAX_AUDIO_CHUNK_CHARS = 32_000;
const MAX_QUEUED_CHUNKS = 16;
const TRANSCRIPT_PERSIST_DEBOUNCE_MS = 750;

function getSocketUserId(socket: Socket) {
  return (socket as unknown as { userId: string }).userId;
}

function redactGeminiSecret(value: string) {
  if (!ENV.GEMINI_API_KEY) return value;
  return value.split(ENV.GEMINI_API_KEY).join('[redacted]');
}

async function getTextFromWebSocketData(data: unknown) {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (Array.isArray(data)) {
    return Buffer.concat(
      data.map((item) => (Buffer.isBuffer(item) ? item : Buffer.from(item))),
    ).toString('utf8');
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  }
  return '';
}

function emitCaption(
  io: Server,
  session: TranslationSession,
  kind: 'source' | 'translation',
  language: string,
  text: string,
) {
  const trimmedText = text.trim();
  if (!trimmedText) return;

  io.to(session.roomId).emit('translation:caption', {
    roomId: session.roomId,
    senderId: session.userId,
    senderName: session.senderName,
    kind,
    language,
    text: trimmedText,
    timestamp: new Date().toISOString(),
  });
}

function notifySpeechModeration(
  socket: Socket,
  session: TranslationSession,
  isToxic: boolean,
) {
  if (!isToxic) return;

  const now = Date.now();
  session.redactTranslationsUntil = now + 5000;
  if (session.lastModerationWarningAt && now - session.lastModerationWarningAt < 3000) return;
  session.lastModerationWarningAt = now;
  socket.emit('moderation:content-blocked', {
    roomId: session.roomId,
    kind: 'speech',
    code: 'TOXIC_CONTENT',
    message: BLOCKED_CONTENT_MESSAGE,
  });
}

function flushPendingSourceCaption(session: TranslationSession) {
  if (session.persistenceTimer) {
    clearTimeout(session.persistenceTimer);
    session.persistenceTimer = undefined;
  }

  const pending = session.pendingSourceCaption;
  session.pendingSourceCaption = undefined;
  if (!pending?.text.trim()) return;

  session.persistenceChain = session.persistenceChain
    .then(async () => {
      await persistSourceCaption({
        roomId: session.roomId,
        userId: session.userId,
        text: pending.text,
        language: pending.language,
        source: 'gemini-live',
        isToxic: pending.isToxic,
        moderationReason: pending.moderationReason,
      });
    })
    .catch((error) => {
      console.error(`Could not persist live transcript for room ${session.roomId}:`, error);
    });
}

function queueSourceCaptionPersistence(
  session: TranslationSession,
  text: string,
  language: string,
) {
  const mergedText = mergeTranscriptText(session.pendingSourceCaption?.text, text);
  const moderation = detectLocalToxicContent(mergedText);
  session.pendingSourceCaption = {
    text: mergedText,
    language: language || session.pendingSourceCaption?.language || 'und',
    isToxic: Boolean(session.pendingSourceCaption?.isToxic || moderation.isToxic),
    moderationReason:
      moderation.reason || session.pendingSourceCaption?.moderationReason,
  };

  if (session.persistenceTimer) clearTimeout(session.persistenceTimer);
  session.persistenceTimer = setTimeout(
    () => flushPendingSourceCaption(session),
    TRANSCRIPT_PERSIST_DEBOUNCE_MS,
  );
}

function stopTranslation(socketId: string) {
  const session = sessionsBySocketId.get(socketId);
  if (!session) return;

  flushPendingSourceCaption(session);
  session.connections.forEach((connection) => {
    connection.pendingAudio.length = 0;
    try {
      connection.socket.close();
    } catch {
      // The connection may already be closed by Gemini.
    }
  });
  sessionsBySocketId.delete(socketId);
}

function sendAudio(connection: LiveConnection, audioBase64: string) {
  const payload = JSON.stringify(buildLiveTranslationAudio(audioBase64));

  if (!connection.ready || connection.socket.readyState !== WebSocket.OPEN) {
    connection.pendingAudio.push(audioBase64);
    if (connection.pendingAudio.length > MAX_QUEUED_CHUNKS) connection.pendingAudio.shift();
    return;
  }

  connection.socket.send(payload);
}

function flushAudio(connection: LiveConnection) {
  const queuedChunks = connection.pendingAudio.splice(0);
  queuedChunks.forEach((audioBase64) => sendAudio(connection, audioBase64));
}

function createLiveConnection(
  io: Server,
  ownerSocket: Socket,
  session: TranslationSession,
  targetLanguage: TranslationLanguage,
  isPrimary: boolean,
) {
  // Keep the standard API key on the server. Northflank injects it as a
  // runtime secret, while browsers only relay PCM through authenticated IO.
  const liveSocket = new WebSocket(buildLiveTranslationUrl(ENV.GEMINI_API_KEY));
  const connection: LiveConnection = {
    targetLanguage,
    isPrimary,
    socket: liveSocket,
    ready: false,
    pendingAudio: [],
  };

  liveSocket.on('open', () => {
    liveSocket.send(
      JSON.stringify(buildLiveTranslationSetup(ENV.GEMINI_LIVE_MODEL, targetLanguage)),
    );
  });

  liveSocket.on('message', async (data) => {
    try {
      const rawText = await getTextFromWebSocketData(data);
      if (!rawText) return;
      const payload = JSON.parse(rawText) as {
        setupComplete?: unknown;
        serverContent?: {
          inputTranscription?: { text?: string; languageCode?: string };
          outputTranscription?: { text?: string; languageCode?: string };
        };
      };

      if (payload.setupComplete !== undefined) {
        connection.ready = true;
        flushAudio(connection);
        if (session.connections.every((item) => item.ready)) {
          ownerSocket.emit('translation:status', { roomId: session.roomId, state: 'ready' });
        }
      }

      const content = payload.serverContent;
      const input = content?.inputTranscription;
      if (input?.text && connection.isPrimary) {
        const combinedSourceText = mergeTranscriptText(
          session.pendingSourceCaption?.text,
          input.text,
        );
        const moderation = detectLocalToxicContent(combinedSourceText);
        emitCaption(
          io,
          session,
          'source',
          input.languageCode || 'und',
          redactToxicContent(input.text, moderation),
        );
        notifySpeechModeration(ownerSocket, session, moderation.isToxic);
        queueSourceCaptionPersistence(session, input.text, input.languageCode || 'und');
        ownerSocket.emit('translation:status', { roomId: session.roomId, state: 'captioning' });
      }

      const output = content?.outputTranscription;
      if (output?.text) {
        const outputModeration = detectLocalToxicContent(output.text);
        const shouldRedact =
          Boolean(session.pendingSourceCaption?.isToxic)
          || Boolean(session.redactTranslationsUntil && session.redactTranslationsUntil > Date.now())
          || outputModeration.isToxic;
        emitCaption(
          io,
          session,
          'translation',
          output.languageCode || targetLanguage,
          shouldRedact
            ? redactToxicContent(output.text, { ...outputModeration, isToxic: true })
            : output.text,
        );
        ownerSocket.emit('translation:status', { roomId: session.roomId, state: 'captioning' });
      }
    } catch (error) {
      console.error('Gemini Live response could not be parsed:', error);
    }
  });

  liveSocket.on('error', (error) => {
    const detail = redactGeminiSecret(
      error instanceof Error ? error.message : 'Unknown WebSocket error',
    );
    console.error(`Gemini Live connection error for room ${session.roomId}: ${detail}`);
    ownerSocket.emit('translation:status', {
      roomId: session.roomId,
      state: 'error',
      message: 'Live translation connection failed. Voice chat is still available.',
    });
  });

  liveSocket.on('close', (code, closeReason) => {
    // Intentional stop() deletes the session before close fires. Any close
    // while it is still active is useful feedback (invalid model/key, quota,
    // or a Live API protocol rejection) rather than a silent failure.
    if (sessionsBySocketId.get(ownerSocket.id) !== session) return;
    const detail = redactGeminiSecret(closeReason.toString());
    const reason = detail ? ` (${detail})` : '';
    console.error(`Gemini Live connection closed for room ${session.roomId}: ${code}${reason}`);
    ownerSocket.emit('translation:status', {
      roomId: session.roomId,
      state: 'error',
      message: `Live translation connection closed${reason}. Voice chat is still available.`,
    });
  });

  return connection;
}

export function registerTranslationHandlers(io: Server, socket: Socket) {
  const userId = getSocketUserId(socket);

  socket.on('translation:text', async (payload: TranslationTextPayload) => {
    const roomId = payload?.roomId;
    const sourceText = payload?.sourceText?.trim();
    if (!roomId || !sourceText || sourceText.length > 1400) return;

    try {
      const room = await DebateRoom.findById(roomId).select('participants');
      const participant = room?.participants.find((entry) => entry.userId.toString() === userId);
      if (!participant) return;

      const session: TranslationSession = {
        roomId,
        userId,
        senderName: participant.username,
        connections: [],
        hasReceivedAudio: false,
        persistenceChain: Promise.resolve(),
      };
      const sourceModeration = detectLocalToxicContent(sourceText);
      emitCaption(
        io,
        session,
        'source',
        payload.sourceLanguage || 'und',
        redactToxicContent(sourceText, sourceModeration),
      );
      notifySpeechModeration(socket, session, sourceModeration.isToxic);
      await persistSourceCaption({
        roomId,
        userId,
        text: sourceText,
        language: payload.sourceLanguage || 'und',
        source: 'native-client',
        isToxic: sourceModeration.isToxic,
        moderationReason: sourceModeration.reason,
      });

      const translatedText = payload?.translatedText?.trim();
      if (translatedText && translatedText.length <= 1400) {
        const translationModeration = detectLocalToxicContent(translatedText);
        emitCaption(
          io,
          session,
          'translation',
          payload.translatedLanguage || 'und',
          sourceModeration.isToxic || translationModeration.isToxic
            ? redactToxicContent(translatedText, { ...translationModeration, isToxic: true })
            : translatedText,
        );
      }
    } catch (error) {
      console.error('Could not relay native live caption:', error);
    }
  });

  socket.on('translation:start', async (payload: TranslationStartPayload, ack?: TranslationAck) => {
    const roomId = payload?.roomId;

    if (!roomId) {
      ack?.({ success: false, message: 'A valid room is required' });
      return;
    }

    if (!ENV.GEMINI_API_KEY) {
      const message = 'Live translation is unavailable because GEMINI_API_KEY is not configured';
      socket.emit('translation:status', { roomId, state: 'error', message });
      ack?.({ success: false, message });
      return;
    }

    try {
      const room = await DebateRoom.findById(roomId).select('participants');
      const participant = room?.participants.find((entry) => entry.userId.toString() === userId);
      if (!participant) {
        ack?.({ success: false, message: 'You are not a participant in this debate room' });
        return;
      }

      stopTranslation(socket.id);
      const session: TranslationSession = {
        roomId,
        userId,
        senderName: participant.username,
        connections: [],
        hasReceivedAudio: false,
        persistenceChain: Promise.resolve(),
      };
      sessionsBySocketId.set(socket.id, session);

      const targetLanguages: TranslationLanguage[] = ['en', 'vi'];
      session.connections = targetLanguages.map((targetLanguage, index) =>
        createLiveConnection(io, socket, session, targetLanguage, index === 0),
      );

      socket.emit('translation:status', { roomId, state: 'connecting' });
      ack?.({ success: true });
    } catch (error) {
      stopTranslation(socket.id);
      console.error('Could not start Gemini Live translation:', error);
      const message = 'Could not start live translation. Voice chat is still available.';
      socket.emit('translation:status', { roomId, state: 'error', message });
      ack?.({ success: false, message });
    }
  });

  socket.on('translation:audio', (payload: TranslationAudioPayload) => {
    const session = sessionsBySocketId.get(socket.id);
    const audioBase64 = payload?.data;
    if (!session || payload?.roomId !== session.roomId || !audioBase64) return;
    if (audioBase64.length > MAX_AUDIO_CHUNK_CHARS) return;

    if (!session.hasReceivedAudio) {
      session.hasReceivedAudio = true;
      socket.emit('translation:status', { roomId: session.roomId, state: 'receiving_audio' });
    }

    session.connections.forEach((connection) => {
      try {
        sendAudio(connection, audioBase64);
      } catch (error) {
        console.error('Could not send audio to Gemini Live:', error);
      }
    });
  });

  socket.on('translation:stop', ({ roomId }: { roomId?: string }) => {
    const session = sessionsBySocketId.get(socket.id);
    if (session && (!roomId || roomId === session.roomId)) {
      stopTranslation(socket.id);
    }
  });

  socket.on('disconnect', () => stopTranslation(socket.id));
}
