import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env.js', () => ({
  ENV: {
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: 'translation-key-must-not-be-used',
    GEMINI_AGENT_API_KEYS: ['judge-key-1', 'judge-key-2'],
    GEMINI_AGENT_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_AGENT_TIMEOUT_MS: 60000,
  },
}));

import {
  AIProviderUnavailableError,
  AIService,
} from './ai.service.js';

const validJudgeResult = {
  score: {
    logic: 20,
    rebuttal: 15,
    evidence: 10,
    crossExam: 10,
    strategy: 8,
    communication: 8,
    overall: 71,
  },
  verdict: 'proposition',
  comments: 'Clear reasoning',
  strengths: ['Reasoning'],
  weaknesses: [],
  fallacies: [],
  summary: 'A valid Judge result',
};

function geminiResponse(result = validJudgeResult) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{ text: JSON.stringify(result) }],
      },
    }],
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AIService Gemini AI Judge provider', () => {
  it('uses only the Judge model and Judge key pool with a bounded request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(geminiResponse());
    vi.stubGlobal('fetch', fetchMock);

    const result = await new AIService().judgeTurn('room-1', 'PRO_S1', 'Speech', {
      motion: 'Motion',
    });

    expect(result.verdict).toBe('proposition');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, request] = fetchMock.mock.calls[0];
    const headers = new Headers(request?.headers);
    const body = JSON.parse(String(request?.body));

    expect(String(url)).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect(String(url)).not.toContain('translation-key-must-not-be-used');
    expect(String(url)).not.toContain('judge-key-1');
    expect(headers.get('x-goog-api-key')).toBe('judge-key-1');
    expect(request?.signal).toBeDefined();
    expect(body.systemInstruction.parts[0].text).toContain('AI judge');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.temperature).toBeUndefined();
  });

  it.each([403, 429, 500])('rotates to the next Judge key after HTTP %s', async (status) => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('upstream failure', { status }))
      .mockResolvedValueOnce(geminiResponse());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await new AIService().judgeTurn('room-1', 'OPP_S1', 'Speech', {});

    expect(result.verdict).toBe('proposition');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('x-goog-api-key')).toBe('judge-key-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('x-goog-api-key')).toBe('judge-key-2');
  });

  it('throws instead of converting provider failure into a fake zero-score draw', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
      .mockResolvedValueOnce(new Response('quota', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      new AIService().judgeTurn('room-1', 'PRO_S1', 'Speech', {}),
    ).rejects.toBeInstanceOf(AIProviderUnavailableError);
  });

  it('throws when Gemini returns malformed JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(geminiResponse('not-json' as any));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new AIService().judgeTurn('room-1', 'PRO_S1', 'Speech', {}),
    ).rejects.toThrow('invalid JSON');
  });

  it('rejects a JSON object that is not a valid Judge result', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(geminiResponse({} as any));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new AIService().judgeTurn('room-1', 'PRO_S1', 'Speech', {}),
    ).rejects.toThrow('invalid result shape');
  });
});
