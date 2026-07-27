/**
 * Engine Types — toàn bộ kiểu dữ liệu dùng trong Rule-Driven Debate Engine.
 *
 * Source of truth cho mọi file khác trong engine/. Không file nào được
 * tự ý định nghĩa lại role/mode/phase — phải import từ đây.
 *
 * Xem thêm:
 * - docs/rule_host_judgeAI.md
 * - docs/rule_host_judgeHuman.md
 * - docs/rule_noHost_JudgeAI.md
 * - docs/rule_noHost_JudgeHuman.md
 * - docs/Debate_Rule_Consolidated.md
 */

/**
 * 8 ID của mọi Debate Mode — đại diện cho 2 × 2 × 2 (host × judge × team size).
 *
 * Theo Consolidated §0:
 * - host_*:  có Host
 * - noHost_*: không Host (hệ thống tự điều phối hoặc Judge S1)
 * - *ai*:    Judge là AI
 * - *human: Judge là người (1 hoặc nhiều)
 * - *_1v1:   1 debater mỗi đội (chính người đó đóng S1+S2+S3)
 * - *_3v3:   3 debater mỗi đội (S1/Captain, S2, S3)
 */
export type DebateModeId =
  | 'host_ai_1v1'
  | 'host_ai_3v3'
  | 'host_human_1v1'
  | 'host_human_3v3'
  | 'noHost_ai_1v1'
  | 'noHost_ai_3v3'
  | 'noHost_human_1v1'
  | 'noHost_human_3v3';

export type TeamSize = '1v1' | '3v3';

/**
 * Judge type — phân biệt 3 case từ Consolidated §2:
 * - AI:           Hệ thống AI chấm, không có Judge người trong room
 * - HUMAN_SINGLE: Đúng 1 Judge Human — tự động đóng Judge S1
 * - HUMAN_MULTI:  Nhiều Judge Human — chỉ định 1 người làm Judge S1
 */
export type JudgeType = 'AI' | 'HUMAN_SINGLE' | 'HUMAN_MULTI';

export type SpeakerSlot = 'S1' | 'S2' | 'S3';
export type Team = 'proposition' | 'opposition';

/**
 * Role trong engine — phân biệt đủ chi tiết để permission matrix quyết định chính xác.
 *
 * - host:         Chỉ tồn tại ở mode có Host (host_*)
 * - judge_s1:     Judge S1 — duy nhất (HUMAN_SINGLE tự động) hoặc được chỉ định (HUMAN_MULTI).
 *                 Trong noHost_human_* ôm luôn bảng điều khiển thay Host.
 * - judge:        Judge thường (chỉ ở HUMAN_MULTI, không phải S1)
 * - captain_prop: S1 đội Proposition — Captain (Consolidated §1)
 * - captain_opp:  S1 đội Opposition  — Captain
 * - debater_prop: S2/S3 đội Proposition
 * - debater_opp:  S2/S3 đội Opposition
 * - viewer:       Người xem
 */
export type Role =
  | 'host'
  | 'judge_s1'
  | 'judge'
  | 'captain_prop'
  | 'captain_opp'
  | 'debater_prop'
  | 'debater_opp'
  | 'viewer';

/**
 * Mọi action mà engine phải gate.
 *
 * Lưu ý về "phase":
 * - 'start_phase':        bắt đầu phase hiện tại (sau mute/countdown)
 * - 'skip_phase':         người nói hiện tại bỏ qua lượt của mình (chỉ áp dụng khi đến lượt họ)
 * - 'skip_consensus_phase': Skip Prep/CE cần cả 2 đội đồng thuận — chỉ Captain trong noHost_ai_*
 * - 'pause_timer' / 'resume_timer': điều phối viên (Host / Judge S1) tạm dừng
 *
 * Lưu ý về "room":
 * - 'enter_*_room': cho phép vào Private Room tương ứng
 *
 * Lưu ý về "judge":
 * - 'submit_score', 'submit_feedback' là hành động chấm Judge Human
 *   (AI Judge tự động làm trong engine, không gate bằng role).
 */
