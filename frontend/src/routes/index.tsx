import { RouteObject, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import MainLayout from '@layouts/MainLayout';
import DebateLayout from '@layouts/DebateLayout';
import { ProtectedRoute } from '@components/common/ProtectedRoute';
import { LoadingScreen } from '@components/common/LoadingScreen';

// Lazy-loaded pages
const HomePage = lazy(() => import('@pages/HomePage'));
const LoginPage = lazy(() => import('@pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@pages/auth/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('@pages/auth/ChangePasswordPage'));
const ProfilePage = lazy(() => import('@pages/user/ProfilePage'));
const LeaderboardPage = lazy(() => import('@pages/ranking/LeaderboardPage'));
const LiveMatchesPage = lazy(() => import('@pages/matches/LiveMatchesPage'));
const CreateRoomPage = lazy(() => import('@pages/room/CreateRoomPage'));
const LobbyPage = lazy(() => import('@pages/room/LobbyPage'));
const DebateRoomPage = lazy(() => import('@pages/debate/DebateRoomPage'));
const RankQueuePage = lazy(() => import('@pages/matchmaking/RankQueuePage'));
const ReplayPage = lazy(() => import('@pages/replay/ReplayPage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));

function withSuspense(Component: React.LazyExoticComponent<() => JSX.Element>) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: withSuspense(HomePage) },
      { path: 'login', element: withSuspense(LoginPage) },
      { path: 'register', element: withSuspense(RegisterPage) },
      { path: 'verify-email', element: withSuspense(VerifyEmailPage) },
      { path: 'forgot-password', element: withSuspense(ForgotPasswordPage) },
      { path: 'reset-password', element: withSuspense(ResetPasswordPage) },
      {
        path: 'profile/:userId',
        element: withSuspense(ProfilePage),
      },
      {
        path: 'leaderboard',
        element: withSuspense(LeaderboardPage),
      },
      {
        path: 'matches',
        element: withSuspense(LiveMatchesPage),
      },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'rooms/create', element: withSuspense(CreateRoomPage) },
          { path: 'rooms/:roomId/lobby', element: withSuspense(LobbyPage) },
          { path: 'matchmaking', element: withSuspense(RankQueuePage) },
          { path: 'change-password', element: withSuspense(ChangePasswordPage) },
        ],
      },
      {
        path: 'replay/:sessionId',
        element: withSuspense(ReplayPage),
      },
    ],
  },
  {
    path: '/debate/:roomId',
    element: <ProtectedRoute />,
    children: [
      {
        element: <DebateLayout />,
        children: [{ index: true, element: withSuspense(DebateRoomPage) }],
      },
    ],
  },
  { path: '/404', element: withSuspense(NotFoundPage) },
  { path: '*', element: <Navigate to="/404" replace /> },
];
