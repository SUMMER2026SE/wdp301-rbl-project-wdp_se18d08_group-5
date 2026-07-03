import { useRoutes } from 'react-router-dom';
import { routes } from './routes';
import { useAuthInit } from '@hooks/useAuthInit';
import { useSocketConnection } from '@hooks/useSocket';
import { ReturnToDebateBanner } from '@components/common/ReturnToDebateBanner';

function App() {
  // Initialize auth state on app load
  useAuthInit();
  // Open the singleton socket connection so every page (lobby, live-matches,
  // debate room) can publish and subscribe to realtime events.
  useSocketConnection();

  const element = useRoutes(routes);
  return (
    <>
      <ReturnToDebateBanner />
      {element}
    </>
  );
}

export default App;
