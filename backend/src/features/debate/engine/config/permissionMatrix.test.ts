/**
 * Test cho permissionMatrix.ts — gate (role, action, modeId) theo Consolidated §4.
 *
 * Tham chiếu:
 * - docs/Debate_Rule_Consolidated.md §4.1 + §4.2 + §4.3
 * - docs/rule_host_judgeAI.md §5-§8
 * - docs/rule_host_judgeHuman.md §4-§7
 * - docs/rule_noHost_JudgeAI.md §5 + §7
 * - docs/rule_noHost_JudgeHuman.md §5-§8
 */
import { describe, it, expect } from 'vitest';
import {
  canPerform,
  debugPermissionMatrix,
  deriveRole,
  getPermissions,
} from './permissionMatrix.js';
import type {
  DebateModeId,
  ParticipantDescriptor,
  Role,
} from './types.js';

const ALL_MODES: DebateModeId[] = [
  'host_ai_1v1',
  'host_ai_3v3',
  'host_human_1v1',
  'host_human_3v3',
  'noHost_ai_1v1',
  'noHost_ai_3v3',
  'noHost_human_1v1',
  'noHost_human_3v3',
];

const HOST_MODES: DebateModeId[] = [
  'host_ai_1v1',
  'host_ai_3v3',
  'host_human_1v1',
  'host_human_3v3',
];

const NO_HOST_AI_MODES: DebateModeId[] = ['noHost_ai_1v1', 'noHost_ai_3v3'];

const NO_HOST_HUMAN_MODES: DebateModeId[] = [
  'noHost_human_1v1',
  'noHost_human_3v3',
];

const HUMAN_JUDGE_MODES: DebateModeId[] = [
  'host_human_1v1',
  'host_human_3v3',
  'noHost_human_1v1',
  'noHost_human_3v3',
];

describe('Host — Consolidated §4.1', () => {
  // per Consolidated §4.1 Host column
  it('Host CAN start_phase / skip_phase / pause_timer / resume_timer / end_match in host_*', () => {
    for (const mode of HOST_MODES) {
      expect(canPerform('host', 'start_phase', mode)).toBe(true);
      expect(canPerform('host', 'skip_phase', mode)).toBe(true);
      expect(canPerform('host', 'pause_timer', mode)).toBe(true);
      expect(canPerform('host', 'resume_timer', mode)).toBe(true);
      expect(canPerform('host', 'end_match', mode)).toBe(true);
    }
  });

  it('Host CAN mute_participant / enable_chat / grant_viewer_speaking in host_*', () => {
    for (const mode of HOST_MODES) {
      expect(canPerform('host', 'mute_participant', mode)).toBe(true);
      expect(canPerform('host', 'enable_chat', mode)).toBe(true);
      expect(canPerform('host', 'grant_viewer_speaking', mode)).toBe(true);
    }
  });

  it('Host CAN enter mọi Private Room in host_*', () => {
    for (const mode of HOST_MODES) {
      expect(canPerform('host', 'enter_prop_room', mode)).toBe(true);
      expect(canPerform('host', 'enter_opp_room', mode)).toBe(true);
      expect(canPerform('host', 'enter_judge_room', mode)).toBe(true);
    }
  });

  it('Host CANNOT start_phase in noHost_* (chỉ Judge S1 hoặc Captain)', () => {
    for (const mode of [...NO_HOST_AI_MODES, ...NO_HOST_HUMAN_MODES]) {
      expect(canPerform('host', 'start_phase', mode)).toBe(false);
    }
  });

  it('Host CANNOT submit_score (đó là việc của Judge)', () => {
    for (const mode of HOST_MODES) {
      expect(canPerform('host', 'submit_score', mode)).toBe(false);
    }
  });
});

