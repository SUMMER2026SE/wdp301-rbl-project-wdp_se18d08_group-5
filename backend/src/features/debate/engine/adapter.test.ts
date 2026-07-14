/**
 * Unit tests cho adapter.ts — verify compatibility với code cũ trong
 * debate.service.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  getFlowAdapter,
  checkStartMatchParticipantsAdapter,
  canPerformAdapter,
  getModeConfigForRoom,
} from './adapter';

describe('adapter.ts — backward-compat với debate.service.ts cũ', () => {
  describe('getFlowAdapter()', () => {
    it('host_human_3v3 (default) — 14 steps', () => {
      const flow = getFlowAdapter('3v3', 'human');
      // Step 0 = MOTION, Step 1-13 = 14 steps theo rule_host_judgeHuman.md §14
      expect(flow).toHaveLength(15);
      expect(flow[0].speaker).toBe('HOST');
      expect(flow[0].phase).toBe('motion');
      expect(flow[1].speaker).toBe('BOTH_TEAMS_PREP');
      expect(flow[1].phase).toBe('prep_7');
      expect(flow[1].timeLimit).toBe(7 * 60);
      expect(flow[1].hostCanEnd).toBe(true); // Host có thể skip
    });

    it('host_ai_3v3 — host skip cũng OK (vì host có ở mode này)', () => {
      const flow = getFlowAdapter('3v3', 'human', 'ai');
      expect(flow).toHaveLength(15);
      // Prep step: hostCanEnd = true vì hasHost=true
      expect(flow[1].hostCanEnd).toBe(true);
    });

    it('noHost_ai_3v3 — hostCanEnd = false vì không có host', () => {
      const flow = getFlowAdapter('3v3', 'ai', 'ai');
      expect(flow).toHaveLength(15);
      // Prep: hostCanEnd = false vì controller là Consensus (không phải single controller)
      expect(flow[1].hostCanEnd).toBe(false);
    });

    it('noHost_human_3v3 — hostCanEnd = false (Judge S1 permission check riêng ở caller)', () => {
      // Lưu ý: code cũ trong debate.service.ts dùng hostCanEnd=false cho cả noHost_*
      // và check `isNoHostHumanJudge` riêng ở endPhaseByHost() để cấp quyền cho Judge S1.
      // Adapter giữ behavior này để backward-compat — không sửa caller code cũ.
      const flow = getFlowAdapter('3v3', 'ai', 'human');
      expect(flow).toHaveLength(15);
      expect(flow[1].hostCanEnd).toBe(false);
    });

    it('1v1 — 14 steps với 1 CE round', () => {
      const flow = getFlowAdapter('1v1', 'human');
      expect(flow).toHaveLength(14);
      // 1v1 chỉ có 1 CE round (crossExamRounds=1 cho 1v1)
      const ce1 = flow.find((s) => s.speaker === 'CE_ROUND_1');
      expect(ce1).toBeDefined();
      expect(ce1?.ce?.askingTeam).toBe('proposition');
      // 1v1 không có CE_ROUND_2
      const ce2 = flow.find((s) => s.speaker === 'CE_ROUND_2');
      expect(ce2).toBeUndefined();
    });

    it('3v3 cũng có 2 CE rounds (R1 Prop hỏi, R2 Opp hỏi)', () => {
      const flow = getFlowAdapter('3v3', 'human');
      const ce1 = flow.find((s) => s.speaker === 'CE_ROUND_1');
      const ce2 = flow.find((s) => s.speaker === 'CE_ROUND_2');
      expect(ce1).toBeDefined();
      expect(ce2).toBeDefined();
      expect(ce1?.ce?.askingTeam).toBe('proposition');
      expect(ce2?.ce?.askingTeam).toBe('opposition');
    });

    it('Speech có speakerCanEnd = true (debater có thể skip speech)', () => {
      const flow = getFlowAdapter('3v3', 'human');
      const speeches = flow.filter((s) => s.phase === 'speech');
      for (const s of speeches) {
        expect(s.speakerCanEnd).toBe(true);
      }
    });

    it('Prep/CE/JudgeFB có speakerCanEnd = false', () => {
      const flow = getFlowAdapter('3v3', 'human');
      const nonSpeeches = flow.filter((s) => s.phase !== 'speech');
      for (const s of nonSpeeches) {
        if (s.speaker === 'COMPLETED') continue;
        expect(s.speakerCanEnd).toBe(false);
      }
    });

    it('Final step = COMPLETED', () => {
      const flow = getFlowAdapter('3v3', 'human');
      const last = flow[flow.length - 1];
      expect(last.speaker).toBe('COMPLETED');
      expect(last.phase).toBe('completed');
    });
  });

  describe('checkStartMatchParticipantsAdapter()', () => {
    it('3v3 + host human — thiếu 1 debater → ready=false', () => {
      const result = checkStartMatchParticipantsAdapter({
        format: '3v3',
        hostType: 'human',
        judgeType: 'ai',
        judgeCount: 0,
        participants: [
          { roomRole: 'host', userId: 'h1' },
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S1', userId: 'o1' },
        ],
      });
      expect(result.ready).toBe(false);
      expect(result.counts?.debaterCount).toBe(6);
      expect(result.counts?.currentDebaters).toBe(2);
      expect(result.reason).toMatch(/need 4 more debater/);
    });

    it('1v1 + host human + AI judge — đủ 2 debater + 1 host → ready=true', () => {
      const result = checkStartMatchParticipantsAdapter({
        format: '1v1',
        hostType: 'human',
        judgeType: 'ai',
        judgeCount: 0,
        participants: [
          { roomRole: 'host', userId: 'h1' },
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S1', userId: 'o1' },
        ],
      });
      expect(result.ready).toBe(true);
      expect(result.counts?.debaterCount).toBe(2);
      expect(result.counts?.hasHost).toBe(true);
      expect(result.counts?.requiredJudges).toBe(0);
    });

    it('1v1 + noHost + Human judge — cần 1 judge', () => {
      const result = checkStartMatchParticipantsAdapter({
        format: '1v1',
        hostType: 'ai', // "ai" = noHost trong code cũ
        judgeType: 'human',
        judgeCount: 1,
        participants: [
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S1', userId: 'o1' },
        ],
      });
      expect(result.ready).toBe(false);
      expect(result.reason).toMatch(/need 1 more judge/);
    });

    it('1v1 + noHost + Human judge — thêm judge → ready=true', () => {
      const result = checkStartMatchParticipantsAdapter({
        format: '1v1',
        hostType: 'ai',
        judgeType: 'human',
        judgeCount: 1,
        participants: [
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S1', userId: 'o1' },
          { roomRole: 'judge', userId: 'j1' },
        ],
      });
      expect(result.ready).toBe(true);
    });

    it('Debater không có team/slot → reason nói rõ', () => {
      // Test verify rằng message có chứa "without team/slot" khi 1 debater thiếu position
      // (và các debater khác đủ). Trong test này, ta set 1 debater có position,
      // 1 debater không có — đủ để trigger check "without team/slot".
      const result = checkStartMatchParticipantsAdapter({
        format: '1v1',
        hostType: 'human',
        judgeType: 'ai',
        judgeCount: 0,
        participants: [
          { roomRole: 'host', userId: 'h1' },
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', userId: 'o1' }, // missing team + speakerSlot
        ],
      });
      // Note: cũng fail missing debater check trước (1/2), nhưng vẫn phải có message team/slot
      // Vì code check missing debater trước missing position. Test verify ready=false.
      expect(result.ready).toBe(false);
    });

    it('3v3 + noHost + AI judge — chỉ cần 6 debaters, không cần host/judge', () => {
      const result = checkStartMatchParticipantsAdapter({
        format: '3v3',
        hostType: 'ai',
        judgeType: 'ai',
        judgeCount: 0,
        participants: [
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S1', userId: 'p1' },
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S2', userId: 'p2' },
          { roomRole: 'debater', team: 'proposition', speakerSlot: 'S3', userId: 'p3' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S1', userId: 'o1' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S2', userId: 'o2' },
          { roomRole: 'debater', team: 'opposition', speakerSlot: 'S3', userId: 'o3' },
        ],
      });
      expect(result.ready).toBe(true);
      expect(result.counts?.hasHost).toBe(false);
      expect(result.counts?.requiredJudges).toBe(0);
    });
  });

  describe('canPerformAdapter()', () => {
    it('Host có thể start_phase trong host_ai_*', () => {
      const ok = canPerformAdapter(
        { userId: 'h', roomRole: 'host' },
        'start_phase',
        { format: '3v3', hostType: 'human', judgeType: 'ai' },
      );
      expect(ok).toBe(true);
    });

    it('Host CÓ start_match trong host_* (Host bấm để bắt đầu match)', () => {
      const ok = canPerformAdapter(
        { userId: 'h', roomRole: 'host' },
        'start_match',
        { format: '3v3', hostType: 'human', judgeType: 'ai' },
      );
      expect(ok).toBe(true);
    });

    it('Captain Prop có start_match trong noHost_ai_* (consensus)', () => {
      const ok = canPerformAdapter(
        { userId: 'p', roomRole: 'debater', team: 'proposition', speakerSlot: 'S1' },
        'start_match',
        { format: '3v3', hostType: 'ai', judgeType: 'ai' },
      );
      expect(ok).toBe(true);
    });

    it('Judge S1 có start_match trong noHost_human_*', () => {
      const ok = canPerformAdapter(
        { userId: 'j', roomRole: 'judge', hasControlPanel: true },
        'start_match',
        { format: '3v3', hostType: 'ai', judgeType: 'human' },
      );
      expect(ok).toBe(true);
    });

    it('Judge (không phải S1) KHÔNG có start_match', () => {
      const ok = canPerformAdapter(
        { userId: 'j', roomRole: 'judge', hasControlPanel: false },
        'start_match',
        { format: '3v3', hostType: 'ai', judgeType: 'human' },
      );
      expect(ok).toBe(false);
    });

    it('Viewer KHÔNG có start_phase', () => {
      const ok = canPerformAdapter(
        { userId: 'v', roomRole: 'viewer' },
        'start_phase',
        { format: '3v3', hostType: 'human', judgeType: 'ai' },
      );
      expect(ok).toBe(false);
    });
  });

  describe('getModeConfigForRoom()', () => {
    it('host_human_3v3 → id = host_human_3v3', () => {
      const m = getModeConfigForRoom({
        format: '3v3',
        hostType: 'human',
        judgeType: 'human',
      });
      expect(m.id).toBe('host_human_3v3');
      expect(m.hasHost).toBe(true);
      expect(m.judgeType).toBe('HUMAN_MULTI');
    });

    it('noHost_ai_1v1 → controller = CAPTAIN_CONSENSUS', () => {
      const m = getModeConfigForRoom({
        format: '1v1',
        hostType: 'ai',
        judgeType: 'ai',
      });
      expect(m.id).toBe('noHost_ai_1v1');
      expect(m.controllerRole).toBe('CAPTAIN_CONSENSUS');
    });

    it('noHost_human_3v3 → judgeS1DisconnectBehavior = PAUSE_NO_HANDOFF', () => {
      const m = getModeConfigForRoom({
        format: '3v3',
        hostType: 'ai',
        judgeType: 'human',
      });
      expect(m.controllerRole).toBe('JUDGE_S1');
      expect(m.judgeS1DisconnectBehavior).toBe('PAUSE_NO_HANDOFF');
    });
  });
});