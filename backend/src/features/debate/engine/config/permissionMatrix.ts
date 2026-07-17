/**
 * permissionMatrix.ts — Map (role × modeId) → tập PermissionAction cho phép.
 *
 * Quyết định từ:
 * - docs/Debate_Rule_Consolidated.md §4.1 (Host mode) + §4.2 (No Host + AI)
 *   + §4.3 (No Host + Human)
 * - docs/rule_host_judgeAI.md §5-§8
 * - docs/rule_host_judgeHuman.md §4-§7
 * - docs/rule_noHost_JudgeAI.md §5 + §7
 * - docs/rule_noHost_JudgeHuman.md §5-§8
 *
 * Triết lý:
 * - Mỗi role chỉ "tồn tại" trong các mode hợp lệ. Ví dụ `host` chỉ có
 *   permission trong host_*; `judge_s1` chỉ trong noHost_human_*;
 *   `judge` chỉ trong HUMAN_MULTI.
 * - Captain/Debater có permission trong tất cả 8 modes (họ luôn tham gia).
 * - Viewer có permission trong tất cả 8 modes.
 *
 * Mọi gate ở handler phải gọi canPerform() trước khi thực thi action.
 * KHÔNG hard-code role check trong handler.
 */

import type {
  DebateModeConfig,
  DebateModeId,
  ParticipantDescriptor,
  PermissionAction,
  Role,
} from './types.js';

/**
 * Một số action luôn có cho debater/judge/captain (không phụ thuộc mode):
 *
 * - Mọi debater/captain/judge (không phải viewer): toggle mic + camera
 * - Viewer: KHÔNG toggle mic — chỉ được phát biểu khi được Grant
 *
 * Lưu ý: chính sách phát biểu của viewer (chỉ khi grant_viewer_speaking)
 * được enforce riêng ở media handler.
 */
const ALWAYS_FOR_PARTICIPANT: PermissionAction[] = [
  'toggle_mic',
  'toggle_camera',
];

/**
 * Build permission set cho Host — Consolidated §4.1 cột Host.
 *
 * Host có mọi quyền điều phối + vào mọi Private Room.
 * Host không chấm điểm / feedback (đó là việc của Judge).
 * Host có thể send_chat_debate và send_chat_private.
 */
function permissionsForHost(): Set<PermissionAction> {
  return new Set<PermissionAction>([
    // Điều phối phase / timer
    'start_phase',
    'skip_phase',
    'pause_timer',
    'resume_timer',
    'end_match',
    // Điều phối participant
    'mute_participant',
    'enable_chat',
    'grant_viewer_speaking',
    // Vào mọi Private Room
    'enter_prop_room',
    'enter_opp_room',
    'enter_judge_room',
    // Chat
    'send_chat_debate',
    'send_chat_private',
    // Media
    ...ALWAYS_FOR_PARTICIPANT,
  ]);
}

/**
 * Build permission set cho Judge S1 — Consolidated §4.3 cột "Judge S1".
 *
 * Judge S1 = Host thay thế + vẫn giữ quyền Judge.
 * Chỉ có ở noHost_human_* (không có host_* vì Host giữ vai trò điều phối).
 */
function permissionsForJudgeS1(): Set<PermissionAction> {
  return new Set<PermissionAction>([
    // Điều phối phase / timer (thay Host)
    'start_phase',
    'skip_phase',
    'pause_timer',
    'resume_timer',
    'end_match',
    // Điều phối participant
    'mute_participant',
    'enable_chat',
    'grant_viewer_speaking',
    // Vào mọi Private Room
    'enter_prop_room',
    'enter_opp_room',
    'enter_judge_room',
    // Judge-specific
    'submit_score',
    'submit_feedback',
    'send_reaction',
    // Chat
    'send_chat_debate',
    'send_chat_private',
    // Media
    ...ALWAYS_FOR_PARTICIPANT,
  ]);
}

/**
 * Build permission set cho Judge thường (không phải S1) — Consolidated §4.3 cột "Judge khác".
 *
 * Judge thường:
 * - Có đủ quyền Judge (chấm điểm / feedback / reaction / submit_score)
 * - Chỉ vào Judge Room
 * - KHÔNG điều phối phase / timer / mute
 */
function permissionsForJudge(): Set<PermissionAction> {
  return new Set<PermissionAction>([
    'enter_judge_room',
    'submit_score',
    'submit_feedback',
    'send_reaction',
    'send_chat_debate',
    'send_chat_private',
    ...ALWAYS_FOR_PARTICIPANT,
  ]);
}

