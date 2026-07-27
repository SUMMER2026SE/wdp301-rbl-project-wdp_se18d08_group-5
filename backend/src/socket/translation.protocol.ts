export type TranslationLanguage = 'en' | 'vi';

const GEMINI_LIVE_WEBSOCKET_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

export function buildLiveTranslationUrl(apiKey: string) {
  return `${GEMINI_LIVE_WEBSOCKET_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
}

export function buildLiveTranslationSetup(model: string, targetLanguage: TranslationLanguage) {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: {
        responseModalities: ['AUDIO'],
        translationConfig: {
          targetLanguageCode: targetLanguage,
          echoTargetLanguage: false,
        },
      },
      // BidiGenerateContentSetup owns the transcription fields. Putting
      // these inside generationConfig is rejected by the v1beta WebSocket
      // schema as an unknown GenerationConfig field.
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };
}

export function buildLiveTranslationAudio(audioBase64: string) {
  return {
    realtimeInput: {
      audio: {
        data: audioBase64,
        mimeType: 'audio/pcm;rate=16000',
      },
    },
  };
}
