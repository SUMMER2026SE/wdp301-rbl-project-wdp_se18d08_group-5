import { Outlet } from 'react-router-dom';

export default function DebateLayout() {
  return (
    <div className="vh-100 d-flex flex-column" style={{ background: 'var(--bg-surface)' }}>
      <Outlet />
    </div>
  );
}