describe('Judge S1 — Consolidated §4.3', () => {
  it('Judge S1 CAN start_phase in noHost_human_*, CANNOT in host_human_*', () => {
    expect(canPerform('judge_s1', 'start_phase', 'noHost_human_3v3')).toBe(true);
    expect(canPerform('judge_s1', 'start_phase', 'noHost_human_1v1')).toBe(true);
    expect(canPerform('judge_s1', 'start_phase', 'host_human_3v3')).toBe(
      false,
    );
    expect(canPerform('judge_s1', 'start_phase', 'host_human_1v1')).toBe(
      false,
    );
  });

  it('Judge S1 CAN pause/resume/mute/grant/end_match in noHost_human_*', () => {
    for (const mode of NO_HOST_HUMAN_MODES) {
      expect(canPerform('judge_s1', 'pause_timer', mode)).toBe(true);
      expect(canPerform('judge_s1', 'resume_timer', mode)).toBe(true);
      expect(canPerform('judge_s1', 'mute_participant', mode)).toBe(true);
      expect(canPerform('judge_s1', 'enable_chat', mode)).toBe(true);
      expect(canPerform('judge_s1', 'grant_viewer_speaking', mode)).toBe(true);
      expect(canPerform('judge_s1', 'end_match', mode)).toBe(true);
    }
  });

  it('Judge S1 CAN enter mọi Private Room in noHost_human_*', () => {
    for (const mode of NO_HOST_HUMAN_MODES) {
      expect(canPerform('judge_s1', 'enter_prop_room', mode)).toBe(true);
      expect(canPerform('judge_s1', 'enter_opp_room', mode)).toBe(true);
      expect(canPerform('judge_s1', 'enter_judge_room', mode)).toBe(true);
    }
  });

  it('Judge S1 CAN submit_score / submit_feedback / send_reaction (Judge rights)', () => {
    for (const mode of NO_HOST_HUMAN_MODES) {
      expect(canPerform('judge_s1', 'submit_score', mode)).toBe(true);
      expect(canPerform('judge_s1', 'submit_feedback', mode)).toBe(true);
      expect(canPerform('judge_s1', 'send_reaction', mode)).toBe(true);
    }
  });
});

describe('Judge (không phải S1) — Consolidated §4.3 "Judge khác"', () => {
  it('Judge CANNOT start_phase / pause_timer / mute_participant', () => {
    for (const mode of HUMAN_JUDGE_MODES) {
      expect(canPerform('judge', 'start_phase', mode)).toBe(false);
      expect(canPerform('judge', 'pause_timer', mode)).toBe(false);
      expect(canPerform('judge', 'mute_participant', mode)).toBe(false);
      expect(canPerform('judge', 'grant_viewer_speaking', mode)).toBe(false);
    }
  });

  it('Judge CAN submit_score / submit_feedback / send_reaction', () => {
    for (const mode of HUMAN_JUDGE_MODES) {
      expect(canPerform('judge', 'submit_score', mode)).toBe(true);
      expect(canPerform('judge', 'submit_feedback', mode)).toBe(true);
      expect(canPerform('judge', 'send_reaction', mode)).toBe(true);
    }
  });

  it('Judge CAN enter_judge_room, CANNOT enter_prop_room / enter_opp_room', () => {
    for (const mode of HUMAN_JUDGE_MODES) {
      expect(canPerform('judge', 'enter_judge_room', mode)).toBe(true);
      expect(canPerform('judge', 'enter_prop_room', mode)).toBe(false);
      expect(canPerform('judge', 'enter_opp_room', mode)).toBe(false);
    }
  });
});

