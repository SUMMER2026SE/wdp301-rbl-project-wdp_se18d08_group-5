import { useMemo, useState } from 'react';
import { Alert, Badge, Button as RBButton, Card, Col, Container, Pagination, Row } from 'react-bootstrap';
const Button = RBButton as any;
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { userService } from '@services/userService';

const PAGE_SIZE = 10;

function resultVariant(result: 'win' | 'loss' | 'draw' | null) {
  switch (result) {
    case 'win':
      return 'success';
    case 'loss':
      return 'danger';
    case 'draw':
      return 'secondary';
    default:
      return 'light';
  }
}

function resultLabel(result: 'win' | 'loss' | 'draw' | null) {
  switch (result) {
    case 'win':
      return 'Win';
    case 'loss':
      return 'Loss';
    case 'draw':
      return 'Draw';
    default:
      return 'Pending';
  }
}

export default function HistoryPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const historyQuery = useQuery({
    queryKey: ['user-history', userId, page],
    queryFn: async () => {
      const response = await userService.getHistory(userId!, { page, limit: PAGE_SIZE });
      return response.data;
    },
    enabled: Boolean(userId),
  });

  const items = historyQuery.data?.data ?? [];
  const pagination = historyQuery.data?.pagination;
  const title = useMemo(() => 'Debate history', []);

  if (historyQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (historyQuery.isError) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{(historyQuery.error as Error).message || 'Failed to load debate history.'}</Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">{title}</h2>
          <p className="text-muted mb-0">Track the user's completed matches.</p>
        </div>
        <Button onClick={() => navigate(userId ? `/profile/${userId}` : '/leaderboard')} variant="outline-primary">
          Back to profile
        </Button>
      </div>

      {items.length === 0 ? (
        <Alert variant="info" className="mb-0">
          No debate history yet.
        </Alert>
      ) : (
        <Row className="g-3">
          {items.map((item) => (
            <Col xs={12} key={item.sessionId}>
              <Card className="shadow-sm h-100">
                <Card.Body>
                  <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                        <h5 className="mb-0">{item.roomTitle || 'Untitled room'}</h5>
                        <Badge bg="dark">{item.format}</Badge>
                        <Badge bg={resultVariant(item.result)} text={item.result ? undefined : 'dark'}>
                          {resultLabel(item.result)}
                        </Badge>
                      </div>
                      <p className="text-muted mb-2">{item.motion || 'No motion recorded.'}</p>
                      <div className="small text-muted d-flex flex-wrap gap-3">
                        <span>Role: {item.userRole}</span>
                        <span>Side: {item.userSide || 'N/A'}</span>
                        <span>Date: {item.endedAt ? new Date(item.endedAt).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>
                    <div className="d-flex align-items-start">
                      <Button onClick={() => navigate(`/result/${item.sessionId}`)} variant="outline-secondary" size="sm">
                        View replay
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination className="justify-content-center mt-4 mb-0">
          <Pagination.Prev disabled={page <= 1} onClick={() => setPage((current) => current - 1)} />
          <Pagination.Item active>{page}</Pagination.Item>
          <Pagination.Next
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          />
        </Pagination>
      )}
    </Container>
  );
}
