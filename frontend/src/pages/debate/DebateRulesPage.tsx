import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button as RBButton, Container, Spinner } from 'react-bootstrap';
const Button = RBButton as any;
import { useTranslation } from 'react-i18next';
import { roomService } from '@services/roomService';
import type { DebateRoom } from '@/types';

/**
 * Debate Rules Page
 * Standalone page describing the rules for the current debate room.
 * Reached from the in-room "Rules" button via /debate/:roomId/rules.
 * Adapts its content to room.format, room.hostType, room.judgeType
 * so the same page renders correctly for all 4 configurations
 * (host × judge human/AI).
 */
export default function DebateRulesPage() {
  const { roomId = '' } = useParams<{ roomId: string }>();
  const { t } = useTranslation('debate');
  const td = t;

  const roomQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: async () => (await roomService.getById(roomId)).data.data,
    enabled: Boolean(roomId),
  });

  const room = roomQuery.data as DebateRoom | undefined;

  // Memoize derived booleans so the JSX stays readable.
  const flags = useMemo(
    () => ({
      isHumanHost: room?.hostType === 'human',
      isHumanJudge: room?.judgeType === 'human',
      is1v1: room?.format === '1v1',
    }),
    [room?.hostType, room?.judgeType, room?.format],
  );

  return (
    <Container
      fluid
      className="bg-dark text-white p-0"
      style={{ minHeight: '100dvh', overflowY: 'auto' }}
    >
      {/* === Top bar with back-to-room button === */}
      <div
        className="d-flex align-items-center justify-content-between px-3 py-2"
        style={{
          background: 'var(--bg-surface, #0d0d12)',
          borderBottom: '1px solid rgba(0, 245, 255, 0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Link to={`/debate/${roomId}`} style={{ textDecoration: 'none' }}>
          <Button size="sm" variant="outline-info">
            <i className="bi bi-arrow-left me-1" />
            {td('debateRoom.rules.backToRoom')}
          </Button>
        </Link>
        <h5
          className="m-0 text-neon-cyan"
          style={{ fontFamily: 'Orbitron', fontSize: '16px', letterSpacing: '0.05em' }}
        >
          {td('debateRoom.rules.title')}
        </h5>
        <div style={{ width: '110px' }} />
      </div>

      {roomQuery.isLoading ? (
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" variant="info" />
        </div>
      ) : roomQuery.isError ? (
        <div className="p-5 text-center">
          <p className="text-danger">{td('debateRoom.roomNotFound')}</p>
          <Link to={`/debate/${roomId}`}>
            <Button variant="outline-info">{td('debateRoom.rules.backToRoom')}</Button>
          </Link>
        </div>
      ) : (
        <div className="p-4" style={{ fontFamily: 'Rajdhani', fontSize: '16px', maxWidth: '960px', margin: '0 auto' }}>
          {/* Configuration banner — reflects the actual room mode */}
          <div
            className="mb-4 p-3 rounded-3"
            style={{ background: 'rgba(0, 245, 255, 0.08)', border: '1px solid rgba(0, 245, 255, 0.25)' }}
          >
            <div className="d-flex flex-wrap gap-2 align-items-center" style={{ fontSize: '13px' }}>
              <strong className="text-neon-cyan">{td('debateRoom.rules.configLabel')}</strong>
              <Badge bg="info">{td(`debateRoom.rules.format.${room?.format || '3v3'}`)}</Badge>
              <Badge bg={flags.isHumanHost ? 'success' : 'secondary'}>
                {flags.isHumanHost ? td('debateRoom.rules.hostHuman') : td('debateRoom.rules.hostAi')}
              </Badge>
              <Badge bg={flags.isHumanJudge ? 'warning' : 'dark'}>
                {flags.isHumanJudge ? td('debateRoom.rules.judgeHuman') : td('debateRoom.rules.judgeAi')}
              </Badge>
              <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                <i className="bi bi-info-circle me-1" />
                {td('debateRoom.rules.adaptiveHint')}
              </span>
            </div>
          </div>

          {/* Match & Phase Control — one paragraph; the actual control panel
              is the source of truth for who can press what. */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.matchControl')}
          </h5>
          <p className="text-muted mb-4">{td('debateRoom.rules.matchControlDesc')}</p>

          {/* General structure */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.generalStructure')}
          </h5>
          <p className="text-muted mb-3">{td('debateRoom.rules.structureDesc')}</p>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>{td('debateRoom.rules.motion')}</strong> {td('debateRoom.rules.motionDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.prep7')}</strong> {td('debateRoom.rules.prep7Desc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.speeches')}</strong> {td('debateRoom.rules.speechesDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.crossExam')}</strong> {td('debateRoom.rules.crossExamDesc')}</li>
            <li className="mb-2"><strong>{td('debateRoom.rules.judgeFeedback')}</strong> {td('debateRoom.rules.judgeFeedbackDesc')}</li>
          </ul>

          {/* Speaker positions */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.speakerPositions')}
          </h5>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2"><strong>{td('debateRoom.rules.s1')}</strong> {td('debateRoom.rules.s1Desc')}</li>
            {!flags.is1v1 && (
              <>
                <li className="mb-2"><strong>{td('debateRoom.rules.s2')}</strong> {td('debateRoom.rules.s2Desc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.s3')}</strong> {td('debateRoom.rules.s3Desc')}</li>
              </>
            )}
            {flags.is1v1 && (
              <li className="mb-2"><strong>{td('debateRoom.rules.s1v1Note')}</strong></li>
            )}
          </ul>

          {/* Judging */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.judgingTitle')}
          </h5>
          {flags.isHumanJudge ? (
            <>
              <p className="text-muted mb-3">{td('debateRoom.rules.humanJudgeScoringDesc')}</p>
              <ul className="mb-4" style={{ paddingLeft: '20px' }}>
                <li className="mb-2">{td('debateRoom.rules.judgeScorePerRound')}</li>
                <li className="mb-2">{td('debateRoom.rules.judgeFeedbackNotes')}</li>
                <li className="mb-2">{td('debateRoom.rules.judgeFinalSubmit')}</li>
              </ul>
              <h6
                className="text-muted text-uppercase mb-2"
                style={{ fontFamily: 'Orbitron', fontSize: '11px', letterSpacing: '0.05em' }}
              >
                {td('debateRoom.rules.scoringCriteria')}
              </h6>
              <ul className="mb-4" style={{ paddingLeft: '20px' }}>
                <li className="mb-2"><strong>{td('debateRoom.rules.logic', { max: 30 })}</strong> {td('debateRoom.rules.logicDesc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.rebuttal', { max: 20 })}</strong> {td('debateRoom.rules.rebuttalDesc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.evidence', { max: 15 })}</strong> {td('debateRoom.rules.evidenceDesc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.crossExamCriteria', { max: 15 })}</strong> {td('debateRoom.rules.crossExamCriteriaDesc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.strategy', { max: 10 })}</strong> {td('debateRoom.rules.strategyDesc')}</li>
                <li className="mb-2"><strong>{td('debateRoom.rules.communication', { max: 10 })}</strong> {td('debateRoom.rules.communicationDesc')}</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-muted mb-3">{td('debateRoom.rules.aiJudgeDesc')}</p>
              <ul className="mb-4" style={{ paddingLeft: '20px' }}>
                <li className="mb-2">{td('debateRoom.rules.aiJudgeCollect')}</li>
                <li className="mb-2">{td('debateRoom.rules.aiJudgeFeedback')}</li>
                <li className="mb-2">{td('debateRoom.rules.aiJudgeScore')}</li>
                <li className="mb-2">{td('debateRoom.rules.aiJudgeFinal')}</li>
              </ul>
            </>
          )}

          {/* Private rooms */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.privateRoomsTitle')}
          </h5>
          <ul className="mb-4" style={{ paddingLeft: '20px' }}>
            <li className="mb-2">{td('debateRoom.rules.propPrivateRoom')}</li>
            <li className="mb-2">{td('debateRoom.rules.oppPrivateRoom')}</li>
            {flags.isHumanJudge && (
              <li className="mb-2">{td('debateRoom.rules.judgePrivateRoom')}</li>
            )}
          </ul>

          {/* Surrender & Draw */}
          <h5 className="text-neon-cyan font-weight-bold mb-2" style={{ fontFamily: 'Orbitron', fontSize: '14px' }}>
            {td('debateRoom.rules.surrenderDrawTitle')}
          </h5>
          <ul className="mb-5" style={{ paddingLeft: '20px' }}>
            <li className="mb-2">{td('debateRoom.rules.surrenderDesc')}</li>
            <li className="mb-2">{td('debateRoom.rules.drawDesc')}</li>
          </ul>

          {/* Footer with back-to-room action */}
          <div className="text-center pb-4">
            <Link to={`/debate/${roomId}`}>
              <Button variant="outline-primary">
                <i className="bi bi-arrow-left me-1" />
                {td('debateRoom.rules.backToRoom')}
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Container>
  );
}
