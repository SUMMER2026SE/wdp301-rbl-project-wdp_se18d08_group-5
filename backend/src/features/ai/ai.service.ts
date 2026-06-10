import OpenAI from 'openai';
import { ENV } from '../../config/env.js';

const openai = ENV.OPENAI_API_KEY ? new OpenAI({ apiKey: ENV.OPENAI_API_KEY }) : null;

type AIMessage = {
  role: 'system' | 'user';
  content: string;
};

export class AIService {
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

  async judgeTurn(roomId: string, speaker: string, transcript: string, context: any) {
    try {
      const prompt = `You are an AI judge evaluating one debate turn for room ${roomId}. The speaker is ${speaker}. Use the transcript and context to provide a JSON result with { score: { logic: 0-30, rebuttal: 0-20, evidence: 0-15, crossExam: 0-15, strategy: 0-10, communication: 0-10, overall: 0-100 }, verdict: 'proposition' | 'opposition' | 'draw', comments: string, strengths: string[], weaknesses: string[], fallacies: { type: string, description: string }[], summary: string }`;
      return await this.generateJSON(
        [
          { role: 'system', content: prompt },
          { role: 'user', content: `${transcript}\n\nContext:\n${JSON.stringify(context || {})}` },
        ],
        0.3,
        this.getFallbackJudgeTurn(),
      );
    } catch (error) {
      console.error('AI judgeTurn error:', error);
      return this.getFallbackJudgeTurn();
    }
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

  private async generateText(messages: AIMessage[], temperature: number, fallback: string) {
    const content = await this.generateAIContent(messages, temperature, false);
    return content || fallback;
  }

  private async generateAIContent(messages: AIMessage[], temperature: number, jsonMode: boolean) {
    if (ENV.GEMINI_API_KEY) {
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${ENV.GEMINI_MODEL}:generateContent?key=${ENV.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            temperature,
            responseMimeType: jsonMode ? 'application/json' : 'text/plain',
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    return payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim() || null;
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

  private getFallbackJudgeTurn() {
    return {
      score: { logic: 0, rebuttal: 0, evidence: 0, crossExam: 0, strategy: 0, communication: 0, overall: 0 },
      verdict: 'draw',
      comments: 'AI judge unavailable. Please try again later.',
      strengths: ['AI judge unavailable'],
      weaknesses: ['AI judge unavailable'],
      fallacies: [],
      summary: 'AI judge is currently unavailable. Please try again later.',
    };
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
