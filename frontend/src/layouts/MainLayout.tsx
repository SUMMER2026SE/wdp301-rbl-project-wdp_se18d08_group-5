import { Outlet } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { AppNavbar } from '@components/common/AppNavbar';

export default function MainLayout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <AppNavbar />
      <Container as="main" className="flex-grow-1 py-4">
        <Outlet />
      </Container>
      <footer className="text-center py-3">
        <small className="text-muted">
          <span className="text-neon-cyan">AI</span>{' '}
          <span className="text-neon-purple">Debate</span>{' '}
          <span className="text-muted">Platform</span>
          {' — '}
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '0.7rem' }}>
            Powered by AI
          </span>
        </small>
      </footer>
    </div>
  );
}
