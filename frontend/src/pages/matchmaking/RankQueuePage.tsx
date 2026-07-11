import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { matchmakingService } from '@services/matchmakingService';
import type { DebateFormat } from '@/types';

// Import custom components
import { QueueConsole } from '../../components/matchmaking/QueueConsole';
import { RadarScanner } from '../../components/matchmaking/RadarScanner';
import { QueueStatsCard } from '../../components/matchmaking/QueueStatsCard';
import { MatchFoundBanner } from '../../components/matchmaking/MatchFoundBanner';

// Import CSS
import '../../styles/matchmaking.css';

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
        toast.success('Match found! Entering debate room.');
        navigate(`/debate/${result.roomId}`);
        return;
      }
      toast.success('Joined competitive queue');
      void queryClient.invalidateQueries({ queryKey: ['matchmaking-status'] });
    },
    onError: () => toast.error('Could not connect to matchmaking queue'),
  });

  const leaveMutation = useMutation({
    mutationFn: () => {
      setIsLeaving(true);
      return matchmakingService.leaveQueue();
    },
    onSuccess: () => {
      toast.success('Disconnected from matchmaking queue');
      void queryClient.invalidateQueries({ queryKey: ['matchmaking-status'] });
    },
    onError: () => {
      toast.error('Could not disconnect from matchmaking');
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

  const handleEnterDebate = () => {
    if (roomId) {
      navigate(`/debate/${roomId}`);
    }
  };

  return (
    <Container className="matchmaking-container">
      {/* Title */}
      <div className="mb-4 d-flex align-items-center gap-3">
        <div
          className="rounded d-flex align-items-center justify-content-center bg-dark text-primary border border-secondary"
          style={{ width: '45px', height: '45px', fontSize: '1.4rem' }}
        >
          <i className="bi bi-lightning-charge-fill" />
        </div>
        <div>
          <h2 className="mb-1 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            Competitive Matches Hub
          </h2>
          <p className="text-secondary small mb-0">
            Queue up to get paired against players of similar skill levels based on ELO.
          </p>
        </div>
      </div>

      {status === 'matched' && roomId && (
        <MatchFoundBanner roomId={roomId} onEnter={handleEnterDebate} />
      )}

      <Row className="g-4">
        {/* Left Side: Controller Console */}
        <Col lg={7}>
          <QueueConsole
            format={format}
            onFormatChange={setFormat}
            isQueued={isQueued}
            onJoin={() => joinMutation.mutate()}
            onLeave={() => leaveMutation.mutate()}
            isPending={joinMutation.isPending || leaveMutation.isPending}
            status={status}
          />
        </Col>

        {/* Right Side: Radar Sweeps & Search Metrics */}
        <Col lg={5}>
          <RadarScanner isQueued={isQueued} status={status} />

          <QueueStatsCard
            waitTime={statusQuery.data?.waitTime || 0}
            eloRange={statusQuery.data?.eloRange}
            format={statusQuery.data?.format}
            isQueued={isQueued}
            status={status}
          />
        </Col>
      </Row>
    </Container>
  );
}
