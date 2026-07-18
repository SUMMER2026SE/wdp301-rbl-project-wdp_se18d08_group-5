/**
 * flowGenerator.ts — sinh ra flow array (danh sách step) từ DebateModeConfig.
 *
 * Theo Consolidated §5 + rule files §13-15, cấu trúc flow luôn là:
 *   MOTION → PREP → R1 (PRO_S1, OPP_S1, CE_1, JUDGE_FB_1) → R2 (OPP_S2, PRO_S2, CE_2, JUDGE_FB_2) →
 *   R3 (PRO_S3, OPP_S3, JUDGE_FB_3) → COMPLETED
 *
 * Lưu ý: R2 đặc biệt — OPP_S2 đi trước PRO_S2 (thay vì PRO trước OPP như R1/R3).
 * Phase `final_judging` đã được bỏ khỏi flow.
 */

import { DEBATE_DURATIONS } from '../config/duration.config';
import type { DebateModeConfig, Phase, Team } from '../config/types';

export interface FlowStep {
  index: number;
  speaker: string; // 'PRO_S1', 'OPP_S2', 'CE_ROUND_1', 'JUDGES_FB_1', 'BOTH_TEAMS_PREP', 'HOST', 'COMPLETED'
  phase: Phase;
  durationSec: number;
  speakerCanEnd: boolean;
  controllerCanEnd: boolean;
  /** CE: ai hỏi, ai trả lời */
  ceConfig?: {
    askingTeam: Team;
    quotaPerTeam: number;
  };
}

/**
 * Build label "PRO_S1" / "OPP_S2" / "CE_ROUND_1" / "JUDGES_FB_1" — internal format.
 */
function propSpeaker(slot: 1 | 2 | 3): string {
  return `PRO_S${slot}`;
}

function oppSpeaker(slot: 1 | 2 | 3): string {
  return `OPP_S${slot}`;
}

function ceSpeaker(round: 1 | 2): string {
  return `CE_ROUND_${round}`;
}

function judgeFbSpeaker(round: 1 | 2 | 3): string {
  return `JUDGES_FB_${round}`;
}

/**
 * Sinh flow steps cho 1 mode. Khác biệt:
 * - 1v1: chỉ 1 CE round (mode.rounds.crossExamRounds = 1)
 * - 3v3: 2 CE round (mode.rounds.crossExamRounds = 2)
 */
export function generateFlowFromMode(mode: DebateModeConfig): FlowStep[] {
  const steps: FlowStep[] = [];
  let idx = 0;

  // 0. Motion announcement (Host đọc đề tài)
  steps.push({
    index: idx++,
    speaker: 'HOST',
    phase: 'motion',
    durationSec: 0,
    speakerCanEnd: false,
    controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
  });

  // 1. Preparation (Prep 7 phút)
  steps.push({
    index: idx++,
    speaker: 'BOTH_TEAMS_PREP',
    phase: 'prep_7',
    durationSec: DEBATE_DURATIONS.PREPARATION_SECONDS,
    speakerCanEnd: false,
    controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
  });

  // Loop qua 3 rounds
  for (let round = 1 as 1 | 2 | 3; round <= 3; round++) {
    // Round 2 order: OPP S2 → PROP S2 (per requirement: "Round 2: Opponent Speaker 2 then Proposition Speaker 2")
    // All other rounds: PROP → OPP
    const isRound2 = round === 2;
    if (isRound2) {
      steps.push({
        index: idx++,
        speaker: oppSpeaker(round),
        phase: 'speech',
        durationSec: DEBATE_DURATIONS.SPEECH_SECONDS,
        speakerCanEnd: true,
        controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
      });
      steps.push({
        index: idx++,
        speaker: propSpeaker(round),
        phase: 'speech',
        durationSec: DEBATE_DURATIONS.SPEECH_SECONDS,
        speakerCanEnd: true,
        controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
      });
    } else {
      // R1 and R3: PROP → OPP
      steps.push({
        index: idx++,
        speaker: propSpeaker(round),
        phase: 'speech',
        durationSec: DEBATE_DURATIONS.SPEECH_SECONDS,
        speakerCanEnd: true,
        controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
      });
      steps.push({
        index: idx++,
        speaker: oppSpeaker(round),
        phase: 'speech',
        durationSec: DEBATE_DURATIONS.SPEECH_SECONDS,
        speakerCanEnd: true,
        controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
      });
    }

    // CE chỉ ở Round 1 & 2 (theo rule §13-15)
    const isCE = round === 1 || round === 2;
    if (isCE && mode.rounds.crossExamRounds >= round) {
      // CE Round N: asking team thay đổi theo round để đảm bảo cân bằng
      const askingTeam: Team = round === 1 ? 'proposition' : 'opposition';
      // round ở đây luôn là 1 hoặc 2 (đã check isCE)
      const ceRound = round as 1 | 2;
      steps.push({
        index: idx++,
        speaker: ceSpeaker(ceRound),
        phase: 'cross_exam',
        durationSec: DEBATE_DURATIONS.CROSS_EXAMINATION_SECONDS,
        speakerCanEnd: false,
        controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
        ceConfig: { askingTeam, quotaPerTeam: 2 },
      });
    }

    // Judge Feedback sau mỗi round (kể cả Round 3 để Judge submit điểm R3)
    steps.push({
      index: idx++,
      speaker: judgeFbSpeaker(round),
      phase: 'judge_feedback',
      durationSec: 0, // free time, không countdown
      speakerCanEnd: false,
      controllerCanEnd: mode.hasHost || mode.controllerRole === 'JUDGE_S1',
    });
  }

  // Completed Phase for Host + Human Judge
  // NOTE: COMPLETE_REVIEW step removed per requirement. host_human_* mode
  // transitions directly from JUDGES_FB_3 → COMPLETED when Host presses End Match.
  // The Host stays in JUDGE_FEEDBACK phase until they click End — no intermediate
  // "Review" step exists. Only the COMPLETED step remains (index 0, terminal).

  // Completed (sau Judge Feedback round 3 — KHÔNG có bước FINAL_JUDGING riêng)
  steps.push({
    index: idx++,
    speaker: 'COMPLETED',
    phase: 'completed',
    durationSec: 0,
    speakerCanEnd: false,
    controllerCanEnd: false,
  });

  return steps;
}

/**
 * Tìm step hiện tại theo speaker + phase.
 */
export function findStepIndex(steps: FlowStep[], speaker: string, phase: Phase): number {
  return steps.findIndex((s) => s.speaker === speaker && s.phase === phase);
}