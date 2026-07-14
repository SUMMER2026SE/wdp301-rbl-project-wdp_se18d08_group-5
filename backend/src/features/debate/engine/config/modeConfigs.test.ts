/**
 * Test cho modeConfigs.ts — đảm bảo 8 mode configs đúng theo rule và helper
 * getModeConfig map đúng từ room settings.
 *
 * Tham chiếu:
 * - docs/Debate_Rule_Consolidated.md §0 + §3 + §4
 * - docs/rule_noHost_JudgeAI.md §9 + §13
 */
import { describe, it, expect } from 'vitest';
import { DEBATE_DURATIONS } from './duration.config';
import {
  DEBATE_MODE_CONFIGS,
  getAllModeIds,
  getModeConfig,
} from './modeConfigs';
import type { DebateModeId } from './types';

describe('DEBATE_MODE_CONFIGS — 8 modes theo Consolidated §0', () => {
  it('chứa đúng 8 modeId', () => {
    expect(getAllModeIds()).toHaveLength(8);
    expect(getAllModeIds()).toEqual([
      'host_ai_1v1',
      'host_ai_3v3',
      'host_human_1v1',
      'host_human_3v3',
      'noHost_ai_1v1',
      'noHost_ai_3v3',
      'noHost_human_1v1',
      'noHost_human_3v3',
    ]);
  });

  it('mọi mode có rounds.speechCount === 3 (rule §13-15 lifecycle)', () => {
    for (const id of getAllModeIds()) {
      expect(DEBATE_MODE_CONFIGS[id].rounds.speechCount).toBe(3);
    }
  });

  it('mọi mode có rounds.prep === true (rule §13-15)', () => {
    for (const id of getAllModeIds()) {
      expect(DEBATE_MODE_CONFIGS[id].rounds.prep).toBe(true);
    }
  });

  it('hasHost đúng theo tên mode (Consolidated §0)', () => {
    const hostModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'host_human_1v1',
      'host_human_3v3',
    ];
    const noHostModes: DebateModeId[] = [
      'noHost_ai_1v1',
      'noHost_ai_3v3',
      'noHost_human_1v1',
      'noHost_human_3v3',
    ];
    for (const id of hostModes) {
      expect(DEBATE_MODE_CONFIGS[id].hasHost).toBe(true);
    }
    for (const id of noHostModes) {
      expect(DEBATE_MODE_CONFIGS[id].hasHost).toBe(false);
    }
  });

  it('judgeType đúng theo tên mode', () => {
    const aiModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'noHost_ai_1v1',
      'noHost_ai_3v3',
    ];
    const humanSingleModes: DebateModeId[] = [
      'host_human_1v1',
      'noHost_human_1v1',
    ];
    const humanMultiModes: DebateModeId[] = [
      'host_human_3v3',
      'noHost_human_3v3',
    ];
    for (const id of aiModes) {
      expect(DEBATE_MODE_CONFIGS[id].judgeType).toBe('AI');
    }
    for (const id of humanSingleModes) {
      expect(DEBATE_MODE_CONFIGS[id].judgeType).toBe('HUMAN_SINGLE');
    }
    for (const id of humanMultiModes) {
      expect(DEBATE_MODE_CONFIGS[id].judgeType).toBe('HUMAN_MULTI');
    }
  });

  it('controllerRole: HOST cho host_*, JUDGE_S1 cho noHost_human_*, CAPTAIN_CONSENSUS cho noHost_ai_*', () => {
    expect(DEBATE_MODE_CONFIGS.host_ai_1v1.controllerRole).toBe('HOST');
    expect(DEBATE_MODE_CONFIGS.host_ai_3v3.controllerRole).toBe('HOST');
    expect(DEBATE_MODE_CONFIGS.host_human_1v1.controllerRole).toBe('HOST');
    expect(DEBATE_MODE_CONFIGS.host_human_3v3.controllerRole).toBe('HOST');
    expect(DEBATE_MODE_CONFIGS.noHost_human_1v1.controllerRole).toBe(
      'JUDGE_S1',
    );
    expect(DEBATE_MODE_CONFIGS.noHost_human_3v3.controllerRole).toBe(
      'JUDGE_S1',
    );
    expect(DEBATE_MODE_CONFIGS.noHost_ai_1v1.controllerRole).toBe(
      'CAPTAIN_CONSENSUS',
    );
    expect(DEBATE_MODE_CONFIGS.noHost_ai_3v3.controllerRole).toBe(
      'CAPTAIN_CONSENSUS',
    );
  });

  // per rule_noHost_JudgeAI.md §9
  it('noHost_ai_* có phaseTransition = AUTO_TIMED, các mode khác = MANUAL', () => {
    expect(DEBATE_MODE_CONFIGS.noHost_ai_1v1.phaseTransition).toBe(
      'AUTO_TIMED',
    );
    expect(DEBATE_MODE_CONFIGS.noHost_ai_3v3.phaseTransition).toBe(
      'AUTO_TIMED',
    );
    const manualModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'host_human_1v1',
      'host_human_3v3',
      'noHost_human_1v1',
      'noHost_human_3v3',
    ];
    for (const id of manualModes) {
      expect(DEBATE_MODE_CONFIGS[id].phaseTransition).toBe('MANUAL');
    }
  });

  // per rule_noHost_JudgeAI.md §9 + duration.config AUTO_TRANSITION_COUNTDOWN_SECONDS
  it('autoTransitionDelaySec = AUTO_TRANSITION_COUNTDOWN_SECONDS cho AUTO_TIMED, 0 cho MANUAL', () => {
    expect(DEBATE_MODE_CONFIGS.noHost_ai_1v1.autoTransitionDelaySec).toBe(
      DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS,
    );
    expect(DEBATE_MODE_CONFIGS.noHost_ai_3v3.autoTransitionDelaySec).toBe(
      DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS,
    );
    expect(DEBATE_MODE_CONFIGS.host_ai_1v1.autoTransitionDelaySec).toBe(0);
    expect(DEBATE_MODE_CONFIGS.noHost_human_3v3.autoTransitionDelaySec).toBe(
      0,
    );
  });

  // per Consolidated §3 — consensus rule chỉ có ở noHost_ai_*
  it('consensusRule chỉ tồn tại ở noHost_ai_*', () => {
    expect(DEBATE_MODE_CONFIGS.noHost_ai_1v1.consensusRule).toEqual({
      role: 'BOTH_DEBATERS',
    });
    expect(DEBATE_MODE_CONFIGS.noHost_ai_3v3.consensusRule).toEqual({
      role: 'BOTH_CAPTAINS',
    });
    expect(
      DEBATE_MODE_CONFIGS.host_ai_1v1.consensusRule,
    ).toBeUndefined();
    expect(
      DEBATE_MODE_CONFIGS.noHost_human_1v1.consensusRule,
    ).toBeUndefined();
  });

  // per Consolidated §0 + §1
  it('debatersPerTeam: 1 cho 1v1, 3 cho 3v3', () => {
    const ids1v1: DebateModeId[] = [
      'host_ai_1v1',
      'host_human_1v1',
      'noHost_ai_1v1',
      'noHost_human_1v1',
    ];
    const ids3v3: DebateModeId[] = [
      'host_ai_3v3',
      'host_human_3v3',
      'noHost_ai_3v3',
      'noHost_human_3v3',
    ];
    for (const id of ids1v1) {
      expect(DEBATE_MODE_CONFIGS[id].requiredParticipants.debatersPerTeam).toBe(
        1,
      );
    }
    for (const id of ids3v3) {
      expect(DEBATE_MODE_CONFIGS[id].requiredParticipants.debatersPerTeam).toBe(
        3,
      );
    }
  });

  // per Consolidated §0 + §7 Open Point #4
  it('aiTieBreak = SPLIT_TOTAL cho AI judge modes (Open Point #4 chốt)', () => {
    const aiModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'noHost_ai_1v1',
      'noHost_ai_3v3',
    ];
    for (const id of aiModes) {
      expect(DEBATE_MODE_CONFIGS[id].aiTieBreak).toBe('SPLIT_TOTAL');
    }
  });

  // per Consolidated §7 Open Point #2
  it('judgeS1DisconnectBehavior = PAUSE_NO_HANDOFF (Open Point #2 chốt)', () => {
    for (const id of getAllModeIds()) {
      expect(DEBATE_MODE_CONFIGS[id].judgeS1DisconnectBehavior).toBe(
        'PAUSE_NO_HANDOFF',
      );
    }
  });

  // per Consolidated §0 — needsHost mirror hasHost
  it('requiredParticipants.needsHost mirror hasHost', () => {
    for (const id of getAllModeIds()) {
      expect(DEBATE_MODE_CONFIGS[id].requiredParticipants.needsHost).toBe(
        DEBATE_MODE_CONFIGS[id].hasHost,
      );
    }
  });

  it('requiredParticipants.needsJudges: 0 cho AI, 1 cho Human', () => {
    const aiModes: DebateModeId[] = [
      'host_ai_1v1',
      'host_ai_3v3',
      'noHost_ai_1v1',
      'noHost_ai_3v3',
    ];
    const humanModes: DebateModeId[] = [
      'host_human_1v1',
      'host_human_3v3',
      'noHost_human_1v1',
      'noHost_human_3v3',
    ];
    for (const id of aiModes) {
      expect(DEBATE_MODE_CONFIGS[id].requiredParticipants.needsJudges).toBe(
        0,
      );
    }
    for (const id of humanModes) {
      expect(DEBATE_MODE_CONFIGS[id].requiredParticipants.needsJudges).toBe(
        1,
      );
    }
  });
});

