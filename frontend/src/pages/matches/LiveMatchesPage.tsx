import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Col, Container, Row, Spinner } from 'react-bootstrap';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { roomService } from '@services/roomService';
import { useAuthStore } from '@stores/authStore';
import type { DebateFormat, DebateRoom, RoomStatus, RoomType } from '@/types';
import { useSocket } from '@hooks/useSocket';

// Import custom components
import { FeaturedMatchHero } from '../../components/matches/FeaturedMatchHero';
import { MatchesSearchFilter } from '../../components/matches/MatchesSearchFilter';
import { MatchCard } from '../../components/matches/MatchCard';
import { JoinRoomModal } from '../../components/matches/JoinRoomModal';
import { MatchesStatsWidget } from '../../components/matches/MatchesStatsWidget';

// Import CSS
import '../../styles/matches.css';

export default function LiveMatchesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);

  const [format, setFormat] = useState<DebateFormat | ''>('');
  const [roomType, setRoomType] = useState<RoomType | ''>('');
  const [status, setStatus] = useState<RoomStatus | 'all' | ''>('all');
  const [selectedRoom, setSelectedRoom] = useState<DebateRoom | null>(null);
  const [password, setPassword] = useState('');

  const { socket } = useSocket();

  const roomsQuery = useQuery({
    queryKey: ['rooms', { format, roomType, status }],
    queryFn: async () => {
      const statusFilter = !status || status === 'all' ? undefined : status;
      return (
        await roomService.getAll({
          format: format || undefined,
          roomType: roomType || undefined,
          status: statusFilter,
          limit: 24,
        })
      ).data.data;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  // Real-time socket updates for match room updates
  useEffect(() => {
    if (!socket) return;

    const invalidateRooms = () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    };

    socket.on('room:state-restore', invalidateRooms);
    socket.on('room:update', invalidateRooms);
    socket.on('debate:ended', invalidateRooms);
    socket.on('score:winner-determined', invalidateRooms);

    return () => {
      socket.off('room:state-restore', invalidateRooms);
      socket.off('room:update', invalidateRooms);
      socket.off('debate:ended', invalidateRooms);
      socket.off('score:winner-determined', invalidateRooms);
    };
  }, [socket, queryClient]);

  // Join Room Action (Lobby or Watch)
  const joinMutation = useMutation({
    mutationFn: () => roomService.join(selectedRoom!._id, password),
    onSuccess: () => {
      toast.success('Joined successfully');
      const targetRoom = selectedRoom;
      setSelectedRoom(null);
      setPassword('');

      if (targetRoom?.status === 'active' || targetRoom?.status === 'paused') {
        navigate(`/debate/${targetRoom._id}?mode=viewer`);
      } else {
        navigate(`/rooms/${targetRoom!._id}/lobby`);
      }
    },
    onError: () => toast.error('Could not join room. Double check password.'),
  });

  // Action Click Helpers
  function handleOpenJoin(room: DebateRoom) {
    if (!currentUser) {
      toast.error('Sign in to join a debate');
      navigate('/login');
      return;
    }
    setSelectedRoom(room);
    setPassword('');
  }

  function handleWatchClick(room: DebateRoom) {
    const userPart = room.participants.find((p) => p.userId === currentUser?._id);
    if (userPart) {
      navigate(`/debate/${room._id}?mode=viewer`);
    } else {
      if (room.isPrivate) {
        setSelectedRoom(room);
        setPassword('');
      } else {
        const loadId = toast.loading('Connecting as spectator...');
        roomService
          .join(room._id)
          .then(() => {
            toast.success('Connected', { id: loadId });
            navigate(`/debate/${room._id}?mode=viewer`);
          })
          .catch(() => {
            toast.error('Could not connect as spectator', { id: loadId });
          });
      }
    }
  }

  const handleRejoinClick = (roomId: string) => {
    navigate(`/debate/${roomId}`);
  };

  const handleResultClick = (roomId: string) => {
    navigate(`/result/${roomId}`);
  };

  // Local filtered list
  const visibleRooms = useMemo(() => {
    return (roomsQuery.data || []).filter((room) => {
      if (status && status !== 'all') {
        return room.status === status;
      }
      return true;
    });
  }, [roomsQuery.data, status]);

  // Grab the first live active room as the featured match of the hour
  const featuredLiveMatch = useMemo(() => {
    return (roomsQuery.data || []).find(
      (room) => room.status === 'active' || room.status === 'paused',
    );
  }, [roomsQuery.data]);

  return (
    <Container className="matches-page-container">
      {/* Title */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div
            className="rounded d-flex align-items-center justify-content-center bg-dark text-primary border border-secondary"
            style={{ width: '45px', height: '45px', fontSize: '1.4rem' }}
          >
            <i className="bi bi-broadcast" />
          </div>
          <div>
            <h2 className="mb-1 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Live Broadcasts
            </h2>
            <p className="text-secondary small mb-0">
              Join lobbies, play rank debates, or watch live speaker sessions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/rooms/create')}
          className="btn btn-primary px-4 py-2 text-black fw-bold d-flex align-items-center gap-2"
          style={{ fontFamily: 'Orbitron, sans-serif' }}
        >
          <i className="bi bi-plus-lg fs-5" />
          Create Room
        </button>
      </div>

      {roomsQuery.isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2 small">Loading debate arenas...</p>
        </div>
      ) : roomsQuery.isError ? (
        <Alert variant="danger" className="bg-dark text-danger border-danger">
          Could not load matching arenas. Please check connection.
        </Alert>
      ) : (
        <>
          {/* Featured Live Match Banner */}
          {featuredLiveMatch && (
            <FeaturedMatchHero room={featuredLiveMatch} onWatch={handleWatchClick} />
          )}

          {/* Filters Controllers */}
          <MatchesSearchFilter
            format={format}
            onFormatChange={setFormat}
            roomType={roomType}
            onRoomTypeChange={setRoomType}
            status={status}
            onStatusChange={setStatus}
          />

          {/* List display */}
          <Row className="g-4">
            <Col lg={8} xl={9}>
              <div className="h5 text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Matches Arena
              </div>

              {visibleRooms.length > 0 ? (
                <Row className="g-3">
                  {visibleRooms.map((room) => (
                    <Col md={6} xl={4} key={room._id}>
                      <MatchCard
                        room={room}
                        currentUserId={currentUser?._id}
                        onJoin={handleOpenJoin}
                        onWatch={handleWatchClick}
                        onRejoin={handleRejoinClick}
                        onResult={handleResultClick}
                      />
                    </Col>
                  ))}
                </Row>
              ) : (
                <Alert
                  variant="warning"
                  className="bg-dark text-warning border-warning text-center py-5"
                >
                  <i className="bi bi-broadcast-pin fs-2 d-block mb-3" />
                  No debate rooms found matching the selected filters.
                </Alert>
              )}
            </Col>

            {/* Sidebar Stats */}
            <Col lg={4} xl={3}>
              <div className="h5 text-white mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Stats Panel
              </div>
              <MatchesStatsWidget rooms={roomsQuery.data || []} />
            </Col>
          </Row>
        </>
      )}

      {/* Private password validation Modal */}
      <JoinRoomModal
        room={selectedRoom}
        onHide={() => setSelectedRoom(null)}
        onConfirm={() => joinMutation.mutate()}
        password={password}
        onPasswordChange={setPassword}
        isPending={joinMutation.isPending}
      />
    </Container>
  );
}