describe('Captain S1 (proposition & opposition) — Consolidated §1 + §4.1', () => {
  it('Captain Prop CAN surrender in tất cả 8 modes', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('captain_prop', 'surrender', mode)).toBe(true);
    }
  });

  it('Captain Opp CAN surrender in tất cả 8 modes', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('captain_opp', 'surrender', mode)).toBe(true);
    }
  });

  it('Captain Prop CAN request_draw & accept_draw in tất cả 8 modes', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('captain_prop', 'request_draw', mode)).toBe(true);
      expect(canPerform('captain_prop', 'accept_draw', mode)).toBe(true);
    }
  });

  it('Captain CAN skip_phase (lượt nói của mình — engine gate currentSpeaker riêng)', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('captain_prop', 'skip_phase', mode)).toBe(true);
      expect(canPerform('captain_opp', 'skip_phase', mode)).toBe(true);
    }
  });

  it('Captain CAN skip_consensus_phase (đại diện đội) — quan trọng nhất cho noHost_ai_*', () => {
    for (const mode of NO_HOST_AI_MODES) {
      expect(canPerform('captain_prop', 'skip_consensus_phase', mode)).toBe(
        true,
      );
      expect(canPerform('captain_opp', 'skip_consensus_phase', mode)).toBe(
        true,
      );
    }
    // Cũng cho phép ở host_* & noHost_human_* vì rule §5/§7 nói
    // "Prep/CE — chỉ controller hoặc cả 2 đội cùng skip"
    for (const mode of [...HOST_MODES, ...NO_HOST_HUMAN_MODES]) {
      expect(canPerform('captain_prop', 'skip_consensus_phase', mode)).toBe(
        true,
      );
      expect(canPerform('captain_opp', 'skip_consensus_phase', mode)).toBe(
        true,
      );
    }
  });

  it('Captain CAN enter room đội mình, CANNOT enter phòng đối phương', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('captain_prop', 'enter_prop_room', mode)).toBe(true);
      expect(canPerform('captain_opp', 'enter_opp_room', mode)).toBe(true);
      expect(canPerform('captain_prop', 'enter_opp_room', mode)).toBe(false);
      expect(canPerform('captain_opp', 'enter_prop_room', mode)).toBe(false);
    }
  });

  it('Captain CAN start_match in noHost_ai_* (consensus 2 đội)', () => {
    for (const mode of NO_HOST_AI_MODES) {
      expect(canPerform('captain_prop', 'start_match', mode)).toBe(true);
      expect(canPerform('captain_opp', 'start_match', mode)).toBe(true);
    }
  });

  it('Captain CANNOT start_match in host_* và noHost_human_*', () => {
    for (const mode of [...HOST_MODES, ...NO_HOST_HUMAN_MODES]) {
      expect(canPerform('captain_prop', 'start_match', mode)).toBe(false);
      expect(canPerform('captain_opp', 'start_match', mode)).toBe(false);
    }
  });
});

describe('Debater S2/S3 — Consolidated §1 + §4.1', () => {
  it('Debater S2/S3 CANNOT surrender (chỉ Captain)', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('debater_prop', 'surrender', mode)).toBe(false);
      expect(canPerform('debater_opp', 'surrender', mode)).toBe(false);
      expect(canPerform('debater_prop', 'request_draw', mode)).toBe(false);
      expect(canPerform('debater_opp', 'accept_draw', mode)).toBe(false);
    }
  });

  it('Debater S2/S3 CANNOT skip_consensus_phase (chỉ Captain)', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('debater_prop', 'skip_consensus_phase', mode)).toBe(
        false,
      );
      expect(canPerform('debater_opp', 'skip_consensus_phase', mode)).toBe(
        false,
      );
    }
  });

  it('Debater S2 CAN skip_phase khi đến lượt (permission tồn tại; engine gate currentSpeaker)', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('debater_prop', 'skip_phase', mode)).toBe(true);
      expect(canPerform('debater_opp', 'skip_phase', mode)).toBe(true);
    }
  });

  it('Debater CANNOT start_phase / pause_timer / mute_participant / submit_score', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('debater_prop', 'start_phase', mode)).toBe(false);
      expect(canPerform('debater_prop', 'pause_timer', mode)).toBe(false);
      expect(canPerform('debater_prop', 'mute_participant', mode)).toBe(
        false,
      );
      expect(canPerform('debater_prop', 'submit_score', mode)).toBe(false);
    }
  });
});

