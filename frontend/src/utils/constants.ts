// Debate timing constants (seconds) — match 01_Debate_Rule.md
import i18n from '@/i18n';

export const TIMER = {
  PREP_INITIAL: 7 * 60, // 7 minutes
  SPEECH: 4 * 60, // 4 minutes
  CROSS_EXAM_PER_TEAM: 3 * 60, // 3 minutes per team
  JUDGE_FEEDBACK: 5 * 60, // 3-5 minutes (max 5)
  PREP_BETWEEN: 1 * 60, // 1 minute
} as const;

// Cross Examination limits
export const CE = {
  MAX_QUESTIONS_PER_TEAM: 2,
} as const;

// Scoring criteria (01_Debate_Rule §13)
export function getScoreCriteria() {
  return [
    { key: 'logic', label: i18n.t('debate.criteria.logic', { ns: 'common' }), max: 30 },
    { key: 'rebuttal', label: i18n.t('debate.criteria.rebuttal', { ns: 'common' }), max: 20 },
    { key: 'evidence', label: i18n.t('debate.criteria.evidence', { ns: 'common' }), max: 15 },
    { key: 'crossExam', label: i18n.t('debate.criteria.crossExam', { ns: 'common' }), max: 15 },
    { key: 'strategy', label: i18n.t('debate.criteria.strategy', { ns: 'common' }), max: 10 },
    { key: 'communication', label: i18n.t('debate.criteria.communication', { ns: 'common' }), max: 10 },
  ] as const;
}

export const SCORE_CRITERIA = getScoreCriteria();

// Speaker turn order (3v3)
export const TURN_ORDER = [
  'PRO_S1',
  'OPP_S1',
  'PRO_S2',
  'OPP_S2',
  'PRO_S3',
  'OPP_S3',
] as const;
