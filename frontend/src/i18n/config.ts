export const SUPPORTED_LANGUAGES = ['en', 'vi', 'ja'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'ai-debate-language';

export function isSupportedLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
