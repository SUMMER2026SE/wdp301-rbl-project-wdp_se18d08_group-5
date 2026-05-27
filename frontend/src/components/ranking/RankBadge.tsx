import type { RankTier } from '@/types';
import { Badge } from 'react-bootstrap';

function tierVariant(tier: RankTier) {
  switch (tier) {
    case 'GrandMaster':
      return 'danger';
    case 'Master':
      return 'warning';
    case 'Expert':
      return 'info';
    case 'Advanced':
      return 'primary';
    case 'Debater':
      return 'secondary';
    default:
      return 'dark';
  }
}

interface RankBadgeProps {
  tier: RankTier;
}

export function RankBadge({ tier }: RankBadgeProps) {
  return <Badge bg={tierVariant(tier)}>{tier}</Badge>;
}
