import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/core/utils/adaptive_feedback.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/services/debate_media_controller.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:go_router/go_router.dart';

class DebateRoomScreen extends ConsumerStatefulWidget {
  const DebateRoomScreen({super.key, required this.roomId});

  final String roomId;

  @override
  ConsumerState<DebateRoomScreen> createState() => _DebateRoomScreenState();
}

class _DebateRoomScreenState extends ConsumerState<DebateRoomScreen> {
  bool _leaving = false;
  DebateMediaController? _media;

  @override
  void initState() {
    super.initState();
    _initializeMedia();
  }

  Future<void> _initializeMedia() async {
    final token = await ref.read(debateRepositoryProvider).accessToken();
    if (!mounted) return;
    final controller = DebateMediaController(
      roomId: widget.roomId,
      socketBaseUrl: AppConstants.socketBaseUrl,
      accessToken: token,
    );
    await controller.initialize();
    if (!mounted) {
      controller.dispose();
      return;
    }
    setState(() => _media = controller);
  }

  @override
  void dispose() {
    _media?.dispose();
    super.dispose();
  }

  Future<void> _leaveRoom() async {
    final shouldLeave = await AdaptiveFeedback.confirm(
      context,
      title: 'Rời phòng?',
      message:
          'Bạn sẽ không còn tham gia phòng tranh biện này. Nếu bạn là chủ phòng, '
          'quyền sở hữu sẽ được chuyển cho một thành viên khác.',
      cancelLabel: 'Ở lại',
      confirmLabel: 'Rời phòng',
      destructive: true,
    );
    if (!shouldLeave || !mounted) return;

    setState(() => _leaving = true);
    try {
      await ref.read(debateRepositoryProvider).leaveRoom(widget.roomId);
      ref
        ..invalidate(roomProvider(widget.roomId))
        ..invalidate(sessionProvider(widget.roomId))
        ..invalidate(roomListProvider);
      if (!mounted) return;
      AdaptiveFeedback.showSnackBar(context, message: 'Bạn đã rời phòng');
      context.go(AppConstants.homeRoute);
    } catch (error) {
      if (mounted) showDebateSnack(context, error.toString());
    } finally {
      if (mounted) setState(() => _leaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(roomRealtimeProvider(widget.roomId));
    final room = ref.watch(roomProvider(widget.roomId));
    final session = ref.watch(sessionProvider(widget.roomId));
    return DebatePage(
      title: 'Debate',
      subtitle: _media?.micOn == true ? 'Mic đang bật.' : 'Mic đang tắt.',
      actions: [
        IconButton(
          tooltip: 'Rời phòng',
          onPressed: _leaving ? null : _leaveRoom,
          icon: const Icon(Icons.exit_to_app_rounded, color: DebateColors.rose),
        ),
        IconButton(
          tooltip: 'Kết quả',
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
          _MediaPanel(media: _media),
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
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                foregroundColor: DebateColors.rose,
                side: const BorderSide(color: DebateColors.rose),
              ),
              onPressed: _leaving ? null : _leaveRoom,
              icon: _leaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.exit_to_app_rounded),
              label: Text(_leaving ? 'Đang rời phòng...' : 'Rời phòng'),
            ),
          ),
        ],
      ),
    );
  }
}

class _MediaPanel extends StatelessWidget {
  const _MediaPanel({required this.media});

  final DebateMediaController? media;

  @override
  Widget build(BuildContext context) {
    final controller = media;
    if (controller == null) {
      return const DebateCard(
        child: Row(
          children: [
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Text('Đang kết nối camera, micro và phụ đề trực tiếp...'),
            ),
          ],
        ),
      );
    }
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final remoteVideo = controller.remoteRenderers.entries.toList();
        final captions = controller.captions
            .where(
              (caption) =>
                  controller.showTranslations || caption.kind == 'source',
            )
            .take(4)
            .toList();
        return Column(
          children: [
            DebateCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.video_call_rounded,
                        color: DebateColors.indigo,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Video & voice',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      DebatePill(
                        label: controller.isConnected
                            ? 'Realtime'
                            : 'Connecting',
                        color: controller.isConnected
                            ? DebateColors.accent
                            : DebateColors.muted,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 150,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _VideoTile(
                          label: 'Bạn',
                          renderer: controller.localRenderer,
                          active: controller.cameraOn,
                          local: true,
                        ),
                        ...remoteVideo.map(
                          (entry) => _VideoTile(
                            label: 'Participant',
                            renderer: entry.value,
                            active: entry.value.srcObject != null,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: controller.toggleMic,
                          icon: Icon(
                            controller.micOn
                                ? Icons.mic_rounded
                                : Icons.mic_off_rounded,
                          ),
                          label: Text(controller.micOn ? 'Tắt mic' : 'Bật mic'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: controller.toggleCamera,
                          icon: Icon(
                            controller.cameraOn
                                ? Icons.videocam_rounded
                                : Icons.videocam_off_rounded,
                          ),
                          label: Text(
                            controller.cameraOn ? 'Tắt camera' : 'Bật camera',
                          ),
                        ),
                      ),
                    ],
                  ),
                  if (controller.errorMessage != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      controller.errorMessage!,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(color: DebateColors.rose),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            DebateCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.translate_rounded,
                        color: DebateColors.indigo,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Live captions & translate',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      Switch(
                        value: controller.showTranslations,
                        onChanged: controller.setShowTranslations,
                      ),
                    ],
                  ),
                  Text(
                    'Bật mic để dùng nhận diện giọng nói và dịch Việt ↔ Anh ngay trên thiết bị.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 10),
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                        value: 'vi',
                        label: Text('Tôi nói tiếng Việt'),
                      ),
                      ButtonSegment(
                        value: 'en',
                        label: Text('I speak English'),
                      ),
                    ],
                    selected: {controller.sourceLanguage},
                    onSelectionChanged: (value) =>
                        controller.setSourceLanguage(value.first),
                  ),
                  const SizedBox(height: 10),
                  if (captions.isEmpty)
                    Text(
                      'Phụ đề của người tham gia sẽ hiện tại đây.',
                      style: Theme.of(context).textTheme.bodySmall,
                    )
                  else
                    ...captions.map(
                      (caption) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          '${caption.senderName} · ${caption.kind == 'translation' ? 'DỊCH' : caption.language.toUpperCase()}\n${caption.text}',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _VideoTile extends StatelessWidget {
  const _VideoTile({
    required this.label,
    required this.renderer,
    required this.active,
    this.local = false,
  });

  final String label;
  final RTCVideoRenderer renderer;
  final bool active;
  final bool local;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 190,
      margin: const EdgeInsets.only(right: 10),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: DebateColors.canvas,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: DebateColors.line),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (active)
            RTCVideoView(
              renderer,
              mirror: local,
              objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover,
            )
          else
            const Center(
              child: Icon(
                Icons.person_outline_rounded,
                size: 42,
                color: DebateColors.muted,
              ),
            ),
          Positioned(
            left: 8,
            bottom: 8,
            child: DebatePill(label: active ? label : '$label · camera off'),
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