/**
 * Build permission set cho Captain (S1 của 1 đội) — Consolidated §1 + §4.1 cột "S1/Captain".
 *
 * Captain:
 * - Skip lượt nói của mình (skip_phase khi đến lượt — engine gate bằng currentSpeaker)
 * - Skip Prep/CE đại diện đội (skip_consensus_phase)
 * - Surrender / Request Draw / Accept Draw
 * - Vào Private Room đội mình
 * - Start match (chỉ noHost_ai_*) — được thêm ở modeSpecificActions
 */
function permissionsForCaptain(team: 'proposition' | 'opposition'): Set<PermissionAction> {
  const enterRoom: PermissionAction =
    team === 'proposition' ? 'enter_prop_room' : 'enter_opp_room';
  return new Set<PermissionAction>([
    'skip_phase',
    'skip_consensus_phase',
    'surrender',
    'request_draw',
    'accept_draw',
    enterRoom,
    'send_chat_debate',
    'send_chat_private',
    ...ALWAYS_FOR_PARTICIPANT,
  ]);
}

/**
 * Build permission set cho Debater (S2/S3) — Consolidated §1 + §4.1 cột "S2/S3".
 *
 * Debater thường:
 * - Skip lượt nói của chính mình (skip_phase khi đến lượt)
 * - Vào Private Room đội mình
 * - KHÔNG skip_consensus_phase (chỉ Captain)
 * - KHÔNG Surrender/Draw (Captain đại diện đội)
 */
function permissionsForDebater(team: 'proposition' | 'opposition'): Set<PermissionAction> {
  const enterRoom: PermissionAction =
    team === 'proposition' ? 'enter_prop_room' : 'enter_opp_room';
  return new Set<PermissionAction>([
    'skip_phase',
    enterRoom,
    'send_chat_debate',
    'send_chat_private',
    ...ALWAYS_FOR_PARTICIPANT,
  ]);
}

/**
 * Permission set cho Viewer — Consolidated §4.1 + §4.2 + §4.3 cột Viewer.
 *
 * Viewer:
 * - Chỉ send_chat_viewer
 * - Có thể toggle camera (xem) — KHÔNG toggle mic
 *   (mic chỉ bật khi Host/Judge S1 cấp grant_viewer_speaking)
 *
 * Theo rule: "Viewer không được bật microphone. Trừ khi Host cấp quyền nói."
 * → không thêm 'toggle_mic' mặc định; việc bật mic phải qua grant_viewer_speaking.
 */
function permissionsForViewer(): Set<PermissionAction> {
  return new Set<PermissionAction>(['send_chat_viewer', 'toggle_camera']);
}

/**
 * Vai trò có tồn tại trong mode này không — dùng để lọc permission
 * của những role không hợp lệ trong mode (tránh cấp quyền "host" cho
 * một noHost_* mode v.v.).
 *
 * Logic:
 * - host:        chỉ trong host_*
 * - judge_s1:    chỉ trong noHost_human_*  (HUMAN_SINGLE/HUMAN_MULTI)
 * - judge:       chỉ trong HUMAN_MULTI (host_human_3v3, noHost_human_3v3)
 * - captain_*:   mọi mode (luôn tham gia)
 * - debater_*:   mọi mode (luôn tham gia)
 * - viewer:      mọi mode
 */
function isRoleApplicable(role: Role, mode: DebateModeConfig): boolean {
  const isHostMode = mode.hasHost;
  const isHumanSingle = mode.judgeType === 'HUMAN_SINGLE';
  const isHumanMulti = mode.judgeType === 'HUMAN_MULTI';

  switch (role) {
    case 'host':
      return isHostMode;
    case 'judge_s1':
      // Judge S1 chỉ tồn tại khi có Judge Human và không có Host.
      return !isHostMode && (isHumanSingle || isHumanMulti);
    case 'judge':
      // Judge thường có thể tồn tại trong mọi mode có Human Judge
      // (HUMAN_SINGLE chỉ có 1 Judge = cũng là judge_s1, nhưng vẫn
      // áp dụng quyền 'judge' thường như submit_score, reaction).
      return isHumanSingle || isHumanMulti;
    case 'captain_prop':
    case 'captain_opp':
    case 'debater_prop':
    case 'debater_opp':
    case 'viewer':
      return true;
    default:
      return false;
  }
}

/**
 * Action riêng theo từng mode (overlay thêm lên base).
 *
 * - start_match: Captain trong noHost_ai_* (Consolidated §3 + §4.2)
 *   Cần cả 2 Captain cùng nhấn → engine gate thêm bằng consensus.
 */
