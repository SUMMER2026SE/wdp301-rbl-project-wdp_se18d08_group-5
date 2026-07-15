/**
 * adapter.ts — adapter layer giữa Debate Engine mới và code cũ trong
 * debate.service.ts.
 *
 * Vấn đề: debate.service.ts có 1504 dòng hard-coded (4 DEBATE_FLOW_* arrays,
 * permission checks inline, checkStartMatchParticipants với magic numbers).
 * Refactor in-place toàn bộ file quá rủi ro.
 *
 * Giải pháp: adapter này cung cấp các wrapper dùng engine mới nhưng giữ
 * signature cũ — debate.service.ts import từ đây, không cần đổi code xử lý
 * transition/DB/socket.
 *
 * Khi nào nên refactor sâu hơn: khi unit tests cho adapter đã ổn + integration
 * tests ổn → có thể migrate các method cũ sang dùng XState trực tiếp.
 */
import { DEBATE_MODE_CONFIGS } from './config/modeConfigs';
import { generateFlowFromMode, type FlowStep } from './state/flowGenerator';
import type {
  DebateModeConfig,
  DebateModeId,
  PermissionAction,
  TeamSize,
} from './config/types';
import { canPerform, deriveRole } from './config/permissionMatrix';

// ── Helpers ──────────────────────────────────────────────────────────

function resolveModeId(
  format?: string,
  hostType?: string,
  judgeType?: string,
): DebateModeId {
  const teamSize: TeamSize = format === '1v1' ? '1v1' : '3v3';
  const hasHost = hostType === 'human';
  const isAIJudge = judgeType === 'ai';

  let result: DebateModeId;
  if (hasHost) {
    if (isAIJudge) {
      result = teamSize === '1v1' ? 'host_ai_1v1' : 'host_ai_3v3';
    } else {
      result = teamSize === '1v1' ? 'host_human_1v1' : 'host_human_3v3';
    }
  } else if (isAIJudge) {
    result = teamSize === '1v1' ? 'noHost_ai_1v1' : 'noHost_ai_3v3';
  } else {
    result = teamSize === '1v1' ? 'noHost_human_1v1' : 'noHost_human_3v3';
  }
  return result;
}

function flowStepToLegacy(
  step: FlowStep,
  options?: { forceHostCanEndFalse?: boolean },
): LegacyDebateStep {
  return {
    speaker: step.speaker,
    phase: step.phase,
    timeLimit: step.durationSec,
    speakerCanEnd: step.speakerCanEnd,
    // Code cũ trong debate.service.ts dùng `hostCanEnd` để gate `endPhaseByHost`.
    // Cho noHost_* flow (cả AI và Human judge), code cũ set hostCanEnd = false cho
    // mọi step — permission "host có thể end" được check riêng bằng `isNoHostHumanJudge`
    // ở caller. Để giữ backward-compat, ta override về false cho noHost_*.
    hostCanEnd: options?.forceHostCanEndFalse
      ? false
      : step.controllerCanEnd,
    ce: step.ceConfig
      ? {
          askingTeam: step.ceConfig.askingTeam,
          answeringTeam:
            step.ceConfig.askingTeam === 'proposition'
              ? 'opposition'
              : 'proposition',
          quotaPerTeam: step.ceConfig.quotaPerTeam,
          questionsAsked: 0,
          currentRole: 'asker' as const,
        }
      : undefined,
  };
}

// ── Types (backward-compat) ─────────────────────────────────────────

export interface LegacyDebateStep {
  speaker: string;
  phase: string;
  timeLimit: number;
  speakerCanEnd: boolean;
  hostCanEnd: boolean;
  ce?: {
    askingTeam: 'proposition' | 'opposition';
    answeringTeam: 'proposition' | 'opposition';
    quotaPerTeam: number;
    questionsAsked: number;
    currentRole: 'asker' | 'answerer';
  };
}

export interface LegacyStartCheck {
  ready: boolean;
  reason?: string;
  counts?: {
    currentDebaters: number;
    currentHost: number;
    currentJudges: number;
    debaterCount: number;
    hasHost: boolean;
    requiredJudges: number;
  };
}

// ── Public API cho debate.service.ts ─────────────────────────────────

/**
 * Wrapper thay thế `getFlow(format, hostType)` cũ.
 *
 * Code cũ trả 4 flow arrays, code mới trả theo `format` + `hostType`
 * + `judgeType`. Vì code cũ không phân biệt judge type ở level flow (chỉ
 * phân biệt ở permission), ta default `judgeType` về 'human' để giữ
 * behavior cũ cho host_*, và 'ai' cho noHost_*. Khi cần phân biệt rõ,
 * truyền `judgeType` explicit.
 */
export function getFlowAdapter(
  format?: '1v1' | '3v3',
  hostType?: 'human' | 'ai',
  judgeType?: 'human' | 'ai',
): LegacyDebateStep[] {
  const resolvedJudgeType =
    judgeType ?? (hostType === 'ai' ? 'ai' : 'human');
  const modeId = resolveModeId(format, hostType, resolvedJudgeType);
  const mode = DEBATE_MODE_CONFIGS[modeId];
  const flow = generateFlowFromMode(mode);
  // noHost_* mode cần force hostCanEnd=false cho backward-compat với code cũ
  // (caller check `isNoHostHumanJudge` riêng cho Judge S1 permission)
  const forceHostCanEndFalse = !mode.hasHost;
  return flow.map((s) =>
    flowStepToLegacy(s, { forceHostCanEndFalse }),
  );
}

