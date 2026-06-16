import { useState } from 'react';
import { Alert, Button, Container, Pagination, Table } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { RankBadge } from '@components/ranking/RankBadge';
import { rankingService } from '@services/rankingService';
import { useAuthStore } from '@stores/authStore';

const PAGE_SIZE = 20;

function getPlayerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'U';
}

function LeaderboardAvatar({ src, name }: { src?: string; name: string }) {
  const [hasError, setHasError] = useState(false);
  const shouldUseFallback = !src || hasError;

  if (shouldUseFallback) {
    return (
      <span
        className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold"
        style={{
          width: 40,
          height: 40,
          flex: '0 0 40px',
          color: '#0a0a0f',
          background: 'var(--gradient-neon)',
          border: '1px solid rgba(0, 245, 255, 0.45)',
          boxShadow: '0 0 12px rgba(0, 245, 255, 0.18)',
        }}
        aria-label={name}
      >
        {getPlayerInitial(name)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={40}
      height={40}
      className="rounded-circle object-fit-cover"
      onError={() => setHasError(true)}
    />
  );
}

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { t } = useTranslation('common');
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
          {t('leaderboard.title')}
        </h2>
        <p className="landing-subtitle mb-0">{t('leaderboard.subtitle')}</p>
      </div>

      {entries.length === 0 ? (
        <Alert variant="info">{t('leaderboard.empty')}</Alert>
      ) : (
        <>
          <div className="table-responsive">
            <Table hover bordered>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('leaderboard.columns.player')}</th>
                  <th>{t('leaderboard.columns.elo')}</th>
                  <th>{t('leaderboard.columns.tier')}</th>
                  <th>{t('leaderboard.columns.winLoss')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isCurrentUser = entry._id === currentUserId;
                  const playerName = entry.displayName || entry.username;
                  const playerContent = (
                    <div className="d-flex align-items-center gap-2 text-start">
                      <LeaderboardAvatar src={entry.avatar} name={playerName} />
                      <div>
                        <div className="fw-semibold">{playerName}</div>
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
                      <td>{entry.wins}/{entry.losses}/{entry.draws ?? 0}</td>
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
