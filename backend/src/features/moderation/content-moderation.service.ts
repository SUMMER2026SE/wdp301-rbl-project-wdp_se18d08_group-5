import { aiService } from '../ai/ai.service.js';

export const BLOCKED_CONTENT_PLACEHOLDER = '[Content hidden due to inappropriate language]';
export const BLOCKED_CONTENT_MESSAGE =
  'Your content was blocked because it contains offensive or inappropriate language.';

export type ModerationSource = 'none' | 'local' | 'ai';

export type ContentModerationResult = {
  isToxic: boolean;
  reason?: string;
  source: ModerationSource;
};

const HIGH_CONFIDENCE_PHRASES = [
  'dit me',
  'du ma',
  'con cac',
  'cai lon',
  'oc cho',
  'thang cho',
  'con cho',
  'fuck you',
  'mother fucker',
  'piece of shit',
  'son of a bitch',
];

const HIGH_CONFIDENCE_TOKENS = [
  'dm',
  'dmm',
  'cl',
  'clm',
  'vcl',
  'vkl',
  'fuck',
  'fucker',
  'fucking',
  'motherfucker',
  'asshole',
  'bitch',
  'bullshit',
];

const COMPACT_EVASION_TERMS = [
  'ditme',
  'duma',
  'concac',
  'cailon',
  'occho',
  'fuckyou',
  'motherfucker',
  'pieceofshit',
  'sonofabitch',
];

function normalizeForModeration(content: string): string {
  return content
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!]/g, 'i')
    .replace(/[$]/g, 's')
    .replace(/[3]/g, 'e')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function includesWholeToken(content: string, token: string): boolean {
  return ` ${content} `.includes(` ${token} `);
}

export function detectLocalToxicContent(content: string): ContentModerationResult {
  const normalized = normalizeForModeration(content);
  if (!normalized) return { isToxic: false, source: 'none' };

  if (HIGH_CONFIDENCE_PHRASES.some((phrase) => includesWholeToken(normalized, phrase))) {
    return {
      isToxic: true,
      reason: 'Detected offensive or inappropriate language.',
      source: 'local',
    };
  }

  if (HIGH_CONFIDENCE_TOKENS.some((token) => includesWholeToken(normalized, token))) {
    return {
      isToxic: true,
      reason: 'Detected offensive or inappropriate language.',
      source: 'local',
    };
  }

  const compact = normalized.replace(/\s+/g, '');
  if (COMPACT_EVASION_TERMS.some((term) => compact.includes(term))) {
    return {
      isToxic: true,
      reason: 'Detected obfuscated offensive language.',
      source: 'local',
    };
  }

  return { isToxic: false, source: 'none' };
}

export function redactToxicContent(
  content: string,
  moderation = detectLocalToxicContent(content),
): string {
  return moderation.isToxic ? BLOCKED_CONTENT_PLACEHOLDER : content;
}

export async function moderateTextContent(
  content: string,
  options: { useAI?: boolean; aiTimeoutMs?: number } = {},
): Promise<ContentModerationResult> {
  const localResult = detectLocalToxicContent(content);
  if (localResult.isToxic || !options.useAI) return localResult;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutResult = new Promise<{ isToxic: false }>((resolve) => {
      timeout = setTimeout(() => resolve({ isToxic: false }), options.aiTimeoutMs ?? 1800);
    });
    const aiResult = await Promise.race([aiService.checkToxic(content), timeoutResult]);

    if (aiResult.isToxic) {
      return {
        isToxic: true,
        reason: aiResult.reason || 'AI detected toxic, offensive, or spam content.',
        source: 'ai',
      };
    }
  } catch (error) {
    console.error('Contextual content moderation failed:', error);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  return { isToxic: false, source: 'none' };
}
