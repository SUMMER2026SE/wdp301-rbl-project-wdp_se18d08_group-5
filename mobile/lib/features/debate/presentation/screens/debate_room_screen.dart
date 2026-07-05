import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class DebateRoomScreen extends ConsumerStatefulWidget {
  const DebateRoomScreen({super.key, required this.roomId});

  final String roomId;

  @override
  ConsumerState<DebateRoomScreen> createState() => _DebateRoomScreenState();
}

class _DebateRoomScreenState extends ConsumerState<DebateRoomScreen> {
  bool _micOn = true;

  @override
  Widget build(BuildContext context) {
    ref.watch(roomRealtimeProvider(widget.roomId));
    final room = ref.watch(roomProvider(widget.roomId));
    final session = ref.watch(sessionProvider(widget.roomId));
    return DebatePage(
      title: 'Debate',
      subtitle: _micOn ? 'Mic đang bật.' : 'Mic đang tắt.',
      actions: [
        IconButton(
          onPressed: () => context.push('/results/${widget.roomId}'),
          icon: const Icon(Icons.scoreboard_rounded),
        ),
      ],
      onRefresh: () async {
        ref.invalidate(roomProvider(widget.roomId));
        ref.invalidate(sessionProvider(widget.roomId));
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          debateAsyncBody(
            value: room,
            data: (data) => DebateRoomHeader(room: data),
          ),
          const SizedBox(height: 12),
          debateAsyncBody(
            value: session,
            data: (data) {
              final current = data['currentTurn'] is Map
                  ? data['currentTurn'] as Map
                  : const {};
              return DebateCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DebatePill(
                      label: '${current['phase'] ?? 'waiting'}',
                      icon: Icons.timer_rounded,
                      color: DebateColors.indigo,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${current['timeRemaining'] ?? current['timeLimit'] ?? '-'}s',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Speaker: ${current['speaker'] ?? '-'}',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          DebateCard(
            child: Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => setState(() => _micOn = !_micOn),
                    icon: Icon(
                      _micOn ? Icons.mic_rounded : Icons.mic_off_rounded,
                    ),
                    label: Text(_micOn ? 'Mic bật' : 'Mic tắt'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => showDebateSnack(
                      context,
                      'Voice transport native sẽ cần backend signaling/audio stream riêng.',
                    ),
                    icon: const Icon(Icons.info_outline_rounded),
                    label: const Text('Voice-first shell'),
                  ),
                ),
              ],
            ),
          ),
          _JudgeScoreCard(roomId: widget.roomId),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      await ref
                          .read(debateRepositoryProvider)
                          .requestDraw(widget.roomId);
                      if (context.mounted) {
                        showDebateSnack(context, 'Đã gửi yêu cầu hòa');
                      }
                    } catch (error) {
                      if (context.mounted) {
                        showDebateSnack(context, error.toString());
                      }
                    }
                  },
                  icon: const Icon(Icons.handshake_rounded),
                  label: const Text('Hòa'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    try {
                      await ref
                          .read(debateRepositoryProvider)
                          .surrender(widget.roomId);
                      if (context.mounted) {
                        context.go('/results/${widget.roomId}');
                      }
                    } catch (error) {
                      if (context.mounted) {
                        showDebateSnack(context, error.toString());
                      }
                    }
                  },
                  icon: const Icon(Icons.flag_rounded),
                  label: const Text('Đầu hàng'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _JudgeScoreCard extends ConsumerStatefulWidget {
  const _JudgeScoreCard({required this.roomId});

  final String roomId;

  @override
  ConsumerState<_JudgeScoreCard> createState() => _JudgeScoreCardState();
}

class _JudgeScoreCardState extends ConsumerState<_JudgeScoreCard> {
  int _round = 1;
  double _propSpeak = 20;
  double _propCe = 10;
  double _oppSpeak = 20;
  double _oppCe = 10;

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Judge scoring', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          SegmentedButton<int>(
            segments: const [
              ButtonSegment(value: 1, label: Text('R1')),
              ButtonSegment(value: 2, label: Text('R2')),
              ButtonSegment(value: 3, label: Text('R3')),
            ],
            selected: {_round},
            onSelectionChanged: (value) => setState(() => _round = value.first),
          ),
          DebateScoreSlider(
            label: 'Prop speak',
            value: _propSpeak,
            onChanged: (v) => setState(() => _propSpeak = v),
          ),
          DebateScoreSlider(
            label: 'Prop CE',
            value: _propCe,
            onChanged: (v) => setState(() => _propCe = v),
          ),
          DebateScoreSlider(
            label: 'Opp speak',
            value: _oppSpeak,
            onChanged: (v) => setState(() => _oppSpeak = v),
          ),
          DebateScoreSlider(
            label: 'Opp CE',
            value: _oppCe,
            onChanged: (v) => setState(() => _oppCe = v),
          ),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                await ref.read(debateRepositoryProvider).submitJudgeScore(
                  widget.roomId,
                  {
                    'round': _round,
                    'proposition': {
                      'speak': _propSpeak.round(),
                      'ce': _round == 3 ? 0 : _propCe.round(),
                    },
                    'opposition': {
                      'speak': _oppSpeak.round(),
                      'ce': _round == 3 ? 0 : _oppCe.round(),
                    },
                  },
                );
                if (context.mounted) {
                  showDebateSnack(context, 'Đã gửi điểm');
                }
              } catch (error) {
                if (context.mounted) {
                  showDebateSnack(context, error.toString());
                }
              }
            },
            icon: const Icon(Icons.check_rounded),
            label: const Text('Gửi điểm'),
          ),
        ],
      ),
    );
  }
}