// ── Match start (chỉ noHost_ai_*) ────────────────────────────────────
function modeSpecificActions(
  role: Role,
  mode: DebateModeConfig,
): PermissionAction[] {
  const extra: PermissionAction[] = [];

  // start_match:
  // - noHost_ai_*: Captain đồng thuận (Consolidated §3 + §4.2)
  // - host_*:      Host bấm (rule_host_judgeAI.md §4)
  // - noHost_human_*: Judge S1 bấm (rule_noHost_JudgeHuman.md §4)
  if (
    !mode.hasHost &&
    mode.judgeType === 'AI' &&
    (role === 'captain_prop' || role === 'captain_opp')
  ) {
    extra.push('start_match');
  }
  if (mode.hasHost && role === 'host') {
    extra.push('start_match');
  }
  if (
    !mode.hasHost &&
    mode.judgeType !== 'AI' &&
    role === 'judge_s1'
  ) {
    extra.push('start_match');
  }

  return extra;
}

/**
 * Tính permission set cuối cùng cho (role, modeId).
 *
 * Nếu role không áp dụng trong mode này → trả về Set rỗng.
 */
function permissionForRole(
  role: Role,
  mode: DebateModeConfig,
): Set<PermissionAction> {
  if (!isRoleApplicable(role, mode)) {
    return new Set<PermissionAction>();
  }

  const base = basePermissionsForRole(role);
  const extras = modeSpecificActions(role, mode);
  const result = new Set<PermissionAction>(base);
  for (const action of extras) {
    result.add(action);
  }
  return result;
}

/**
 * Trả về Set<PermissionAction> cơ sở cho 1 role, KHÔNG phụ thuộc mode.
 *
 * Sau đó permissionForRole() sẽ lọc theo isRoleApplicable() và thêm các
 * action riêng của mode (ví dụ: 'start_match' chỉ có ở noHost_ai_*).
 */
function basePermissionsForRole(role: Role): Set<PermissionAction> {
  switch (role) {
    case 'host':
      return permissionsForHost();
    case 'judge_s1':
      return permissionsForJudgeS1();
    case 'judge':
      return permissionsForJudge();
    case 'captain_prop':
      return permissionsForCaptain('proposition');
    case 'captain_opp':
      return permissionsForCaptain('opposition');
    case 'debater_prop':
      return permissionsForDebater('proposition');
    case 'debater_opp':
      return permissionsForDebater('opposition');
    case 'viewer':
      return permissionsForViewer();
  }
}

/**
 * Cache kết quả — engine gọi canPerform() mỗi event, cache giúp
 * tránh tạo Set mới mỗi lần.
 */
const PERMISSION_CACHE: Map<string, ReadonlySet<PermissionAction>> = new Map();

function cacheKey(role: Role, modeId: DebateModeId): string {
  return `${role}::${modeId}`;
}

function getCachedPermissions(
  role: Role,
  mode: DebateModeConfig,
): ReadonlySet<PermissionAction> {
  const key = cacheKey(role, mode.id);
  const cached = PERMISSION_CACHE.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const built = permissionForRole(role, mode);
  const frozen: ReadonlySet<PermissionAction> = new Set(built);
  PERMISSION_CACHE.set(key, frozen);
  return frozen;
}

/**
 * Kiểm tra role có quyền thực hiện action trong mode này không.
 *
 * Gate chính ở handler — ví dụ:
 *
 *   if (!canPerform(role, 'start_phase', modeId)) {
 *     throw new ForbiddenError(`Role ${role} cannot start_phase`);
 *   }
 */
export function canPerform(
  role: Role,
  action: PermissionAction,
  modeId: DebateModeId,
): boolean {
  // Lazy-load mode config — tránh circular dependency bằng dynamic import.
  // Trong hot path, import 1 lần đầu rồi cache.
  const mode = getModeConfigCached(modeId);
  const set = getCachedPermissions(role, mode);
  return set.has(action);
}

/**
 * Trả về tập quyền đầy đủ của role trong mode (read-only).
 *
 * Dùng cho UI render toolbar / dashboard — chỉ hiện button mà role có quyền.
 */
export function getPermissions(
  role: Role,
  modeId: DebateModeId,
): ReadonlySet<PermissionAction> {
  const mode = getModeConfigCached(modeId);
  return getCachedPermissions(role, mode);
}

/**
 * Cache mode config — gọi DEBATE_MODE_CONFIGS chỉ 1 lần đầu.
 */
