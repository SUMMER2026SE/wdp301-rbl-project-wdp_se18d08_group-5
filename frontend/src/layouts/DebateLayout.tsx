import { Outlet } from 'react-router-dom';
import { ReconnectOverlay } from '@components/common/ReconnectOverlay';

export default function DebateLayout() {
  return (
    <div className="vh-100 d-flex flex-column" style={{ background: 'var(--bg-surface)' }}>
      <ReconnectOverlay />
      <Outlet />
    </div>
  );
}
