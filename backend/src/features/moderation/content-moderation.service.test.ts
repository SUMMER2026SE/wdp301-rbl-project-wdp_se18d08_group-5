import { describe, expect, it } from 'vitest';
import {
  BLOCKED_CONTENT_PLACEHOLDER,
  detectLocalToxicContent,
  redactToxicContent,
} from './content-moderation.service.js';

describe('content moderation', () => {
  it('detects Vietnamese profanity with accents and punctuation', () => {
    const result = detectLocalToxicContent('Địt... mẹ mày');

    expect(result.isToxic).toBe(true);
    expect(result.source).toBe('local');
  });

  it('detects common English profanity', () => {
    expect(detectLocalToxicContent('What a fucking argument').isToxic).toBe(true);
  });

  it('detects profanity hidden behind separators', () => {
    expect(detectLocalToxicContent('d.u m.a').isToxic).toBe(true);
  });

  it('does not flag benign Vietnamese words after accent normalization', () => {
    expect(detectLocalToxicContent('Trường học lớn cần một chương trình tranh biện tốt.')).toEqual({
      isToxic: false,
      source: 'none',
    });
  });

  it('replaces toxic captions without exposing the original text', () => {
    const text = 'fuck you';

    expect(redactToxicContent(text)).toBe(BLOCKED_CONTENT_PLACEHOLDER);
    expect(redactToxicContent('A respectful argument')).toBe('A respectful argument');
  });
});
