import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/core/providers/localization_providers.dart';
import 'package:flutter_riverpod_clean_architecture/core/router/locale_aware_router.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/screens/login_screen.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/screens/register_screen.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/debate_presentation.dart';
import 'package:go_router/go_router.dart';

/// Global navigator key for accessing navigator from anywhere
final rootNavigatorKey = GlobalKey<NavigatorState>();

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  // Watch for locale changes - this rebuilds the router when locale changes
  ref.watch(persistentLocaleProvider);

  // Create a router with locale awareness
  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: AppConstants.initialRoute,
    debugLogDiagnostics: true,
    // Add the observer for locale awareness
    observers: [ref.read(localizationRouterObserverProvider)],
    redirect: (context, state) {
      // Get the authentication status
      final isLoggedIn = authState.isAuthenticated;

      // Check if the user is going to the login page
      final isGoingToLogin = state.matchedLocation == AppConstants.loginRoute;

      // Check if the user is going to the register page
      final isGoingToRegister =
          state.matchedLocation == AppConstants.registerRoute;
      final isGoingToForgotPassword =
          state.matchedLocation == AppConstants.forgotPasswordRoute;

      // If not logged in and not going to login or register, redirect to login
      if (!authState.isLoading &&
          !isLoggedIn &&
          !isGoingToLogin &&
          !isGoingToRegister &&
          !isGoingToForgotPassword) {
        return AppConstants.loginRoute;
      }

      // If logged in and going to login, redirect to home
      if (isLoggedIn && (isGoingToLogin || isGoingToRegister)) {
        return AppConstants.homeRoute;
      }

      // No redirect needed
      return null;
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppConstants.homeRoute,
                name: 'home',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppConstants.matchmakingRoute,
                name: 'matchmaking',
                builder: (context, state) => const MatchmakingScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppConstants.leaderboardRoute,
                name: 'leaderboard',
                builder: (context, state) => const LeaderboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppConstants.profileRoute,
                name: 'profile_root',
                redirect: (context, state) {
                  final userId = authState.user?.id;
                  if (userId == null || userId.isEmpty) {
                    return AppConstants.homeRoute;
                  }
                  return '${AppConstants.profileRoute}/$userId';
                },
              ),
              GoRoute(
                path: '${AppConstants.profileRoute}/:userId',
                name: 'profile',
                builder: (context, state) =>
                    ProfileScreen(userId: state.pathParameters['userId'] ?? ''),
              ),
            ],
          ),
        ],
      ),

      // Login route
      GoRoute(
        path: AppConstants.loginRoute,
        name: 'login',
        builder: (context, state) => const LoginScreen(),
      ),

      // Register route
      GoRoute(
        path: AppConstants.registerRoute,
        name: 'register',
        builder: (context, state) => const RegisterScreen(),
      ),

      GoRoute(
        path: AppConstants.forgotPasswordRoute,
        name: 'forgot_password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),

      GoRoute(
        path: AppConstants.changePasswordRoute,
        name: 'change_password',
        builder: (context, state) => const ChangePasswordScreen(),
      ),

      GoRoute(
        path: AppConstants.settingsRoute,
        name: 'settings',
        builder: (context, state) => const SettingsScreen(),
      ),

      GoRoute(
        path: '${AppConstants.profileRoute}/:userId/edit',
        name: 'edit_profile',
        builder: (context, state) =>
            EditProfileScreen(userId: state.pathParameters['userId'] ?? ''),
      ),

      GoRoute(
        path: '${AppConstants.profileRoute}/:userId/history',
        name: 'history',
        builder: (context, state) =>
            HistoryScreen(userId: state.pathParameters['userId'] ?? ''),
      ),

      GoRoute(
        path: '/rooms/create',
        name: 'create_room',
        builder: (context, state) => const CreateRoomScreen(),
      ),

      GoRoute(
        path: '/rooms/:roomId/lobby',
        name: 'lobby',
        builder: (context, state) =>
            LobbyScreen(roomId: state.pathParameters['roomId'] ?? ''),
      ),

      GoRoute(
        path: '/debate/:roomId',
        name: 'debate',
        builder: (context, state) =>
            DebateRoomScreen(roomId: state.pathParameters['roomId'] ?? ''),
      ),

      GoRoute(
        path: '${AppConstants.resultRoute}/:roomId',
        name: 'result',
        builder: (context, state) =>
            ResultScreen(roomId: state.pathParameters['roomId'] ?? ''),
      ),

      // Initial route - redirects based on auth state
      GoRoute(
        path: AppConstants.initialRoute,
        name: 'initial',
        redirect: (context, state) => authState.isAuthenticated
            ? AppConstants.homeRoute
            : AppConstants.loginRoute,
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Page Not Found')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              '404',
              style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text('Page ${state.uri.path} not found'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go(AppConstants.homeRoute),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
});
