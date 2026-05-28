import { useState } from 'react';
import { Alert, Button, Container, Pagination, Table } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { RankBadge } from '@components/ranking/RankBadge';
import { rankingService } from '@services/rankingService';
import { useAuthStore } from '@stores/authStore';

const PAGE_SIZE = 20;
const fallbackAvatar = 'https://via.placeholder.com/40?text=U';

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.user?._id);

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: async () => {
      const response = await rankingService.getLeaderboard({ page, limit: PAGE_SIZE });
      return response.data.data;
    },
  });

  if (leaderboardQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (leaderboardQuery.isError) {
    return (
      <Container className="py-4">
        <Alert variant="danger">{(leaderboardQuery.error as Error).message || 'Không thể tải leaderboard.'}</Alert>
      </Container>
    );
  }

  const entries = leaderboardQuery.data ?? [];

  return (
    <Container className="py-4">
      <div className="mb-4">
        <h2>
          <i className="bi bi-trophy me-2" />
          Bảng xếp hạng
        </h2>
        <p className="landing-subtitle mb-0">Xếp hạng ELO hiện tại của người chơi.</p>
      </div>

      {entries.length === 0 ? (
        <Alert variant="info">No rankings yet.</Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table hover bordered>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Người chơi</th>
                  <th>ELO</th>
                  <th>Tier</th>
                  <th>W/L</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isCurrentUser = entry._id === currentUserId;
                  const playerContent = (
                    <div className="d-flex align-items-center gap-2 text-start">
                      <img
                        src={entry.avatar || fallbackAvatar}
                        alt={entry.displayName || entry.username}
                        width={40}
                        height={40}
                        className="rounded-circle object-fit-cover"
                      />
                      <div>
                        <div className="fw-semibold">{entry.displayName || entry.username}</div>
                        <div className="text-muted small">@{entry.username}</div>
                      </div>
                    </div>
                  );

                  return (
                    <tr key={entry._id} className={isCurrentUser ? 'table-primary' : undefined}>
                      <td>{entry.rank}</td>
                      <td>
                        {isCurrentUser ? (
                          playerContent
                        ) : (
                          <Button
                            variant="link"
                            className="p-0 text-decoration-none text-reset w-100"
                            onClick={() => navigate(`/profile/${entry._id}`)}
                          >
                            {playerContent}
                          </Button>
                        )}
                      </td>
                      <td>{entry.elo}</td>
                      <td>
                        <RankBadge tier={entry.tier} />
                      </td>
                      <td>{entry.wins}/{entry.losses}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          <Pagination className="justify-content-center mb-0">
            <Pagination.Prev disabled={page === 1} onClick={() => setPage((current) => current - 1)} />
            <Pagination.Item active>{page}</Pagination.Item>
            <Pagination.Next disabled={entries.length < PAGE_SIZE} onClick={() => setPage((current) => current + 1)} />
          </Pagination>
        </>
      )}
    </Container>
  );
}
