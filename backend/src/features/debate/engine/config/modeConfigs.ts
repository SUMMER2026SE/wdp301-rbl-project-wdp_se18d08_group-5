/**
 * modeConfigs.ts — định nghĩa 8 DebateModeConfig + helper để derive từ room settings.
 *
 * Tham chiếu quyết định:
 * - docs/Debate_Rule_Consolidated.md §0 (8 case matrix) + §1 (Captain S1) +
 *   §2 (Judge Human 1 vs nhiều) + §3 (No Host + AI consensus)
 * - docs/rule_host_judgeAI.md §15
 * - docs/rule_host_judgeHuman.md §14
 * - docs/rule_noHost_JudgeAI.md §13
 * - docs/rule_noHost_JudgeHuman.md §15
 *
 * Hard constraint: KHÔNG hard-code số giây ở đây — mọi hằng số thời gian
 * phải đọc từ duration.config.ts.
 */

import { DEBATE_DURATIONS } from './duration.config.js';
import type {
  DebateModeConfig,
  DebateModeId,
  JudgeType,
  RoomLike,
  TeamSize,
} from './types.js';

/**
 * Build 1 mode config — helper nội bộ để tránh lặp 8 lần.
 */
function buildModeConfig(params: {
  id: DebateModeId;
  hasHost: boolean;
  judgeType: JudgeType;
  teamSize: TeamSize;
}): DebateModeConfig {
  const { id, hasHost, judgeType, teamSize } = params;
  const isAi = judgeType === 'AI';
  const is1v1 = teamSize === '1v1';
  const isNoHostAi = !hasHost && isAi;

  // Controller: Host (có host), Judge S1 (noHost + human), Captain Consensus (noHost + AI)
  let controllerRole: DebateModeConfig['controllerRole'];
  if (hasHost) {
    controllerRole = 'HOST';
  } else if (isAi) {
    controllerRole = 'CAPTAIN_CONSENSUS';
  } else {
    controllerRole = 'JUDGE_S1';
  }

  // Phase transition: chỉ noHost_ai_* là AUTO_TIMED — xem rule_noHost_JudgeAI.md §9
  const phaseTransition: DebateModeConfig['phaseTransition'] = isNoHostAi
    ? 'AUTO_TIMED'
    : 'MANUAL';

  // Auto-transition delay — chỉ áp dụng khi AUTO_TIMED.
  // Luôn lấy từ duration.config để tránh magic number.
  const autoTransitionDelaySec = isNoHostAi
    ? DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS
    : 0;

  // Consensus rule chỉ áp dụng cho noHost_ai_*.
  // 1v1: BOTH_DEBATERS (chính 2 người chơi); 3v3: BOTH_CAPTAINS (2 S1 đại diện đội).
  const consensusRule: DebateModeConfig['consensusRule'] = isNoHostAi
    ? { role: is1v1 ? 'BOTH_DEBATERS' : 'BOTH_CAPTAINS' }
    : undefined;

  // Tie-break cho AI Judge (Consolidated §7 Open Point #4 chốt "split total").
  const aiTieBreak: DebateModeConfig['aiTieBreak'] = isAi
    ? 'SPLIT_TOTAL'
    : 'SPLIT_TOTAL'; // field bắt buộc, mode không dùng vẫn để SPLIT_TOTAL (default)

  return {
    id,
    hasHost,
    judgeType,
    teamSize,
    controllerRole,
    phaseTransition,
    autoTransitionDelaySec,
    rounds: {
      prep: true,
      speechCount: 3,
      crossExamRounds: is1v1 ? 1 : 2,
    },
    consensusRule,
    requiredParticipants: {
      debatersPerTeam: is1v1 ? 1 : 3,
      needsHost: hasHost,
      needsJudges: isAi ? 0 : 1,
    },
    aiTieBreak,
    judgeS1DisconnectBehavior: 'PAUSE_NO_HANDOFF',
  };
}

/**
 * Toàn bộ 8 DebateModeConfig — khoá theo DebateModeId.
 *
 * Comment mỗi entry trỏ tới file rule tương ứng.
 */
