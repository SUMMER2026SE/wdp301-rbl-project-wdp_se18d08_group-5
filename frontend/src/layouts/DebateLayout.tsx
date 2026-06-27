import { Outlet } from 'react-router-dom';
import { ReconnectOverlay } from '@components/common/ReconnectOverlay';

export default function DebateLayout() {
  return (
    <div
      className="d-flex flex-column"
      style={{
        height: '100dvh',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
      }}
    >
      <ReconnectOverlay />
      <Outlet />
    </div>
  );
}
