import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, ButtonGroup, Card, Col, Container, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { matchmakingService } from '@services/matchmakingService';
import type { DebateFormat } from '@/types';

export default function RankQueuePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [format, setFormat] = useState<DebateFormat>('1v1');
  const [isLeaving, setIsLeaving] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['matchmaking-status'],
    queryFn: async () => (await matchmakingService.getStatus()).data.data,
    refetchInterval: 5000,
  });

  const joinMutation = useMutation({
    mutationFn: () => matchmakingService.joinQueue(format),
    onSuccess: (response) => {
      const result = response.data.data;
      if (result.status === 'matched' && result.roomId) {
        toast.success('Match found');
        navigate(`/debate/${result.roomId}`);
        return;
      }
      toast.success('Joined ranked queue');
      queryClient.invalidateQueries({ queryKey: ['matchmaking-status'] });
    },
    onError: () => toast.error('Could not join queue'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => {
      setIsLeaving(true);
      return matchmakingService.leaveQueue();
    },
    onSuccess: () => {
      toast.success('Left queue');
      queryClient.invalidateQueries({ queryKey: ['matchmaking-status'] });
    },
    onError: () => {
      toast.error('Could not leave queue');
      setIsLeaving(false);
    },
    onSettled: () => {
      setTimeout(() => setIsLeaving(false), 500);
    },
  });

  const status = statusQuery.data?.status || 'idle';
  const roomId = statusQuery.data?.roomId;
  const isQueued = status === 'waiting' || status === 'queued' || status === 'matched';

  useEffect(() => {
    if (!isLeaving && status === 'matched' && roomId) {
      navigate(`/debate/${roomId}`);
    }
  }, [isLeaving, navigate, roomId, status]);

  return (
    <Container className="py-4">
      <Row className="g-4">
        <Col lg={7}>
          <h2 className="mb-3">
            <i className="bi bi-lightning-charge me-2" />
            Ranked Queue
          </h2>
          <Card>
            <Card.Body>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
                <div>
                  <div className="text-muted small">Format</div>
                  <ButtonGroup aria-label="Debate format">
                    {(['1v1', '3v3'] as DebateFormat[]).map((item) => (
                      <Button
                        key={item}
                        variant={format === item ? 'primary' : 'outline-primary'}
                        onClick={() => setFormat(item)}
                        disabled={isQueued}
                      >
                        {item}
                      </Button>
                    ))}
                  </ButtonGroup>
                </div>
                <Badge bg={isQueued ? 'success' : 'secondary'} className="fs-6">
                  {status}
                </Badge>
              </div>

              {statusQuery.isLoading ? (
                <Spinner animation="border" />
              ) : (
                <Alert variant={status === 'matched' ? 'success' : 'info'}>
                  Wait time: {statusQuery.data?.waitTime || 0}s
                  {statusQuery.data?.eloRange ? ` - ELO +/-${statusQuery.data.eloRange}` : ''}
                  {statusQuery.data?.format ? ` • ${statusQuery.data.format}` : ''}
                </Alert>
              )}

              <div className="d-flex gap-2">
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={isQueued || joinMutation.isPending}
                >
                  <i className="bi bi-play-fill me-2" />
                  Join Queue
                </Button>
                <Button
                  variant="outline-danger"
                  onClick={() => leaveMutation.mutate()}
                  disabled={!isQueued || leaveMutation.isPending}
                >
                  <i className="bi bi-x-lg me-2" />
                  Leave
                </Button>
                {status === 'matched' && roomId && (
                  <Button variant="success" onClick={() => navigate(`/debate/${roomId}`)}>
                    <i className="bi bi-door-open me-2" />
                    Enter Debate
                  </Button>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card>
            <Card.Body>
              <Card.Title>Match Status</Card.Title>
              <div className="d-flex align-items-center gap-3">
                {isQueued && <Spinner animation="grow" size="sm" />}
                <div>
                  <div className="fw-semibold">{status === 'matched' ? 'Opponent found' : 'Searching'}</div>
                  <div className="text-muted small">
                    {status === 'matched' && roomId
                      ? 'Opening your debate room...'
                      : 'The room will become available once matchmaking creates it.'}
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