describe('No Host + AI — không có pause/resume/mute thủ công — Consolidated §4.2', () => {
  it('không role nào có pause_timer trong noHost_ai_3v3', () => {
    const roles: Role[] = [
      'host',
      'judge_s1',
      'judge',
      'captain_prop',
      'captain_opp',
      'debater_prop',
      'debater_opp',
      'viewer',
    ];
    for (const role of roles) {
      expect(canPerform(role, 'pause_timer', 'noHost_ai_3v3')).toBe(false);
    }
  });

  it('không role nào có resume_timer trong noHost_ai_1v1', () => {
    const roles: Role[] = [
      'host',
      'judge_s1',
      'judge',
      'captain_prop',
      'captain_opp',
      'debater_prop',
      'debater_opp',
      'viewer',
    ];
    for (const role of roles) {
      expect(canPerform(role, 'resume_timer', 'noHost_ai_1v1')).toBe(false);
    }
  });

  it('không role nào có mute_participant trong noHost_ai_*', () => {
    const roles: Role[] = [
      'host',
      'judge_s1',
      'judge',
      'captain_prop',
      'captain_opp',
      'debater_prop',
      'debater_opp',
      'viewer',
    ];
    for (const role of roles) {
      for (const mode of NO_HOST_AI_MODES) {
        expect(canPerform(role, 'mute_participant', mode)).toBe(false);
        expect(canPerform(role, 'enable_chat', mode)).toBe(false);
        expect(canPerform(role, 'grant_viewer_speaking', mode)).toBe(false);
      }
    }
  });

  it('Judge không tồn tại trong noHost_ai_* (judgeType=AI → judge_s1/judge không apply)', () => {
    // Phòng trường hợp role bị set sai — vẫn không cho Judge permission
    expect(canPerform('judge_s1', 'submit_score', 'noHost_ai_3v3')).toBe(false);
    expect(canPerform('judge', 'submit_score', 'noHost_ai_3v3')).toBe(false);
  });
});

describe('Viewer — Consolidated §4.1 + §4.2 + §4.3', () => {
  it('Viewer CAN send_chat_viewer in tất cả 8 modes', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('viewer', 'send_chat_viewer', mode)).toBe(true);
    }
  });

  it('Viewer CANNOT send_chat_debate ở bất kỳ mode nào', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('viewer', 'send_chat_debate', mode)).toBe(false);
    }
  });

  it('Viewer CANNOT send_chat_private ở bất kỳ mode nào', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('viewer', 'send_chat_private', mode)).toBe(false);
    }
  });

  it('Viewer CANNOT toggle_mic (chỉ khi Host/Judge S1 grant)', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('viewer', 'toggle_mic', mode)).toBe(false);
    }
  });

  it('Viewer CANNOT start_phase / submit_score / surrender', () => {
    for (const mode of ALL_MODES) {
      expect(canPerform('viewer', 'start_phase', mode)).toBe(false);
      expect(canPerform('viewer', 'submit_score', mode)).toBe(false);
      expect(canPerform('viewer', 'surrender', mode)).toBe(false);
    }
  });
});

describe('getPermissions — trả về Set readonly', () => {
  it('trả về Set có chứa action tương ứng cho role trong mode', () => {
    const set = getPermissions('host', 'host_ai_3v3');
    expect(set).toBeInstanceOf(Set);
    expect(set.has('start_phase')).toBe(true);
    expect(set.has('pause_timer')).toBe(true);
  });

  it('cached — gọi 2 lần ra cùng reference', () => {
    const a = getPermissions('viewer', 'noHost_ai_3v3');
    const b = getPermissions('viewer', 'noHost_ai_3v3');
    expect(a).toBe(b);
  });
});

