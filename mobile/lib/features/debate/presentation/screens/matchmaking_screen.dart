import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class MatchmakingScreen extends ConsumerWidget {
  const MatchmakingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(queueControllerProvider, (previous, next) {
      final status = next.whenOrNull(data: (value) => value);
      final roomId = status?.roomId ?? '';
      if ((status?.status == 'matched') && roomId.isNotEmpty) {
        context.go('/rooms/$roomId/lobby');
      }
    });
    final queue = ref.watch(queueControllerProvider);

    return DebatePage(
      title: 'Queue',
      subtitle: 'Chọn format và tìm trận phù hợp ELO.',
      onRefresh: () => ref.read(queueControllerProvider.notifier).refresh(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          debateAsyncBody(
            value: queue,
            data: (status) => DebateCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      DebatePill(
                        label: status.status == 'waiting'
                            ? 'Đang tìm'
                            : 'Sẵn sàng',
                        icon: status.status == 'waiting'
                            ? Icons.search_rounded
                            : Icons.check_circle_rounded,
                        color: status.status == 'waiting'
                            ? DebateColors.amber
                            : DebateColors.mint,
                      ),
                      const Spacer(),
                      if (status.status == 'waiting')
                        Text(
                          '${status.waitTime}s',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    status.status == 'waiting'
                        ? 'Đang tìm đối thủ ${status.format}'
                        : 'Bạn muốn tranh biện format nào?',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    status.status == 'waiting'
                        ? 'Biên ELO hiện tại ±${status.eloRange}. App sẽ tự chuyển sang lobby khi matched.'
                        : 'Chỉ giữ 1v1 và 3v3 để vào trận nhanh.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: status.status == 'waiting'
                              ? null
                              : () => ref
                                    .read(queueControllerProvider.notifier)
                                    .join('1v1'),
                          icon: const Icon(Icons.person_rounded),
                          label: const Text('1v1'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: status.status == 'waiting'
                              ? null
                              : () => ref
                                    .read(queueControllerProvider.notifier)
                                    .join('3v3'),
                          icon: const Icon(Icons.groups_rounded),
                          label: const Text('3v3'),
                        ),
                      ),
                    ],
                  ),
                  if (status.status == 'waiting') ...[
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () =>
                          ref.read(queueControllerProvider.notifier).leave(),
                      icon: const Icon(Icons.close_rounded),
                      label: const Text('Hủy hàng chờ'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          DebateCard(
            onTap: () => context.push('/rooms/create'),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: DebateColors.indigo.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.add_rounded,
                    color: DebateColors.indigo,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Tạo phòng luyện tập',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
          const SizedBox(height: 92),
        ],
      ),
    );
  }
}
