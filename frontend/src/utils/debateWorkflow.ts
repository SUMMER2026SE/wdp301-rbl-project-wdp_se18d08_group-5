import type { SpeakerTurn } from '@/types';

export type WorkflowPhase =
  | 'motion'
  | 'prep_7'
  | 'speech'
  | 'cross_exam'
  | 'judge_feedback'
  | 'final_judging'
  | 'completed';

export interface DebateWorkflowStep {
  speaker: SpeakerTurn | 'HOST' | 'BOTH_TEAMS_PREP' | 'CE_ROUND_1' | 'CE_ROUND_2' | 'CE_ROUND_3' | 'CE_ROUND_4' | 'JUDGES_FB_1' | 'JUDGES_FB_2' | 'JUDGES' | 'COMPLETED';
  phase: WorkflowPhase;
  label: string;
  detail: string;
}

export const debateWorkflow: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Host announces the topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation time' },
  { speaker: 'PRO_S1', phase: 'speech', label: 'Pro S1', detail: 'Opening constructive speech' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Pro questions Opp (2 min)' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp S1', detail: 'Opening opposition speech' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Opp questions Pro (2 min)' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Judges review Round 1' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Pro S2', detail: 'Extension and rebuttal' },
  { speaker: 'CE_ROUND_3', phase: 'cross_exam', label: 'CE 3', detail: 'Pro questions Opp (2 min)' },
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp S2', detail: 'Extension and rebuttal' },
  { speaker: 'CE_ROUND_4', phase: 'cross_exam', label: 'CE 4', detail: 'Opp questions Pro (2 min)' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Judges review Round 2' },
  { speaker: 'PRO_S3', phase: 'speech', label: 'Pro S3', detail: 'Final speaker summary (3v3)' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp S3', detail: 'Final speaker summary (3v3)' },
  { speaker: 'JUDGES', phase: 'final_judging', label: 'Final Judging', detail: 'Judges submit final decision' },
  { speaker: 'COMPLETED', phase: 'completed', label: 'Completed', detail: 'Result is announced' },
];

export function isWorkflowStepActive(
  step: DebateWorkflowStep,
  currentPhase: string | null | undefined,
  currentSpeaker: string | null | undefined,
): boolean {
  if (!currentPhase) return false;
  if (step.phase !== currentPhase) return false;

  if (currentPhase === 'speech') {
    return step.speaker === currentSpeaker;
  }

  if (currentPhase === 'cross_exam') {
    if (!currentSpeaker) return true;
    return step.speaker === currentSpeaker;
  }

  return true;
}
