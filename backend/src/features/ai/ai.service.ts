import OpenAI from 'openai';
import { ENV } from '../../config/env.js';

const openai = ENV.OPENAI_API_KEY ? new OpenAI({ apiKey: ENV.OPENAI_API_KEY }) : null;

export class AIProviderUnavailableError extends Error {
  constructor(message = 'AI Judge provider is unavailable') {
    super(message);
    this.name = 'AIProviderUnavailableError';
  }
}

type AIMessage = {
  role: 'system' | 'user';
  content: string;
};

export type FinalDebateAIRequest = {
  roomId: string;
  motion: string;
  format: '1v1' | '3v3';
  judgeMode: 'ai' | 'human';
  officialWinner: 'proposition' | 'opposition' | 'draw' | null;
  transcriptBundle: unknown;
  judgeVerdicts: unknown[];
};

export type AIJudgeTurnResult = {
  score: {
    logic: number;
    rebuttal: number;
    evidence: number;
    crossExam: number;
    strategy: number;
    communication: number;
    overall: number;
  };
  verdict: 'proposition' | 'opposition' | 'draw';
  comments: string;
  strengths: string[];
  weaknesses: string[];
  fallacies: Array<{ type: string; description: string }>;
  summary: string;
};

function isAIJudgeTurnResult(value: unknown): value is AIJudgeTurnResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  const score = result.score as Record<string, unknown> | undefined;
  const scoreFields = [
    'logic',
    'rebuttal',
    'evidence',
    'crossExam',
    'strategy',
    'communication',
    'overall',
  ];
  return Boolean(
    score &&
    scoreFields.every((field) => Number.isFinite(score[field])) &&
    ['proposition', 'opposition', 'draw'].includes(String(result.verdict)) &&
    typeof result.comments === 'string' &&
    typeof result.summary === 'string' &&
    Array.isArray(result.strengths) &&
    Array.isArray(result.weaknesses) &&
    Array.isArray(result.fallacies),
  );
}

export class AIService {
  private geminiAgentKeyIndex = 0;

