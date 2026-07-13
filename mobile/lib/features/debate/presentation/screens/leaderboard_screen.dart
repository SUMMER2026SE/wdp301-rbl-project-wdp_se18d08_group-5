import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class LeaderboardScreen extends ConsumerWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leaderboard = ref.watch(leaderboardProvider);
    return DebatePage(
      title: 'Rank',
      subtitle: 'Bảng ELO của cộng đồng debate.',
      onRefresh: () => ref.refresh(leaderboardProvider.future),
      child: debateAsyncBody(
        value: leaderboard,
        data: (items) {
          if (items.isEmpty) {
            return const DebateEmptyState(
              icon: Icons.emoji_events_outlined,
              title: 'Chưa có dữ liệu xếp hạng',
              message: 'Khi có trận hoàn thành, bảng xếp hạng sẽ xuất hiện.',
            );
          }
          return Column(
            children: [
              for (final entry in items.asMap().entries) ...[
                DebateCard(
                  onTap: () => context.go(
                    '${AppConstants.profileRoute}/${entry.value.id}',
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _rankColor(
                            entry.value.rank,
                          ).withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          '#${entry.value.rank}',
                          style: TextStyle(
                            color: _rankColor(entry.value.rank),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entry.value.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${entry.value.tier} · ${entry.value.wins}W ${entry.value.losses}L ${entry.value.draws}D',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      DebatePill(
                        label: '${entry.value.elo}',
                        icon: Icons.bolt_rounded,
                        color: DebateColors.mint,
                      ),
                    ],
                  ),
                ),
                if (entry.key != items.length - 1) const SizedBox(height: 10),
              ],
            ],
          );
        },
      ),
    );
  }

  Color _rankColor(int rank) {
    if (rank == 1) return DebateColors.amber;
    if (rank <= 3) return DebateColors.indigo;
    return DebateColors.accent;
  }
}
