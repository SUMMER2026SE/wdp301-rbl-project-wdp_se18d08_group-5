import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class ResultScreen extends ConsumerWidget {
  const ResultScreen({super.key, required this.roomId});

  final String roomId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(roomRealtimeProvider(roomId));
    final result = ref.watch(resultProvider(roomId));
    return DebatePage(
      title: 'Kết quả',
      subtitle: 'Tổng kết trận debate.',
      child: debateAsyncBody(
        value: result,
        data: (data) {
          final winner = data.finalScores['winner']?.toString() ?? 'pending';
          final prop = data.finalScores['teamProposition'] is Map
              ? data.finalScores['teamProposition'] as Map
              : const {};
          final opp = data.finalScores['teamOpposition'] is Map
              ? data.finalScores['teamOpposition'] as Map
              : const {};
          return Column(
            children: [
              if (data.room != null) DebateRoomHeader(room: data.room!),
              const SizedBox(height: 12),
              DebateCard(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    DebatePill(
                      label: 'Winner',
                      icon: Icons.emoji_events_rounded,
                      color: DebateColors.amber,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      winner.toUpperCase(),
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        DebateStatTile(
                          label: 'Proposition',
                          value: '${prop['total'] ?? 0}',
                        ),
                        const SizedBox(width: 8),
                        DebateStatTile(
                          label: 'Opposition',
                          value: '${opp['total'] ?? 0}',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => context.go(AppConstants.homeRoute),
                icon: const Icon(Icons.home_rounded),
                label: const Text('Về Home'),
              ),
            ],
          );
        },
      ),
    );
  }
}
