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
  speaker: SpeakerTurn | 'HOST' | 'BOTH_TEAMS_PREP' | 'CE_ROUND_1' | 'CE_ROUND_2' | 'CE_ROUND_3' | 'CE_ROUND_4' | 'JUDGES_FB_1' | 'JUDGES_FB_2' | 'JUDGES_FB_3' | 'JUDGES' | 'COMPLETED';
  phase: WorkflowPhase;
  label: string;
  detail: string;
}

export const debateWorkflow: DebateWorkflowStep[] = [
  { speaker: 'HOST', phase: 'motion', label: 'Motion', detail: 'Host announces the topic' },
  { speaker: 'BOTH_TEAMS_PREP', phase: 'prep_7', label: 'Prep', detail: '7 minute preparation time' },
  // Round 1
  { speaker: 'PRO_S1', phase: 'speech', label: 'Prop 1', detail: 'Proposition first speech' },
  { speaker: 'OPP_S1', phase: 'speech', label: 'Opp 1', detail: 'Opposition first speech' },
  { speaker: 'CE_ROUND_1', phase: 'cross_exam', label: 'CE 1', detail: 'Cross‑exam round 1' },
  { speaker: 'JUDGES_FB_1', phase: 'judge_feedback', label: 'Judge FB 1', detail: 'Judges review round 1' },
  // Round 2 (Opp first)
  { speaker: 'OPP_S2', phase: 'speech', label: 'Opp 2', detail: 'Opposition second speech' },
  { speaker: 'PRO_S2', phase: 'speech', label: 'Prop 2', detail: 'Proposition second speech' },
  { speaker: 'CE_ROUND_2', phase: 'cross_exam', label: 'CE 2', detail: 'Cross‑exam round 2' },
  { speaker: 'JUDGES_FB_2', phase: 'judge_feedback', label: 'Judge FB 2', detail: 'Judges review round 2' },
  // Round 3 (Proposition first, no CE) per requirement: Prop→Opp
  { speaker: 'PRO_S3', phase: 'speech', label: 'Prop 3', detail: 'Proposition final speech' },
  { speaker: 'OPP_S3', phase: 'speech', label: 'Opp 3', detail: 'Opposition final speech' },
  { speaker: 'JUDGES_FB_3', phase: 'judge_feedback', label: 'Judge FB 3', detail: 'Judges review final round' },
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
