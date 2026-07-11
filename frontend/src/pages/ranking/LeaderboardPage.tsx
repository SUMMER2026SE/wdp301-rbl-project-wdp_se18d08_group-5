import { useState } from 'react';
import { Alert, Container, Pagination } from 'react-bootstrap';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { rankingService } from '@services/rankingService';
import { useAuthStore } from '@stores/authStore';
import type { RankTier } from '@/types';

// Import custom components
import { LeaderboardPodium } from '../../components/ranking/LeaderboardPodium';
import { LeaderboardStatsCard } from '../../components/ranking/LeaderboardStatsCard';
import { LeaderboardSearchFilter } from '../../components/ranking/LeaderboardSearchFilter';
import { LeaderboardRow } from '../../components/ranking/LeaderboardRow';

// Import CSS
import '../../styles/leaderboard.css';

const PAGE_SIZE = 50; // Increased page size for a better overview list

export default function LeaderboardPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<'All' | RankTier>('All');

  const { t } = useTranslation('common');
  const currentUserId = useAuthStore((state) => state.user?._id);

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', page],
    queryFn: async () => {
      const response = await rankingService.getLeaderboard({ page, limit: PAGE_SIZE });
      const entries = response.data.data;

      if (!Array.isArray(entries)) {
        throw new Error('Invalid leaderboard response from server.');
      }

      return entries;
    },
  });

  if (leaderboardQuery.isLoading) {
    return <LoadingScreen />;
  }

  if (leaderboardQuery.isError) {
    return (
      <Container className="py-4">
        <Alert variant="danger" className="bg-dark text-danger border-danger">
          {(leaderboardQuery.error as Error).message || 'Failed to load leaderboard.'}
        </Alert>
      </Container>
    );
  }

  const entries = leaderboardQuery.data ?? [];

  // Filter entries locally based on user input
  const filteredEntries = entries.filter((entry) => {
    const name = (entry.displayName || entry.username || '').toLowerCase();
    const username = entry.username.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = name.includes(query) || username.includes(query);
    const matchesTier = selectedTier === 'All' || entry.tier === selectedTier;

    return matchesSearch && matchesTier;
  });

  return (
    <Container className="py-4 leaderboard-fade-in">
      {/* Title */}
      <div className="mb-4 d-flex align-items-center gap-3">
        <div
          className="rounded d-flex align-items-center justify-content-center bg-dark text-primary border border-secondary"
          style={{ width: '45px', height: '45px', fontSize: '1.4rem' }}
        >
          <i className="bi bi-trophy-fill" />
        </div>
        <div>
          <h2 className="mb-1 text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            {t('leaderboard.title')}
          </h2>
          <p className="text-secondary small mb-0">{t('leaderboard.subtitle')}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <Alert variant="info" className="bg-dark text-info border-info">
          {t('leaderboard.empty')}
        </Alert>
      ) : (
        <>
          {/* Stats Bar */}
          <LeaderboardStatsCard entries={entries} />

          {/* Podium for Top 3 (Only visible on Page 1) */}
          {page === 1 && searchQuery === '' && selectedTier === 'All' && (
            <LeaderboardPodium entries={entries} currentUserId={currentUserId} />
          )}

          {/* Filters Controller */}
          <LeaderboardSearchFilter
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedTier={selectedTier}
            onTierChange={setSelectedTier}
          />

          {/* Custom Rankings Table */}
          {filteredEntries.length > 0 ? (
            <div className="leaderboard-table-card-premium table-responsive">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th style={{ width: '75px' }}>Rank</th>
                    <th>{t('leaderboard.columns.player')}</th>
                    <th>{t('leaderboard.columns.elo')}</th>
                    <th>{t('leaderboard.columns.tier')}</th>
                    <th>{t('leaderboard.columns.winLoss')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <LeaderboardRow key={entry._id} entry={entry} currentUserId={currentUserId} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Alert
              variant="warning"
              className="bg-dark text-warning border-warning text-center py-4"
            >
              <i className="bi bi-search me-2" />
              No competitors found matching the search criteria or selected ELO tier.
            </Alert>
          )}

          {/* Pagination */}
          <Pagination className="justify-content-center mt-4">
            <Pagination.Prev
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="border-secondary bg-dark"
            />
            <Pagination.Item active className="fw-bold">
              {page}
            </Pagination.Item>
            <Pagination.Next
              disabled={entries.length < PAGE_SIZE}
              onClick={() => setPage((current) => current + 1)}
              className="border-secondary bg-dark"
            />
          </Pagination>
        </>
      )}
    </Container>
  );
}