const MODE_CACHE: Map<DebateModeId, DebateModeConfig> = new Map();

function getModeConfigCached(modeId: DebateModeId): DebateModeConfig {
  const cached = MODE_CACHE.get(modeId);
  if (cached !== undefined) {
    return cached;
  }
  // Import trực tiếp để tránh require cache lookup mỗi lần
  const preset = loadModeConfig(modeId);
  MODE_CACHE.set(modeId, preset);
  return preset;
}

// Lazy-import wrapper để tránh circular dependency.
// modeConfigs.ts import types từ types.ts (cùng package) — không có cycle,
// nhưng dùng dynamic import để chắc chắn resolution theo module load order.
import { DEBATE_MODE_CONFIGS } from './modeConfigs.js';

function loadModeConfig(modeId: DebateModeId): DebateModeConfig {
  const cfg = DEBATE_MODE_CONFIGS[modeId];
  if (!cfg) {
    throw new Error(`[permissionMatrix] Unknown modeId: ${modeId}`);
  }
  return cfg;
}

/**
 * Derive Role từ participant descriptor.
 *
 * Mapping (theo yêu cầu Task A):
 * - roomRole='host' hoặc (roomRole='owner' && primaryRole='host') → 'host'
 * - roomRole='judge' && hasControlPanel → 'judge_s1'
 * - roomRole='judge' (còn lại)         → 'judge'
 * - roomRole='debater' hoặc (roomRole='owner' && primaryRole='debater'):
 *     - speakerSlot='S1' && team='proposition' → 'captain_prop'
 *     - speakerSlot='S1' && team='opposition'  → 'captain_opp'
 *     - else if team='proposition'              → 'debater_prop'
 *     - else                                     → 'debater_opp'
 * - roomRole='viewer' hoặc (roomRole='owner' && primaryRole='viewer') → 'viewer'
 */
export function deriveRole(participant: ParticipantDescriptor): Role {
  const { roomRole, primaryRole, team, speakerSlot, hasControlPanel } =
    participant;

  if (roomRole === 'host') {
    return 'host';
  }

  if (roomRole === 'judge') {
    return hasControlPanel === true ? 'judge_s1' : 'judge';
  }

  if (roomRole === 'debater') {
    if (speakerSlot === 'S1' && team === 'proposition') {
      return 'captain_prop';
    }
    if (speakerSlot === 'S1' && team === 'opposition') {
      return 'captain_opp';
    }
    if (team === 'proposition') {
      return 'debater_prop';
    }
    if (team === 'opposition') {
      return 'debater_opp';
    }
    throw new Error(
      `[deriveRole] debater thiếu team: ${JSON.stringify(participant)}`,
    );
  }

  if (roomRole === 'viewer') {
    return 'viewer';
  }

  if (roomRole === 'owner') {
    if (primaryRole === 'host') {
      return 'host';
    }
    if (primaryRole === 'judge') {
      // owner primaryRole=judge: mặc định không có control panel trừ khi override
      return hasControlPanel === true ? 'judge_s1' : 'judge';
    }
    if (primaryRole === 'debater') {
      if (speakerSlot === 'S1' && team === 'proposition') {
        return 'captain_prop';
      }
      if (speakerSlot === 'S1' && team === 'opposition') {
        return 'captain_opp';
      }
      if (team === 'proposition') {
        return 'debater_prop';
      }
      if (team === 'opposition') {
        return 'debater_opp';
      }
      throw new Error(
        `[deriveRole] owner-as-debater thiếu team: ${JSON.stringify(participant)}`,
      );
    }
    if (primaryRole === 'viewer') {
      return 'viewer';
    }
  }

  throw new Error(
    `[deriveRole] Không xác định được role từ participant: ${JSON.stringify(participant)}`,
  );
}

/**
 * Helper debug — in ra toàn bộ permission matrix cho 1 mode.
 *
 * Chỉ dùng trong test / debug, KHÔNG dùng trong production code path.
 */
export function debugPermissionMatrix(
  modeId: DebateModeId,
): Record<Role, PermissionAction[]> {
  const allRoles: Role[] = [
    'host',
    'judge_s1',
    'judge',
    'captain_prop',
    'captain_opp',
    'debater_prop',
    'debater_opp',
    'viewer',
  ];
  const result = {} as Record<Role, PermissionAction[]>;
  for (const role of allRoles) {
    result[role] = Array.from(getPermissions(role, modeId)).sort();
  }
  return result;
}