export type PermissionAction =
  // Điều phối phase / timer
  | 'start_phase'
  | 'skip_phase'
  | 'skip_consensus_phase'
  | 'pause_timer'
  | 'resume_timer'
  | 'end_match'
  // Điều phối participant
  | 'mute_participant'
  | 'enable_chat'
  | 'grant_viewer_speaking'
  // Vào private room
  | 'enter_prop_room'
  | 'enter_opp_room'
  | 'enter_judge_room'
  // Match start (chỉ noHost_ai_*)
  | 'start_match'
  // Captain consensus
  | 'surrender'
  | 'request_draw'
  | 'accept_draw'
  // Judge
  | 'submit_score'
  | 'submit_feedback'
  | 'send_reaction'
  // Chat
  | 'send_chat_debate'
  | 'send_chat_private'
  | 'send_chat_viewer'
  // Media
  | 'toggle_mic'
  | 'toggle_camera';

/**
 * Phase trong debate lifecycle.
 *
 * Tham chiếu:
 * - motion:         trước khi vào prep (host announce đề tài, hoặc auto cho noHost)
 * - prep_7:         chuẩn bị 7 phút
 * - speech:         lượt trình bày S1/S2/S3
 * - cross_exam:     CE giữa 2 đội (Round 1 & 2)
 * - judge_feedback: Free time sau CE — Judge feedback / AI sinh feedback
 * - completed:      đã kết thúc (chờ redirect /result)
 * - transition:     mute + lock chat 3s giữa 2 phase
 *
 * Lưu ý: phase `final_judging` đã bỏ khỏi union. Tổng kết điểm / verdict xảy ra
 * ngay trong JUDGE_FEEDBACK (round 3) — engine tự route sang COMPLETED khi Judge
 * submit (Human Judge) hoặc AI tính xong (AI Judge).
 */
export type Phase =
  | 'motion'
  | 'prep_7'
  | 'speech'
  | 'cross_exam'
  | 'judge_feedback'
  | 'completed'
  | 'transition';

/**
 * Cấu hình đầy đủ của 1 mode — dùng để tra cứu nhanh trong toàn bộ engine.
 *
 * Constructor từ room settings nằm ở modeConfigs.ts (getModeConfig).
 */