describe('deriveRole — mapping participant → Role', () => {
  it('roomRole=host → host', () => {
    expect(deriveRole({ roomRole: 'host' })).toBe('host');
  });

  it('roomRole=owner + primaryRole=host → host', () => {
    expect(
      deriveRole({ roomRole: 'owner', primaryRole: 'host' }),
    ).toBe('host');
  });

  it('roomRole=judge + hasControlPanel=true → judge_s1', () => {
    expect(
      deriveRole({ roomRole: 'judge', hasControlPanel: true }),
    ).toBe('judge_s1');
  });

  it('roomRole=judge (không control panel) → judge', () => {
    expect(
      deriveRole({ roomRole: 'judge', hasControlPanel: false }),
    ).toBe('judge');
    expect(deriveRole({ roomRole: 'judge' })).toBe('judge');
  });

  it('debater S1 + proposition → captain_prop', () => {
    expect(
      deriveRole({
        roomRole: 'debater',
        team: 'proposition',
        speakerSlot: 'S1',
      }),
    ).toBe('captain_prop');
  });

  it('debater S1 + opposition → captain_opp', () => {
    expect(
      deriveRole({
        roomRole: 'debater',
        team: 'opposition',
        speakerSlot: 'S1',
      }),
    ).toBe('captain_opp');
  });

  it('debater S2/S3 proposition → debater_prop', () => {
    expect(
      deriveRole({
        roomRole: 'debater',
        team: 'proposition',
        speakerSlot: 'S2',
      }),
    ).toBe('debater_prop');
    expect(
      deriveRole({
        roomRole: 'debater',
        team: 'proposition',
        speakerSlot: 'S3',
      }),
    ).toBe('debater_prop');
  });

  it('debater S2/S3 opposition → debater_opp', () => {
    expect(
      deriveRole({
        roomRole: 'debater',
        team: 'opposition',
        speakerSlot: 'S2',
      }),
    ).toBe('debater_opp');
  });

  it('owner primaryRole=debater, S1 prop → captain_prop', () => {
    expect(
      deriveRole({
        roomRole: 'owner',
        primaryRole: 'debater',
        team: 'proposition',
        speakerSlot: 'S1',
      }),
    ).toBe('captain_prop');
  });

  it('owner primaryRole=debater, S3 opp → debater_opp', () => {
    expect(
      deriveRole({
        roomRole: 'owner',
        primaryRole: 'debater',
        team: 'opposition',
        speakerSlot: 'S3',
      }),
    ).toBe('debater_opp');
  });

  it('viewer → viewer (cả 2 đường)', () => {
    expect(deriveRole({ roomRole: 'viewer' })).toBe('viewer');
    expect(
      deriveRole({ roomRole: 'owner', primaryRole: 'viewer' }),
    ).toBe('viewer');
  });

  it('debater thiếu team → throw error', () => {
    expect(() =>
      deriveRole({ roomRole: 'debater', speakerSlot: 'S1' }),
    ).toThrow(/thiếu team/);
  });

  it('owner primaryRole=judge + hasControlPanel → judge_s1', () => {
    expect(
      deriveRole({
        roomRole: 'owner',
        primaryRole: 'judge',
        hasControlPanel: true,
      }),
    ).toBe('judge_s1');
  });

  it('owner primaryRole không hợp lệ → throw error', () => {
    expect(() =>
      deriveRole({
        roomRole: 'owner',
        primaryRole: undefined,
      }),
    ).toThrow(/Không xác định được role/);
  });
});

describe('debugPermissionMatrix — sanity check', () => {
  it('trả về 8 role cho mỗi mode (không crash)', () => {
    for (const mode of ALL_MODES) {
      const matrix = debugPermissionMatrix(mode);
      expect(Object.keys(matrix)).toHaveLength(8);
    }
  });

  it('matrix cho noHost_ai_3v3 — host/judge_s1/judge là role không áp dụng → Set rỗng', () => {
    const matrix = debugPermissionMatrix('noHost_ai_3v3');
    // Trong mode này không có host, judge_s1, judge → permission set rỗng.
    expect(matrix.host).toEqual([]);
    expect(matrix.judge_s1).toEqual([]);
    expect(matrix.judge).toEqual([]);
    // Captain/Debater/Viewer luôn tồn tại
    expect(matrix.captain_prop.length).toBeGreaterThan(0);
    expect(matrix.viewer.length).toBeGreaterThan(0);
  });
});

describe('Hard constraints — sanitize', () => {
  it('không có magic number trong permission set (chỉ permission, không có số)', () => {
    // sanity: kiểm tra tất cả value permission là string enum
    for (const mode of ALL_MODES) {
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
      for (const role of allRoles) {
        const set = getPermissions(role, mode);
        for (const action of set) {
          expect(typeof action).toBe('string');
        }
      }
    }
  });

  it('permission matrix là pure function — cùng input → cùng output', () => {
    const input: ParticipantDescriptor = {
      roomRole: 'debater',
      team: 'proposition',
      speakerSlot: 'S1',
    };
    const r1 = deriveRole(input);
    const r2 = deriveRole(input);
    expect(r1).toBe(r2);
    expect(getPermissions(r1, 'host_ai_3v3')).toBe(
      getPermissions(r2, 'host_ai_3v3'),
    );
  });
});
