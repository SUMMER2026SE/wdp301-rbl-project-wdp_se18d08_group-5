import OpenAI from 'openai';
import { ENV } from '../../config/env.js';

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export class AIService {
  /**
   * Analyze a speech — claims, strengths, weaknesses, fallacies, score.
   */
  async analyzeSpeech(speech: string, motion: string, team: string, speakerSlot: string) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert debate judge. Analyze the following speech in a debate about "${motion}". 
The speaker is on the ${team} side, speaking as ${speakerSlot}.
Return JSON with: { score: { logic (0-30), rebuttal (0-20), evidence (0-15), crossExam (0-15), strategy (0-10), communication (0-10), overall (0-100) }, strengths: [string], weaknesses: [string], fallacies: [{ type, description }], summary: string }`,
          },
          { role: 'user', content: speech },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : this.getFallbackAnalysis();
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
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Score this debate argument about "${motion}". Return JSON: { logic: 0-30, rebuttal: 0-20, evidence: 0-15, crossExam: 0-15, strategy: 0-10, communication: 0-10, overall: 0-100 }`,
          },
          { role: 'user', content: speech },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      return content ? JSON.parse(content) : this.getFallbackScore();
    } catch {
      return this.getFallbackScore();
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

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Summarize this debate about "${motion}". Include: key clashes, strongest arguments from each side, and who was more persuasive overall. Write in Vietnamese.`,
          },
          { role: 'user', content: transcript },
        ],
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content || 'Unable to generate summary.';
    } catch {
      return 'AI summary unavailable. Please try again later.';
    }
  }

  /**
   * Check if content is toxic.
   */
  async checkToxic(content: string): Promise<{ isToxic: boolean; reason?: string }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'Check if this message is toxic, offensive, or spam in a debate context. Return JSON: { isToxic: boolean, reason: string | null }',
          },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const result = response.choices[0]?.message?.content;
      return result ? JSON.parse(result) : { isToxic: false };
    } catch {
      // Fail open — don't block messages if AI is down
      return { isToxic: false };
    }
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
}

export const aiService = new AIService();
