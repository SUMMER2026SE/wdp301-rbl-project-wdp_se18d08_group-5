import { describe, expect, it } from 'vitest';
import {
  buildLiveTranslationAudio,
  buildLiveTranslationSetup,
  buildLiveTranslationUrl,
} from './translation.protocol.js';

describe('Gemini Live Translate protocol', () => {
  it('uses the v1beta BidiGenerateContent endpoint and safely encodes the key', () => {
    const url = buildLiveTranslationUrl('test/key+value');

    expect(url).toBe(
      'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=test%2Fkey%2Bvalue',
    );
  });

  it('builds the supported translation-only setup message', () => {
    const message = buildLiveTranslationSetup('gemini-3.5-live-translate-preview', 'vi');

    expect(message).toEqual({
      setup: {
        model: 'models/gemini-3.5-live-translate-preview',
        generationConfig: {
          responseModalities: ['AUDIO'],
          translationConfig: {
            targetLanguageCode: 'vi',
            echoTargetLanguage: false,
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    });
    expect(message.setup.generationConfig).not.toHaveProperty('inputAudioTranscription');
    expect(message.setup.generationConfig).not.toHaveProperty('outputAudioTranscription');
    expect(message.setup).not.toHaveProperty('systemInstruction');
  });

  it('builds the current realtime PCM audio message', () => {
    expect(buildLiveTranslationAudio('base64-audio')).toEqual({
      realtimeInput: {
        audio: {
          data: 'base64-audio',
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    });
  });
});
