import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@stores/authStore';
import { LoadingScreen } from './LoadingScreen';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