/**
 * Wrapper thay thế `checkStartMatchParticipants` cũ.
 *
 * Dùng `requiredParticipants` từ DebateModeConfig thay vì magic numbers
 * inline (debaterCount=is1v1?2:6, requiredJudges=isAIJudge?0:room.judgeCount).
 */
export function checkStartMatchParticipantsAdapter(room: {
  format?: string;
  hostType?: string;
  judgeType?: string;
  judgeCount?: number;
  participants?: Array<{
    userId?: { toString(): string } | string;
    username?: string;
    roomRole?: string;
    primaryRole?: string;
    team?: string;
    speakerSlot?: string;
  }>;
}): LegacyStartCheck {
  const modeId = resolveModeId(room.format, room.hostType, room.judgeType);
  const mode = DEBATE_MODE_CONFIGS[modeId];
  const req = mode.requiredParticipants;

  const debaterCount = req.debatersPerTeam * 2; // 2 đội
  const hasHost = req.needsHost;
  const requiredJudges = req.needsJudges;

  const participants = room.participants || [];
  let currentDebaters = 0;
  let currentHost = 0;
  let currentJudges = 0;
  const debatersWithoutPosition: string[] = [];

  for (const p of participants) {
    // Code cũ: owner → primaryRole, ngược lại → roomRole
    const role = p.roomRole === 'owner' ? p.primaryRole : p.roomRole;
    if (role === 'debater') {
      if (p.team && p.speakerSlot) {
        currentDebaters += 1;
      } else {
        const id = p.userId?.toString() || p.username || 'unknown';
        debatersWithoutPosition.push(id);
      }
    } else if (role === 'host') {
      currentHost += 1;
    } else if (role === 'judge') {
      currentJudges += 1;
    }
  }

  const missingDebaters = Math.max(0, debaterCount - currentDebaters);
  const missingHost = hasHost ? Math.max(0, 1 - currentHost) : 0;
  const missingJudges = Math.max(0, requiredJudges - currentJudges);

  if (missingDebaters > 0 || missingHost > 0 || missingJudges > 0) {
    const reasons: string[] = [];
    if (missingDebaters > 0) {
      reasons.push(
        `need ${missingDebaters} more debater(s) (${currentDebaters}/${debaterCount})`,
      );
    }
    if (missingHost > 0) reasons.push(`need a Host (${currentHost}/1)`);
    if (missingJudges > 0) {
      reasons.push(
        `need ${missingJudges} more judge(s) (${currentJudges}/${requiredJudges})`,
      );
    }
    return {
      ready: false,
      reason: `Cannot start: ${reasons.join(', ')}.`,
      counts: {
        currentDebaters,
        currentHost,
        currentJudges,
        debaterCount,
        hasHost,
        requiredJudges,
      },
    };
  }

  if (debatersWithoutPosition.length > 0) {
    return {
      ready: false,
      reason: `Debater(s) without team/slot: ${debatersWithoutPosition.join(', ')}`,
      counts: {
        currentDebaters,
        currentHost,
        currentJudges,
        debaterCount,
        hasHost,
        requiredJudges,
      },
    };
  }

  return {
    ready: true,
    counts: {
      currentDebaters,
      currentHost,
      currentJudges,
      debaterCount,
      hasHost,
      requiredJudges,
    },
  };
}

/**
 * Wrapper permission check — thay thế inline check `effectiveRole === 'host'`
 * và `currentStep.hostCanEnd` trong debate.service.ts.
 *
 * Lưu ý: `canPerform` thực tế trong engine nhận (role, action, modeId), không
 * nhận descriptor. Adapter này derive role rồi gọi canPerform.
 */
export function canPerformAdapter(
  participant: {
    userId?: string;
    roomRole?: string;
    primaryRole?: string;
    team?: string;
    speakerSlot?: string;
    isHost?: boolean;
    hasControlPanel?: boolean;
  },
  action: PermissionAction,
  roomContext: {
    format?: string;
    hostType?: string;
    judgeType?: string;
    judgeCount?: number;
  },
): boolean {
  const modeId = resolveModeId(
    roomContext.format,
    roomContext.hostType,
    roomContext.judgeType,
  );

  const effectiveRole = deriveRole({
    roomRole: participant.roomRole as never,
    primaryRole: participant.primaryRole as never,
    team: participant.team as 'proposition' | 'opposition',
    speakerSlot: participant.speakerSlot as 'S1' | 'S2' | 'S3',
    hasControlPanel: participant.hasControlPanel,
  });

  return canPerform(effectiveRole, action, modeId);
}

/**
 * Helper export engine config cho debug/observability.
 */
export function getModeConfigForRoom(room: {
  format?: string;
  hostType?: string;
  judgeType?: string;
}): DebateModeConfig {
  const modeId = resolveModeId(room.format, room.hostType, room.judgeType);
  return DEBATE_MODE_CONFIGS[modeId];
}

export { DEBATE_MODE_CONFIGS };