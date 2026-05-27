import { useRoutes } from 'react-router-dom';
import { routes } from './routes';
import { useAuthInit } from '@hooks/useAuthInit';

function App() {
  // Initialize auth state on app load
  useAuthInit();

  const element = useRoutes(routes);
  return element;
}

export default App;
