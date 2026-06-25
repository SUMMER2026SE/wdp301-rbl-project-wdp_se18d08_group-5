import { Server, Socket } from 'socket.io';
import { ENV } from '../config/env.js';
import { DebateRoom } from '../models/DebateRoom.js';

type TranslationLanguage = 'en' | 'vi';

type LiveWebSocket = {
  readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void | Promise<void>) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  send: (data: string) => void;
  close: () => void;
};

type TranslationStartPayload = {
  roomId?: string;
};

type TranslationAudioPayload = {
  roomId?: string;
  data?: string;
};

type TranslationAck = (payload: { success: boolean; message?: string }) => void;

type LiveConnection = {
  targetLanguage: TranslationLanguage;
  isPrimary: boolean;
  socket: LiveWebSocket;
  ready: boolean;
  pendingAudio: string[];
};

type TranslationSession = {
  roomId: string;
  userId: string;
  senderName: string;
  connections: LiveConnection[];
  hasReceivedAudio: boolean;
};

const sessionsBySocketId = new Map<string, TranslationSession>();
const MAX_AUDIO_CHUNK_CHARS = 32_000;
const MAX_QUEUED_CHUNKS = 16;

function getSocketUserId(socket: Socket) {
  return (socket as unknown as { userId: string }).userId;
}

function getLiveWebSocketConstructor() {
  return (globalThis as unknown as {
    WebSocket?: new (url: string) => LiveWebSocket;
  }).WebSocket;
}

async function getTextFromWebSocketData(data: unknown) {
  if (typeof data === 'string') return data;
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
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

function stopTranslation(socketId: string) {
  const session = sessionsBySocketId.get(socketId);
  if (!session) return;

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
  const payload = JSON.stringify({
    realtime_input: {
      media_chunks: [
        {
          mime_type: 'audio/pcm;rate=16000',
          data: audioBase64,
        },
      ],
    },
  });

  // OPEN is 1 in the standard WebSocket ready-state enum.
  if (!connection.ready || connection.socket.readyState !== 1) {
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
  const WebSocketConstructor = getLiveWebSocketConstructor();
  if (!WebSocketConstructor) {
    throw new Error('This Node runtime does not provide a WebSocket client');
  }

  // Live translation configuration is currently exposed on the v1alpha
  // Bidi endpoint. The API key stays server-side; browsers only stream PCM
  // through this authenticated Socket.IO relay.
  const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(ENV.GEMINI_API_KEY)}`;
  const liveSocket = new WebSocketConstructor(url);
  const connection: LiveConnection = {
    targetLanguage,
    isPrimary,
    socket: liveSocket,
    ready: false,
    pendingAudio: [],
  };

  liveSocket.onopen = () => {
    liveSocket.send(JSON.stringify({
      setup: {
        model: `models/${ENV.GEMINI_LIVE_MODEL}`,
        generation_config: {
          response_modalities: ['AUDIO'],
          translation_config: {
            target_language_code: targetLanguage,
            // Each browser decides whether to show the original transcript
            // or translated text. Two target streams give us
            // Vietnamese → English and English → Vietnamese at once.
            echo_target_language: false,
          },
        },
        input_audio_transcription: {},
        output_audio_transcription: {},
      },
    }));
  };

  liveSocket.onmessage = async (event) => {
    try {
      const rawText = await getTextFromWebSocketData(event.data);
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
        emitCaption(io, session, 'source', input.languageCode || 'und', input.text);
        ownerSocket.emit('translation:status', { roomId: session.roomId, state: 'captioning' });
      }

      const output = content?.outputTranscription;
      if (output?.text) {
        emitCaption(io, session, 'translation', output.languageCode || targetLanguage, output.text);
        ownerSocket.emit('translation:status', { roomId: session.roomId, state: 'captioning' });
      }
    } catch (error) {
      console.error('Gemini Live response could not be parsed:', error);
    }
  };

  liveSocket.onerror = () => {
    console.error(`Gemini Live connection error for room ${session.roomId}`);
    ownerSocket.emit('translation:status', {
      roomId: session.roomId,
      state: 'error',
      message: 'Live translation connection failed. Voice chat is still available.',
    });
  };

  liveSocket.onclose = (event) => {
    // Intentional stop() deletes the session before close fires. Any close
    // while it is still active is useful feedback (invalid model/key, quota,
    // or a Live API protocol rejection) rather than a silent failure.
    if (sessionsBySocketId.get(ownerSocket.id) !== session) return;
    const detail = event as { code?: number; reason?: string };
    const reason = detail.reason ? ` (${detail.reason})` : '';
    console.error(`Gemini Live connection closed for room ${session.roomId}: ${detail.code || 'unknown'}${reason}`);
    ownerSocket.emit('translation:status', {
      roomId: session.roomId,
      state: 'error',
      message: `Live translation connection closed${reason}. Voice chat is still available.`,
    });
  };

  return connection;
}

export function registerTranslationHandlers(io: Server, socket: Socket) {
  const userId = getSocketUserId(socket);

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
