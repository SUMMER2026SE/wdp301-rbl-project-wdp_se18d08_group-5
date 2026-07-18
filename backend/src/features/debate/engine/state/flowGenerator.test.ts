/**
 * Test cho flowGenerator.
 * Theo rule files §13-15, cấu trúc flow cố định với biến thể duy nhất là
 * mode.rounds.crossExamRounds (1 cho 1v1, 2 cho 3v3).
 */
import { describe, it, expect } from 'vitest';
import { DEBATE_DURATIONS } from '../config/duration.config';
import { DEBATE_MODE_CONFIGS } from '../config/modeConfigs';
import { generateFlowFromMode, findStepIndex } from './flowGenerator';

describe('flowGenerator', () => {
  it('host_ai_3v3 có 14 steps (motion, prep, 4×R1, 4×R2, 3×R3, completed)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    // 2 (motion+prep) + 3 rounds × (2 speeches + 1 CE + 1 JD_FB) + completed
    // = 2 + 3×4 + 1 = 15? Let's compute exactly:
    // round 1: 2 speeches + CE_1 + JD_FB_1 = 4
    // round 2: 2 speeches + CE_2 + JD_FB_2 = 4
    // round 3: 2 speeches + JD_FB_3 = 3 (no CE)
    // total: 2 (motion+prep) + 4 + 4 + 3 + 1 (completed) = 14
    expect(flow).toHaveLength(14);
  });

  it('noHost_ai_1v1 có 1 CE round (crossExamRounds=1)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.noHost_ai_1v1);
    const ceSteps = flow.filter((s) => s.phase === 'cross_exam');
    expect(ceSteps).toHaveLength(1);
    expect(ceSteps[0]?.speaker).toBe('CE_ROUND_1');
  });

  it('host_human_3v3 có 2 CE rounds (R1 & R2)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_human_3v3);
    const ceSteps = flow.filter((s) => s.phase === 'cross_exam');
    expect(ceSteps).toHaveLength(2);
    expect(ceSteps[0]?.speaker).toBe('CE_ROUND_1');
    expect(ceSteps[1]?.speaker).toBe('CE_ROUND_2');
  });

  it('KHÔNG có FINAL_JUDGING step (đã bỏ khỏi engine)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const finalJudgingSteps = flow.filter((s) => s.speaker === 'FINAL_JUDGING');
    expect(finalJudgingSteps).toHaveLength(0);
    // Type cast: 'final_judging' đã bỏ khỏi Phase union, nhưng ta vẫn assert rằng
    // flow KHÔNG chứa phase này (defensive check — nếu lỡ có regression sẽ fail test).
    const finalJudgingPhases = flow.filter((s) => (s.phase as string) === 'final_judging');
    expect(finalJudgingPhases).toHaveLength(0);
  });

  it('1v1: 13 steps (motion + prep + R1×3 + R2×3 + R3×3 + completed)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.noHost_ai_1v1);
    // 1v1 chỉ có 1 CE round (R1): PRO_S1 + OPP_S1 + CE_1 + JD_FB_1 = 4
    // R2 không có CE: PRO_S2 + OPP_S2 + JD_FB_2 = 3
    // R3 không có CE: PRO_S3 + OPP_S3 + JD_FB_3 = 3
    // + motion + prep + completed = 2 + 1
    // = 2 + 4 + 3 + 3 + 1 = 13
    expect(flow).toHaveLength(13);
  });

  it('mỗi step có duration lấy từ DEBATE_DURATIONS, không magic number', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.noHost_ai_3v3);
    const prep = flow.find((s) => s.phase === 'prep_7');
    expect(prep?.durationSec).toBe(DEBATE_DURATIONS.PREPARATION_SECONDS);
    const speech = flow.find((s) => s.speaker === 'PRO_S1');
    expect(speech?.durationSec).toBe(DEBATE_DURATIONS.SPEECH_SECONDS);
    const ce = flow.find((s) => s.speaker === 'CE_ROUND_1');
    expect(ce?.durationSec).toBe(DEBATE_DURATIONS.CROSS_EXAMINATION_SECONDS);
  });

  it('SPEECH steps có speakerCanEnd=true, PREP/CE/JD_FB có speakerCanEnd=false', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const speeches = flow.filter((s) => s.phase === 'speech');
    const nonSpeeches = flow.filter((s) => s.phase !== 'speech');
    for (const s of speeches) expect(s.speakerCanEnd).toBe(true);
    for (const s of nonSpeeches) {
      if (s.speaker === 'COMPLETED') continue;
      expect(s.speakerCanEnd).toBe(false);
    }
  });

  it('COMPLETED step là terminal với controllerCanEnd=false', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const completed = flow.find((s) => s.speaker === 'COMPLETED');
    expect(completed?.controllerCanEnd).toBe(false);
    expect(completed?.speakerCanEnd).toBe(false);
  });

  it('CE Round 1 askingTeam=proposition, CE Round 2 askingTeam=opposition (cân bằng)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_human_3v3);
    const ce1 = flow.find((s) => s.speaker === 'CE_ROUND_1');
    const ce2 = flow.find((s) => s.speaker === 'CE_ROUND_2');
    expect(ce1?.ceConfig?.askingTeam).toBe('proposition');
    expect(ce2?.ceConfig?.askingTeam).toBe('opposition');
    expect(ce1?.ceConfig?.quotaPerTeam).toBe(2);
    expect(ce2?.ceConfig?.quotaPerTeam).toBe(2);
  });

  it('Round 3 KHÔNG có CE (theo rule §13-15)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const ce3 = flow.find((s) => s.speaker === 'CE_ROUND_3');
    expect(ce3).toBeUndefined();
  });

  it('Round 2: OPP_S2 xuất hiện TRƯỚC PRO_S2 (theo yêu cầu)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const oppS2Idx = flow.findIndex((s) => s.speaker === 'OPP_S2');
    const proS2Idx = flow.findIndex((s) => s.speaker === 'PRO_S2');
    expect(oppS2Idx).toBeGreaterThan(0);
    expect(proS2Idx).toBeGreaterThan(0);
    expect(oppS2Idx).toBeLessThan(proS2Idx);
  });

  it('Round 1 & 3: PROP xuất hiện TRƯỚC OPP (bình thường)', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const proS1Idx = flow.findIndex((s) => s.speaker === 'PRO_S1');
    const oppS1Idx = flow.findIndex((s) => s.speaker === 'OPP_S1');
    expect(proS1Idx).toBeLessThan(oppS1Idx);

    const proS3Idx = flow.findIndex((s) => s.speaker === 'PRO_S3');
    const oppS3Idx = flow.findIndex((s) => s.speaker === 'OPP_S3');
    expect(proS3Idx).toBeLessThan(oppS3Idx);
  });

  it('findStepIndex tìm đúng step', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    const idx = findStepIndex(flow, 'PRO_S2', 'speech');
    expect(idx).toBeGreaterThan(0);
    expect(flow[idx]?.speaker).toBe('PRO_S2');
    expect(flow[idx]?.phase).toBe('speech');
  });

  it('findStepIndex trả -1 nếu không tìm thấy', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.host_ai_3v3);
    expect(findStepIndex(flow, 'NONEXIST', 'speech')).toBe(-1);
  });

  it('index của steps tăng tuần tự từ 0', () => {
    const flow = generateFlowFromMode(DEBATE_MODE_CONFIGS.noHost_ai_1v1);
    for (let i = 0; i < flow.length; i++) {
      expect(flow[i]?.index).toBe(i);
    }
  });
});