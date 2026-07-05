import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider);

    return DebatePage(
      title: 'DebateHub',
      subtitle: 'Tập trung vào trận tiếp theo của bạn.',
      onRefresh: () => ref.refresh(dashboardProvider.future),
      actions: [
        IconButton(
          tooltip: 'Đổi mật khẩu',
          onPressed: () => context.push(AppConstants.changePasswordRoute),
          icon: const Icon(Icons.lock_reset_rounded),
        ),
        IconButton(
          tooltip: 'Đăng xuất',
          onPressed: () => ref.read(authProvider.notifier).logout(),
          icon: const Icon(Icons.logout_rounded),
        ),
      ],
      child: debateAsyncBody(
        value: dashboard,
        onRetry: () => ref.refresh(dashboardProvider.future),
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _HeroStatsCard(data: data),
            const SizedBox(height: 18),
            _QuickActions(userId: data.profile.id),
            const SizedBox(height: 18),
            const DebateSectionTitle(title: 'Phòng đang chờ'),
            _WaitingRoomsPreview(),
            const SizedBox(height: 92),
          ],
        ),
      ),
    );
  }
}

class _HeroStatsCard extends StatelessWidget {
  const _HeroStatsCard({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    final profile = data.profile;
    final ranking = data.ranking;

    return DebateCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DebateAvatar(
                name: profile.name,
                imageUrl: profile.avatar,
                radius: 31,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.name.isEmpty ? 'Debater' : profile.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${ranking.tier} · Rank #${ranking.rank == 0 ? '-' : ranking.rank}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              DebatePill(
                label: '${ranking.elo} ELO',
                icon: Icons.trending_up_rounded,
                color: DebateColors.mint,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              DebateStatTile(label: 'Trận', value: '${ranking.totalDebates}'),
              const SizedBox(width: 8),
              DebateStatTile(label: 'Thắng', value: '${ranking.wins}'),
              const SizedBox(width: 8),
              DebateStatTile(label: 'Thua', value: '${ranking.losses}'),
              const SizedBox(width: 8),
              DebateStatTile(label: 'Hòa', value: '${ranking.draws}'),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions({required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.55,
      children: [
        _ActionCard(
          icon: Icons.bolt,
          title: 'Tìm trận',
          onTap: () => context.go(AppConstants.matchmakingRoute),
        ),
        _ActionCard(
          icon: Icons.add_circle,
          title: 'Tạo phòng',
          onTap: () => context.push('/rooms/create'),
        ),
        _ActionCard(
          icon: Icons.history,
          title: 'Lịch sử',
          onTap: () =>
              context.push('${AppConstants.profileRoute}/$userId/history'),
        ),
        _ActionCard(
          icon: Icons.leaderboard,
          title: 'BXH',
          onTap: () => context.go(AppConstants.leaderboardRoute),
        ),
      ],
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: DebateColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: DebateColors.accent, size: 21),
          ),
          const Spacer(),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}

class _WaitingRoomsPreview extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rooms = ref.watch(roomListProvider);
    return debateAsyncBody(
      value: rooms,
      data: (items) {
        if (items.isEmpty) {
          return const DebateEmptyState(
            icon: Icons.meeting_room_outlined,
            title: 'Chưa có phòng đang chờ',
            message: 'Tạo phòng luyện tập hoặc vào hàng chờ để bắt đầu.',
          );
        }
        return Column(
          children: items
              .take(3)
              .map((room) => DebateRoomTile(room: room))
              .toList(),
        );
      },
    );
  }
}
