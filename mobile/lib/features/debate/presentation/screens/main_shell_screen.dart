import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:go_router/go_router.dart';

class MainShellScreen extends ConsumerWidget {
  const MainShellScreen({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final path = GoRouterState.of(context).uri.path;
    final auth = ref.watch(authProvider);
    final userId = auth.user?.id ?? '';

    return Scaffold(
      extendBody: true,
      body: navigationShell,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: DebateGlassBar(
          child: NavigationBar(
            selectedIndex: navigationShell.currentIndex,
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.grid_view_rounded),
                selectedIcon: Icon(Icons.grid_view_rounded),
                label: 'Home',
              ),
              NavigationDestination(
                icon: Icon(Icons.bolt_outlined),
                selectedIcon: Icon(Icons.bolt_rounded),
                label: 'Queue',
              ),
              NavigationDestination(
                icon: Icon(Icons.emoji_events_outlined),
                selectedIcon: Icon(Icons.emoji_events_rounded),
                label: 'Rank',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'Profile',
              ),
            ],
            onDestinationSelected: (index) {
              final profileLocation = '${AppConstants.profileRoute}/$userId';
              if (index == navigationShell.currentIndex &&
                  (index != 3 || path == profileLocation)) {
                return;
              }
              switch (index) {
                case 0:
                  navigationShell.goBranch(index);
                case 1:
                  navigationShell.goBranch(index);
                case 2:
                  navigationShell.goBranch(index);
                case 3:
                  if (userId.isNotEmpty) {
                    context.go(profileLocation);
                  }
              }
            },
          ),
        ),
      ),
    );
  }
}