  /**
   * Analyze a speech: claims, strengths, weaknesses, fallacies, score.
   */
  async analyzeSpeech(speech: string, motion: string, team: string, speakerSlot: string) {
    try {
      const systemPrompt = `You are an expert debate judge. Analyze the following speech in a debate about "${motion}".
The speaker is on the ${team} side, speaking as ${speakerSlot}.
Return JSON with: { score: { logic: 0-30, rebuttal: 0-20, evidence: 0-15, crossExam: 0-15, strategy: 0-10, communication: 0-10, overall: 0-100 }, strengths: string[], weaknesses: string[], fallacies: { type: string, description: string }[], summary: string }`;
      return await this.generateJSON(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: speech },
        ],
        0.3,
        this.getFallbackAnalysis(),
      );
    } catch (error) {
      console.error('AI analyzeSpeech error:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Score an argument (simplified).
   */
  async scoreArgument(speech: string, motion: string) {
    try {
      return await this.generateJSON(
        [
          {
            role: 'system',
            content: `Score this debate argument about "${motion}". Return JSON: { logic: 0-30, rebuttal: 0-20, evidence: 0-15, crossExam: 0-15, strategy: 0-10, communication: 0-10, overall: 0-100 }`,
          },
          { role: 'user', content: speech },
        ],
        0.3,
        this.getFallbackScore(),
      );
    } catch {
      return this.getFallbackScore();
    }
  }

  async judgeTurn(
    roomId: string,
    speaker: string,
    transcript: string,
    context: any,
  ): Promise<AIJudgeTurnResult> {
    const prompt = `You are an AI judge evaluating one debate turn for room ${roomId}. The speaker is ${speaker}. Use the transcript and context to provide a JSON result with { score: { logic: 0-30, rebuttal: 0-20, evidence: 0-15, crossExam: 0-15, strategy: 0-10, communication: 0-10, overall: 0-100 }, verdict: 'proposition' | 'opposition' | 'draw', comments: string, strengths: string[], weaknesses: string[], fallacies: { type: string, description: string }[], summary: string }`;
    const result = await this.generateRequiredJSON<unknown>(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: `${transcript}\n\nContext:\n${JSON.stringify(context || {})}` },
      ],
      0.3,
    );
    if (!isAIJudgeTurnResult(result)) {
      throw new AIProviderUnavailableError('AI Judge returned an invalid result shape');
    }
    return result;
  }

  async finalVerdict(roomId: string, sessionData: any) {
    try {
      const prompt = `You are an AI head judge for room ${roomId}. Review the session data and provide a final verdict in Vietnamese. Return JSON with { winner: 'proposition' | 'opposition' | 'draw', verdict: string, summary: string }`;
      return await this.generateJSON(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(sessionData || {}) },
        ],
        0.4,
        this.getFallbackFinalVerdict(),
      );
    } catch (error) {
      console.error('AI finalVerdict error:', error);
      return this.getFallbackFinalVerdict();
    }
  }

  async analyzeFinalDebate(input: FinalDebateAIRequest): Promise<Record<string, unknown> | null> {
    const resultPolicy = input.judgeMode === 'ai'
      ? `You are the OFFICIAL AI judge. Score all six round-side entries, calculate both team totals,
and recommend proposition, opposition, or draw. The winner must follow the total score. Existing
AI turn verdicts are supporting context, not a substitute for reviewing the complete transcript.`
      : `Human judges are authoritative. Do NOT replace, recalculate, or challenge the official winner
(${input.officialWinner || 'pending'}). Use judge verdicts as evidence, explain where the transcript
supports their feedback, and provide advisory observations only.`;

    const systemPrompt = `You are a senior bilingual Vietnamese-English debate adjudicator analyzing a completed debate.
${resultPolicy}

The speech-to-text transcript is noisy. Correct only obvious recognition errors when the motion,
sentence context, speaker side, or repeated phrasing makes the intended wording clear. Never invent
claims, evidence, examples, or concessions that are absent. Lower transcriptConfidence when meaning
is uncertain, fragmented, duplicated, or missing. Evaluate the intended argument only when supported
by the captured words.

Scoring policy for every round and side:
- speechScore: integer 0-20.
- crossExamScore: integer 0-20 for rounds 1 and 2; exactly 0 for round 3.
- Each team total is the sum of its three speech scores and first two cross-exam scores (0-100).
- Base scores on argument relevance, reasoning, rebuttal, evidence use, responsiveness, strategy,
  and communication. Do not reward transcript length by itself.

Return valid JSON only with this exact top-level shape:
{
  "summary": "Vietnamese final summary",
  "keyClashes": ["..."],
  "transcriptQuality": {
    "overallConfidence": 0.0,
    "issues": ["..."],
    "notes": "Vietnamese note about ASR quality and conservative corrections"
  },
  "teams": {
    "proposition": { "score": 0, "keyArguments": ["..."], "strengths": ["..."], "weaknesses": ["..."] },
    "opposition": { "score": 0, "keyArguments": ["..."], "strengths": ["..."], "weaknesses": ["..."] }
  },
  "rounds": [
    {
      "round": 1,
      "proposition": {
        "speaker": "PRO_S1", "userId": "", "username": "", "speechScore": 0,
        "crossExamScore": 0, "transcriptConfidence": 0.0, "summary": "",
        "strengths": ["..."], "improvements": ["..."], "fallacies": ["..."]
      },
      "opposition": {
        "speaker": "OPP_S1", "userId": "", "username": "", "speechScore": 0,
        "crossExamScore": 0, "transcriptConfidence": 0.0, "summary": "",
        "strengths": ["..."], "improvements": ["..."], "fallacies": ["..."]
      }
    }
  ],
  "participants": [
    {
      "userId": "", "username": "", "team": "proposition", "transcriptConfidence": 0.0,
      "summary": "", "strengths": ["..."], "improvements": ["..."]
    }
  ],
  "judgeSynthesis": { "summary": "", "agreements": ["..."], "disagreements": ["..."] },
  "recommendedWinner": "proposition",
  "winnerReason": "Vietnamese explanation"
}

Include exactly rounds 1, 2, and 3. Preserve the provided userId, username, speaker, and team values.
For human-judge mode, recommendedWinner must equal the supplied officialWinner when it is available.`;

    return this.generateRequiredJSON<Record<string, unknown>>(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(input) },
      ],
      0.15,
    );
  }

  /**
   * Summarize entire debate.
   */
  async summarizeDebate(turnHistory: any[], motion: string) {
    try {
      const transcript = turnHistory
        .map((t) => `[${t.speaker}]: ${t.transcript}`)
        .join('\n\n');

      return await this.generateText(
        [
          {
            role: 'system',
            content: `Summarize this debate about "${motion}". Include: key clashes, strongest arguments from each side, and who was more persuasive overall. Write in Vietnamese.`,
          },
          { role: 'user', content: transcript },
        ],
        0.5,
        'Unable to generate summary.',
      );
    } catch {
      return 'AI summary unavailable. Please try again later.';
    }
  }

  /**
   * Check if content is toxic.
   */
  async checkToxic(content: string): Promise<{ isToxic: boolean; reason?: string }> {
    try {
      return await this.generateJSON(
        [
          {
            role: 'system',
            content: 'Check if this message is toxic, offensive, or spam in a debate context. Return JSON: { isToxic: boolean, reason: string | null }',
          },
          { role: 'user', content },
        ],
        0.1,
        { isToxic: false },
      );
    } catch {
      // Fail open: do not block messages if AI is down.
      return { isToxic: false };
    }
  }

  private async generateJSON<T>(messages: AIMessage[], temperature: number, fallback: T): Promise<T> {
    const content = await this.generateAIContent(messages, temperature, true);
    if (!content) return fallback;

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('AI JSON parse error:', error);
      return fallback;
    }
  }

  private async generateRequiredJSON<T>(messages: AIMessage[], temperature: number): Promise<T> {
    const content = await this.generateAIContent(messages, temperature, true);
    if (!content) {
      throw new AIProviderUnavailableError('AI Judge did not return any content');
    }

    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Expected a JSON object');
      }
      return parsed as T;
    } catch {
      throw new AIProviderUnavailableError('AI Judge returned invalid JSON');
    }
  }

  private async generateText(messages: AIMessage[], temperature: number, fallback: string) {
    const content = await this.generateAIContent(messages, temperature, false);
    return content || fallback;
  }

  private async generateAIContent(messages: AIMessage[], temperature: number, jsonMode: boolean) {
    // Agent workloads use their own key pool. GEMINI_API_KEY is reserved for
    // Gemini Live translation/STT so scoring cannot consume its quota.
    if (ENV.GEMINI_AGENT_API_KEYS.length) {
      try {
        return await this.generateGeminiContent(messages, temperature, jsonMode);
      } catch (error) {
        console.error('Gemini generation error:', error);
      }
    }

    if (openai) {
      try {
        return await this.generateOpenAIContent(messages, temperature, jsonMode);
      } catch (error) {
        console.error('OpenAI generation error:', error);
      }
    }

    return null;
  }

  private async generateOpenAIContent(messages: AIMessage[], temperature: number, jsonMode: boolean) {
    if (!openai) return null;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      temperature,
    });

    return response.choices[0]?.message?.content || null;
  }

  private async generateGeminiContent(messages: AIMessage[], temperature: number, jsonMode: boolean) {
    const systemText = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const userText = messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n\n');

    // AI Judge uses its own ordered key pool. When a key has exhausted its
    // quota, subsequent requests begin with the next key in the list.
    const apiKeys = ENV.GEMINI_AGENT_API_KEYS;
    let lastProviderError: Error | null = null;
    const startingKeyIndex = this.geminiAgentKeyIndex;

    for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
      const keyIndex = (startingKeyIndex + attempt) % apiKeys.length;
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ENV.GEMINI_AGENT_MODEL)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKeys[keyIndex],
            },
            signal: AbortSignal.timeout(ENV.GEMINI_AGENT_TIMEOUT_MS),
            body: JSON.stringify({
              systemInstruction: systemText
                ? {
                    parts: [{ text: systemText }],
                  }
                : undefined,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userText }],
                },
              ],
              generationConfig: {
                // Gemini 3.5+ deprecates sampling parameters and may reject them.
                ...(/^gemini-3\.[5-9]/.test(ENV.GEMINI_AGENT_MODEL) ? {} : { temperature }),
                maxOutputTokens: 8192,
                responseMimeType: jsonMode ? 'application/json' : 'text/plain',
              },
            }),
          },
        );
      } catch (error) {
        lastProviderError = error instanceof Error
          ? error
          : new Error('Gemini AI Judge network request failed');
        if (attempt < apiKeys.length - 1) {
          this.geminiAgentKeyIndex = (keyIndex + 1) % apiKeys.length;
          console.warn(`Gemini AI Judge request failed on key ${keyIndex + 1}/${apiKeys.length}; trying the next key.`);
          continue;
        }
        throw lastProviderError;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        const isRetryableKeyError =
          response.status === 401 ||
          response.status === 403 ||
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500 ||
          /RESOURCE_EXHAUSTED|quota/i.test(errorBody);

        if (!isRetryableKeyError) {
          throw new Error(`Gemini AI Judge request rejected with status ${response.status}`);
        }

        lastProviderError = new Error(`Gemini AI Judge request failed with status ${response.status}`);
        this.geminiAgentKeyIndex = (keyIndex + 1) % apiKeys.length;
        console.warn(`Gemini AI Judge key ${keyIndex + 1}/${apiKeys.length} was rejected (${response.status}); trying the next key.`);
        continue;
      }

      const payload = await response.json() as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      this.geminiAgentKeyIndex = keyIndex;
      return payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || null;
    }

    throw lastProviderError || new Error('No Gemini AI Judge API key is configured');
  }

  // --- Fallbacks ---

  private getFallbackAnalysis() {
    return {
      score: { logic: 0, rebuttal: 0, evidence: 0, crossExam: 0, strategy: 0, communication: 0, overall: 0 },
      strengths: ['AI analysis unavailable'],
      weaknesses: ['AI analysis unavailable'],
      fallacies: [],
      summary: 'AI analysis is currently unavailable. Please try again later.',
    };
  }

  private getFallbackScore() {
    return { logic: 0, rebuttal: 0, evidence: 0, crossExam: 0, strategy: 0, communication: 0, overall: 0 };
  }

  private getFallbackFinalVerdict() {
    return {
      winner: 'draw',
      verdict: 'AI final verdict unavailable. Please try again later.',
      summary: 'Khong the tao ket luan cuoi cung do AI tam thoi khong kha dung.',
    };
  }
}

export const aiService = new AIService();
