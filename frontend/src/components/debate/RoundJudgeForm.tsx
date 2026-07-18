import { Button as RBButton, Form } from 'react-bootstrap';
const Button = RBButton as any;
import { useTranslation } from 'react-i18next';
import type { SpeakerTurn } from '@/types';

type RoundJudgeFormProps = {
  round: number; // 1, 2, or 3
  propSpeaker: SpeakerTurn | null;
  oppSpeaker: SpeakerTurn | null;
  propSpeak: number;
  propCe: number;
  propNotes: string;
  oppSpeak: number;
  oppCe: number;
  oppNotes: string;
  onPropSpeakChange: (value: number) => void;
  onPropCeChange: (value: number) => void;
  onPropNotesChange: (value: string) => void;
  onOppSpeakChange: (value: number) => void;
  onOppCeChange: (value: number) => void;
  onOppNotesChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isSubmitEnabled?: boolean;
};

/**
 * Round-based judge evaluation form (Judge Feedback + Final Judging).
 *
 * Layout per team:
 *   - Speak slider (0-20)
 *   - CE slider (0-20)        — hidden in Round 3 (no cross-examination)
 *   - Notes textarea
 *
 * Both teams are scored in a single submit and the form is always enabled
 * during a judge_feedback / final_judging phase.
 */
export function RoundJudgeForm({
  round,
  propSpeaker,
  oppSpeaker,
  propSpeak,
  propCe,
  propNotes,
  oppSpeak,
  oppCe,
  oppNotes,
  onPropSpeakChange,
  onPropCeChange,
  onPropNotesChange,
  onOppSpeakChange,
  onOppCeChange,
  onOppNotesChange,
  onSubmit,
  isPending,
  isSubmitEnabled = true,
}: RoundJudgeFormProps) {
  const { t } = useTranslation('debate');

  if (!propSpeaker || !oppSpeaker) {
    return (
      <div className="text-muted small">
        Resolving speakers for this round...
      </div>
    );
  }

  const showCe = round !== 3; // Round 3 has no cross-examination

  return (
    <div>
      <div className="small text-muted mb-2">
        <strong>Round {round}</strong> evaluation
      </div>

      {/* Proposition */}
      <div className="mb-3">
        <div className="text-white small fw-bold mb-1">Proposition — {propSpeaker}</div>
        <Form.Group className="mb-1">
          <Form.Label className="small text-white mb-0">
            Speak: <span className="text-neon-yellow">{propSpeak}</span>/20
          </Form.Label>
          <Form.Range
            min={0}
            max={20}
            value={propSpeak}
            onChange={(e) => onPropSpeakChange(Number(e.target.value))}
          />
        </Form.Group>
        {showCe && (
          <Form.Group className="mb-1">
            <Form.Label className="small text-white mb-0">
              CE: <span className="text-neon-yellow">{propCe}</span>/20
            </Form.Label>
            <Form.Range
              min={0}
              max={20}
              value={propCe}
              onChange={(e) => onPropCeChange(Number(e.target.value))}
            />
          </Form.Group>
        )}
        <Form.Group className="mb-2">
          <Form.Label className="small text-muted mb-0">{t('notes')}</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            placeholder={t('notesPlaceholder', 'Notes for proposition team...')}
            className="small"
            value={propNotes}
            onChange={(e) => onPropNotesChange(e.target.value)}
          />
        </Form.Group>
      </div>

      {/* Opposition */}
      <div className="mb-3">
        <div className="text-white small fw-bold mb-1">Opposition — {oppSpeaker}</div>
        <Form.Group className="mb-1">
          <Form.Label className="small text-white mb-0">
            Speak: <span className="text-neon-yellow">{oppSpeak}</span>/20
          </Form.Label>
          <Form.Range
            min={0}
            max={20}
            value={oppSpeak}
            onChange={(e) => onOppSpeakChange(Number(e.target.value))}
          />
        </Form.Group>
        {showCe && (
          <Form.Group className="mb-1">
            <Form.Label className="small text-white mb-0">
              CE: <span className="text-neon-yellow">{oppCe}</span>/20
            </Form.Label>
            <Form.Range
              min={0}
              max={20}
              value={oppCe}
              onChange={(e) => onOppCeChange(Number(e.target.value))}
            />
          </Form.Group>
        )}
        <Form.Group className="mb-2">
          <Form.Label className="small text-muted mb-0">{t('notes')}</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            placeholder={t('notesOppPlaceholder', 'Notes for opposition team...')}
            className="small"
            value={oppNotes}
            onChange={(e) => onOppNotesChange(e.target.value)}
          />
        </Form.Group>
      </div>

      {!isSubmitEnabled && (
        <div className="alert alert-info py-1.5 px-2.5 small mb-2 text-white bg-info bg-opacity-10 border border-info border-opacity-20" style={{ fontSize: '10px', lineHeight: 1.4 }}>
          <i className="bi bi-info-circle me-1" />
          {t('canPreFill')}
        </div>
      )}

      <Button
        size="sm"
        className="w-100 btn-primary"
        onClick={onSubmit}
        disabled={isPending || !isSubmitEnabled}
      >
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </div>
  );
}

/**
 * Detect the current debate round (1, 2, 3) from the active phase + speaker.
 * Returns 0 when no scoring phase is active.
 *
 *   - judge_feedback phase → round from speaker (JUDGES_FB_1 → 1, FB_2 → 2)
 *   - any other phase      → 0
 */
export function detectCurrentRound(phase?: string | null, speaker?: string | null): 0 | 1 | 2 | 3 {
  if (!phase) return 0;
  if (phase !== 'judge_feedback' || !speaker) return 0;
  const match = /JUDGES_FB_(\d)/i.exec(speaker);
  if (!match) return 0;
  const n = Number(match[1]);
  if (![1, 2, 3].includes(n)) return 0;
  return n as 1 | 2 | 3;
}

/**
 * Resolve the Proposition speaker turn for the active round.
 */
export function resolvePropSpeaker(
  phase?: string | null,
  speaker?: string | null,
  _format?: string,
): SpeakerTurn | null {
  const round = detectCurrentRound(phase, speaker);
  if (round === 0) return null;
  if (round === 1) return 'PRO_S1';
  if (round === 2) return 'PRO_S2';
  return 'PRO_S3';
}

/**
 * Resolve the Opposition speaker turn for the active round.
 */
export function resolveOppSpeaker(
  phase?: string | null,
  speaker?: string | null,
  _format?: string,
): SpeakerTurn | null {
  const round = detectCurrentRound(phase, speaker);
  if (round === 0) return null;
  if (round === 1) return 'OPP_S1';
  if (round === 2) return 'OPP_S2';
  return 'OPP_S3';
}