export interface DebateModeConfig {
  /** ID chuẩn hoá */
  id: DebateModeId;
  /** Mode này có Host không (Consolidated §0) */
  hasHost: boolean;
  /** AI / 1 Judge Human / nhiều Judge Human */
  judgeType: JudgeType;
  /** Team size */
  teamSize: TeamSize;
  /**
   * Role giữ bảng điều khiển Start/Skip/Pause/Mute/Grant/Vào mọi Private Room:
   * - HOST:              Host (host_*)
   * - JUDGE_S1:          Judge S1 (noHost_human_*)
   * - CAPTAIN_CONSENSUS: 2 Captain đồng thuận (noHost_ai_*)
   */
  controllerRole: 'HOST' | 'JUDGE_S1' | 'CAPTAIN_CONSENSUS';
  /**
   * Phase transition: bằng tay (Host/Judge S1 bấm Start) hay tự động.
   *
   * Theo rule_noHost_JudgeAI.md §9: chỉ noHost_ai_* mới AUTO_TIMED,
   * các mode khác đều MANUAL (chờ controller bấm Start).
   */
  phaseTransition: 'MANUAL' | 'AUTO_TIMED';
  /**
   * Số giây auto-advance sau TRANSITION_MUTE_SECONDS — chỉ có ý nghĩa
   * khi phaseTransition = AUTO_TIMED. Map sang
   * DEBATE_DURATIONS.AUTO_TRANSITION_COUNTDOWN_SECONDS.
   */
  autoTransitionDelaySec: number;
  /** Cấu trúc round */
  rounds: {
    /** Luôn true theo mọi rule §13-15 */
    prep: boolean;
    /** Cố định 3 theo mọi rule */
    speechCount: 3;
    /**
     * CE diễn ra ở Round 1 và Round 2 cho mọi format.
     */
    crossExamRounds: 2;
  };
  /**
   * Consensus rule cho prep/CE skip và start_match — chỉ noHost_ai_*.
   *
   * - 1v1: BOTH_DEBATERS — chính 2 người chơi đồng thuận
   * - 3v3: BOTH_CAPTAINS — 2 Captain (S1 mỗi đội) đại diện đội
   */
  consensusRule?: {
    role: 'BOTH_DEBATERS' | 'BOTH_CAPTAINS';
  };
  /** Số lượng tối thiểu participant để có thể start match */
  requiredParticipants: {
    /** 1 (1v1) hoặc 3 (3v3) debater mỗi đội */
    debatersPerTeam: 1 | 3;
    /** Mode này có cần Host không (Consolidated §0) */
    needsHost: boolean;
    /**
     * Số Judge Human cần thiết:
     * - 0 cho AI judge modes
     * - 1 cho HUMAN_SINGLE
     * - 1+ cho HUMAN_MULTI (host_human_* / noHost_human_* cho phép nhiều Judge)
     */
    needsJudges: number;
  };
  /**
   * Tie-break cho AI Judge — **DEPRECATED**.
   *
   * Theo refactor 2026-07, `aggregateFinalScores()` đã bỏ hẳn tiebreaker logic:
   * winner chỉ dựa trên tổng điểm 2 đội (prop > opp → prop thắng, bằng điểm → draw).
   * Field này giữ lại trong type để không phá mode config hiện có, nhưng
   * KHÔNG còn ảnh hưởng runtime. Có thể xoá hẳn ở major version tiếp theo.
   *
   * - SPLIT_TOTAL: chia đều điểm cho 2 đội (default cho AI Judge modes — deprecated)
   * - ELO_HIGHER:  đội có ELO cao hơn thắng (deprecated)
   * - RANDOM:      chọn ngẫu nhiên (deprecated)
   */
  aiTieBreak: 'SPLIT_TOTAL' | 'ELO_HIGHER' | 'RANDOM';
  /**
   * Hành vi khi Judge S1 mất kết nối (Consolidated §7 Open Point #2 —
   * chốt "PAUSE_NO_HANDOFF").
   *
   * Hiện tại chỉ áp dụng cho HUMAN_MULTI — đóng băng match cho tới khi
   * Judge S1 quay lại hoặc host can thiệp.
   */
  judgeS1DisconnectBehavior: 'PAUSE_NO_HANDOFF';
}

/**
 * Participant đầu vào cho deriveRole().
 *
 * Mapping:
 * - roomRole:   vai trò trong room (host/judge/debater/viewer/owner)
 * - primaryRole: chỉ áp dụng khi roomRole='owner' — vai trò thực sự của owner trong match
 * - team:       proposition | opposition (chỉ áp dụng cho debater)
 * - speakerSlot: S1 | S2 | S3 (chỉ áp dụng cho debater)
 * - hasControlPanel: Judge có ôm bảng điều khiển không
 *                   (= roomRole='judge' && (judgeCount===1 || được chỉ định))
 */
export interface ParticipantDescriptor {
  roomRole: 'host' | 'judge' | 'debater' | 'viewer' | 'owner';
  primaryRole?: 'host' | 'debater' | 'viewer' | 'judge';
  team?: Team;
  speakerSlot?: SpeakerSlot;
  hasControlPanel?: boolean;
}

/**
 * Cấu trúc room input cho getModeConfig().
 *
 * Engine đọc từ DebateRoom model và map sang DebateModeId.
 */
export interface RoomLike {
  /** '1v1' | '3v3' — team size */
  format: TeamSize;
  /** 'human' | 'ai' — có Host không */
  hostType: 'human' | 'ai';
  /** 'human' | 'ai' — Judge là người hay AI */
  judgeType: 'human' | 'ai';
  /** Số Judge Human tham gia (chỉ ý nghĩa khi judgeType==='human') */
  judgeCount: number;
}