export const DEBATE_MODE_CONFIGS: Record<DebateModeId, DebateModeConfig> = {
  // rule_host_judgeAI.md §15 + Consolidated §0 (case 1) + §4.1
  host_ai_1v1: buildModeConfig({
    id: 'host_ai_1v1',
    hasHost: true,
    judgeType: 'AI',
    teamSize: '1v1',
  }),

  // rule_host_judgeAI.md §15 + Consolidated §0 (case 1) + §4.1
  host_ai_3v3: buildModeConfig({
    id: 'host_ai_3v3',
    hasHost: true,
    judgeType: 'AI',
    teamSize: '3v3',
  }),

  // rule_host_judgeHuman.md §14 + Consolidated §0 (case 2) + §4.1
  host_human_1v1: buildModeConfig({
    id: 'host_human_1v1',
    hasHost: true,
    judgeType: 'HUMAN_SINGLE',
    teamSize: '1v1',
  }),

  // rule_host_judgeHuman.md §14 + Consolidated §0 (case 2) + §4.1
  host_human_3v3: buildModeConfig({
    id: 'host_human_3v3',
    hasHost: true,
    judgeType: 'HUMAN_MULTI',
    teamSize: '3v3',
  }),

  // rule_noHost_JudgeAI.md §13 + Consolidated §0 (case 3) + §3 + §4.2
  noHost_ai_1v1: buildModeConfig({
    id: 'noHost_ai_1v1',
    hasHost: false,
    judgeType: 'AI',
    teamSize: '1v1',
  }),

  // rule_noHost_JudgeAI.md §13 + Consolidated §0 (case 4) + §3 + §4.2
  noHost_ai_3v3: buildModeConfig({
    id: 'noHost_ai_3v3',
    hasHost: false,
    judgeType: 'AI',
    teamSize: '3v3',
  }),

  // rule_noHost_JudgeHuman.md §15 + Consolidated §0 (case 5) + §2 + §4.3
  noHost_human_1v1: buildModeConfig({
    id: 'noHost_human_1v1',
    hasHost: false,
    judgeType: 'HUMAN_SINGLE',
    teamSize: '1v1',
  }),

  // rule_noHost_JudgeHuman.md §15 + Consolidated §0 (case 6) + §2 + §4.3
  noHost_human_3v3: buildModeConfig({
    id: 'noHost_human_3v3',
    hasHost: false,
    judgeType: 'HUMAN_MULTI',
    teamSize: '3v3',
  }),
};

/**
 * Derive DebateModeConfig từ DebateRoom settings.
 *
 * Validate tổ hợp — ném Error có thông điệp rõ ràng khi:
 * - judgeType='ai' nhưng judgeCount>0 (Judge Human trong mode AI)
 * - judgeType='human' nhưng judgeCount<1
 * - judgeCount=1 với hostType='human' (1 Judge Human + có Host vẫn ok,
 *   nhưng sẽ map sang HUMAN_SINGLE)
 */
export function getModeConfig(room: RoomLike): DebateModeConfig {
  const { format, hostType, judgeType, judgeCount } = room;

  const hasHost = hostType === 'human';
  const isAiJudge = judgeType === 'ai';

  if (judgeType === 'ai' && judgeCount > 0) {
    throw new Error(
      `[getModeConfig] judgeType='ai' không hợp lệ với judgeCount=${judgeCount} (Judge AI không phải người).`,
    );
  }
  if (judgeType === 'human' && judgeCount < 1) {
    throw new Error(
      `[getModeConfig] judgeType='human' yêu cầu judgeCount>=1, nhận ${judgeCount}.`,
    );
  }

  // Xác định JudgeType
  let judgeMode: JudgeType;
  if (isAiJudge) {
    judgeMode = 'AI';
  } else if (judgeCount === 1) {
    judgeMode = 'HUMAN_SINGLE';
  } else {
    judgeMode = 'HUMAN_MULTI';
  }

  // Map sang modeId
  const id: DebateModeId = hasHost
    ? isAiJudge
      ? format === '1v1'
        ? 'host_ai_1v1'
        : 'host_ai_3v3'
      : format === '1v1'
        ? 'host_human_1v1'
        : 'host_human_3v3'
    : isAiJudge
      ? format === '1v1'
        ? 'noHost_ai_1v1'
        : 'noHost_ai_3v3'
      : format === '1v1'
        ? 'noHost_human_1v1'
        : 'noHost_human_3v3';

  // Nếu judgeMode không khớp với modeId đã build sẵn → build lại cho khớp.
  const preset = DEBATE_MODE_CONFIGS[id];
  if (preset.judgeType === judgeMode) {
    return preset;
  }

  // Fallback: build lại với judgeMode đúng
  return buildModeConfig({
    id,
    hasHost,
    judgeType: judgeMode,
    teamSize: format,
  });
}

/**
 * Trả về danh sách 8 DebateModeId — dùng cho UI dropdown / validation.
 */
export function getAllModeIds(): DebateModeId[] {
  return Object.keys(DEBATE_MODE_CONFIGS) as DebateModeId[];
}