describe('getModeConfig — derive từ room settings', () => {
  it('host + ai + 1v1 → host_ai_1v1', () => {
    const cfg = getModeConfig({
      format: '1v1',
      hostType: 'human',
      judgeType: 'ai',
      judgeCount: 0,
    });
    expect(cfg.id).toBe('host_ai_1v1');
  });

  it('host + ai + 3v3 → host_ai_3v3', () => {
    const cfg = getModeConfig({
      format: '3v3',
      hostType: 'human',
      judgeType: 'ai',
      judgeCount: 0,
    });
    expect(cfg.id).toBe('host_ai_3v3');
  });

  it('host + human + 1 Judge + 3v3 → host_human_3v3 (HUMAN_MULTI)', () => {
    const cfg = getModeConfig({
      format: '3v3',
      hostType: 'human',
      judgeType: 'human',
      judgeCount: 1,
    });
    expect(cfg.id).toBe('host_human_3v3');
    expect(cfg.judgeType).toBe('HUMAN_SINGLE');
  });

  it('noHost + human + 1 Judge + 1v1 → noHost_human_1v1', () => {
    const cfg = getModeConfig({
      format: '1v1',
      hostType: 'ai',
      judgeType: 'human',
      judgeCount: 1,
    });
    expect(cfg.id).toBe('noHost_human_1v1');
    expect(cfg.controllerRole).toBe('JUDGE_S1');
  });

  it('noHost + ai + 3v3 → noHost_ai_3v3, CAPTAIN_CONSENSUS, AUTO_TIMED', () => {
    const cfg = getModeConfig({
      format: '3v3',
      hostType: 'ai',
      judgeType: 'ai',
      judgeCount: 0,
    });
    expect(cfg.id).toBe('noHost_ai_3v3');
    expect(cfg.controllerRole).toBe('CAPTAIN_CONSENSUS');
    expect(cfg.phaseTransition).toBe('AUTO_TIMED');
    expect(cfg.consensusRule).toEqual({ role: 'BOTH_CAPTAINS' });
  });

  it('noHost + ai + 1v1 → noHost_ai_1v1, BOTH_DEBATERS', () => {
    const cfg = getModeConfig({
      format: '1v1',
      hostType: 'ai',
      judgeType: 'ai',
      judgeCount: 0,
    });
    expect(cfg.id).toBe('noHost_ai_1v1');
    expect(cfg.consensusRule).toEqual({ role: 'BOTH_DEBATERS' });
  });

  it('judgeType=ai với judgeCount>0 → throw error rõ ràng', () => {
    expect(() =>
      getModeConfig({
        format: '1v1',
        hostType: 'human',
        judgeType: 'ai',
        judgeCount: 1,
      }),
    ).toThrow(/judgeType='ai' không hợp lệ/);
  });

  it('judgeType=human với judgeCount<1 → throw error', () => {
    expect(() =>
      getModeConfig({
        format: '1v1',
        hostType: 'human',
        judgeType: 'human',
        judgeCount: 0,
      }),
    ).toThrow(/yêu cầu judgeCount>=1/);
  });

  it('judgeCount=2 → HUMAN_MULTI', () => {
    const cfg = getModeConfig({
      format: '3v3',
      hostType: 'ai',
      judgeType: 'human',
      judgeCount: 2,
    });
    expect(cfg.id).toBe('noHost_human_3v3');
    expect(cfg.judgeType).toBe('HUMAN_MULTI');
  });
});

describe('getAllModeIds', () => {
  it('trả về 8 modeId', () => {
    expect(getAllModeIds()).toHaveLength(8);
  });

  it('mỗi modeId đều có config tương ứng', () => {
    for (const id of getAllModeIds()) {
      expect(DEBATE_MODE_CONFIGS[id]).toBeDefined();
      expect(DEBATE_MODE_CONFIGS[id].id).toBe(id);
    }
  });
});
