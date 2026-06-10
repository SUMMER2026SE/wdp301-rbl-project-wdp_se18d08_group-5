import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Card, Col, Container, ListGroup, ProgressBar, Row, Spinner } from 'react-bootstrap';
import { useParams } from 'react-router-dom';
import { debateService } from '@services/debateService';

export default function ReplayPage() {
  const { sessionId = '' } = useParams();

  const replayQuery = useQuery({
    queryKey: ['replay', sessionId],
    queryFn: async () => (await debateService.getReplay(sessionId)).data.data,
    enabled: Boolean(sessionId),
  });

  if (replayQuery.isLoading) {
    return <Container className="py-4"><Spinner animation="border" /></Container>;
  }

  if (!replayQuery.data) {
    return <Container className="py-4"><Alert variant="warning">Replay not found.</Alert></Container>;
  }

  const { session } = replayQuery.data;
  const pro = session.finalScores?.teamProposition.total || 0;
  const opp = session.finalScores?.teamOpposition.total || 0;
  const total = Math.max(pro + opp, 1);

  return (
    <Container className="py-4">
      <div className="d-flex flex-wrap justify-content-between gap-3 mb-4">
        <h2 className="mb-0">Debate Result</h2>
        <Badge bg="success" className="fs-6">{session.finalScores?.winner || 'Pending'}</Badge>
      </div>

      <Row className="g-4">
        <Col lg={5}>
          <Card>
            <Card.Body>
              <Card.Title>Final Scores</Card.Title>
              <div className="mb-2">Proposition</div>
              <ProgressBar now={(pro / total) * 100} label={String(Math.round(pro))} className="mb-3" />
              <div className="mb-2">Opposition</div>
              <ProgressBar now={(opp / total) * 100} label={String(Math.round(opp))} variant="danger" className="mb-3" />
              <Alert variant="info" className="mb-0">{session.aiSummary || 'No summary available.'}</Alert>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={7}>
          <Card>
            <Card.Body>
              <Card.Title>Timeline</Card.Title>
              <ListGroup>
                {session.turnHistory.length ? session.turnHistory.map((turn, index) => (
                  <ListGroup.Item key={`${turn.speaker}-${turn.startTime}-${index}`}>
                    <div className="d-flex justify-content-between">
                      <strong>{turn.speaker}</strong>
                      <span className="text-muted small">{Math.round(turn.duration / 1000)}s</span>
                    </div>
                    <div className="text-muted small">{turn.transcript || 'No transcript captured.'}</div>
                  </ListGroup.Item>
                )) : (
                  <ListGroup.Item>No turns recorded.</ListGroup.Item>
                )}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
