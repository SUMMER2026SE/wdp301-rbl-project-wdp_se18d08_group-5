import { format, formatDistanceToNow } from 'date-fns';
import { enUS, ja, vi } from 'date-fns/locale';
import i18n from '@/i18n';
import { DEFAULT_LANGUAGE, isSupportedLanguage, type AppLanguage } from '@/i18n/config';
import type { RankTier, DebatePhase, SpeakerTurn } from '@/types';

const dateLocales = {
  en: enUS,
  vi,
  ja,
} as const;

function getCurrentLanguage(): AppLanguage {
  return isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

/**
 * Format seconds to mm:ss
 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format date with current app locale
 */
export function formatDate(date: string): string {
  const language = getCurrentLanguage();
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: dateLocales[language] });
}

/**
 * Relative time
 */
export function formatRelativeTime(date: string): string {
  const language = getCurrentLanguage();
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: dateLocales[language] });
}

/**
 * Rank tier display name
 */
export function getTierDisplay(tier: RankTier): { label: string; color: string } {
  const map: Record<RankTier, { label: string; color: string }> = {
    Novice: { label: i18n.t('tiers.novice', { ns: 'profile' }), color: '#6b7280' },
    Debater: { label: i18n.t('tiers.debater', { ns: 'profile' }), color: '#22c55e' },
    Advanced: { label: i18n.t('tiers.advanced', { ns: 'profile' }), color: '#3b82f6' },
    Expert: { label: i18n.t('tiers.expert', { ns: 'profile' }), color: '#8b5cf6' },
    Master: { label: i18n.t('tiers.master', { ns: 'profile' }), color: '#f59e0b' },
    GrandMaster: { label: i18n.t('tiers.grandMaster', { ns: 'profile' }), color: '#ef4444' },
  };
  return map[tier];
}

/**
 * Phase display name
 */
export function getPhaseDisplay(phase: DebatePhase): string {
  const map: Record<DebatePhase, string> = {
    motion: i18n.t('debate.phases.motion', { ns: 'common' }),
    prep_7: i18n.t('debate.phases.prep7', { ns: 'common' }),
    speech: i18n.t('debate.phases.speech', { ns: 'common' }),
    cross_exam: i18n.t('debate.phases.crossExam', { ns: 'common' }),
    judge_feedback: i18n.t('debate.phases.judgeFeedback', { ns: 'common' }),
    prep_1: i18n.t('debate.phases.prep1', { ns: 'common' }),
    closing: i18n.t('debate.phases.closing', { ns: 'common' }),
    final_judging: i18n.t('debate.phases.finalJudging', { ns: 'common' }),
    completed: i18n.t('debate.phases.completed', { ns: 'common' }),
  };
  return map[phase];
}

/**
 * Speaker turn display
 */
export function getSpeakerDisplay(turn: SpeakerTurn): string {
  const map: Record<SpeakerTurn, string> = {
    PRO_S1: i18n.t('debate.speakers.pro1', { ns: 'common' }),
    OPP_S1: i18n.t('debate.speakers.opp1', { ns: 'common' }),
    PRO_S2: i18n.t('debate.speakers.pro2', { ns: 'common' }),
    OPP_S2: i18n.t('debate.speakers.opp2', { ns: 'common' }),
    PRO_S3: i18n.t('debate.speakers.pro3', { ns: 'common' }),
    OPP_S3: i18n.t('debate.speakers.opp3', { ns: 'common' }),
  };
  return map[turn];
}
