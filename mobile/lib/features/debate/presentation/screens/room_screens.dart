import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class CreateRoomScreen extends ConsumerStatefulWidget {
  const CreateRoomScreen({super.key});

  @override
  ConsumerState<CreateRoomScreen> createState() => _CreateRoomScreenState();
}

class _CreateRoomScreenState extends ConsumerState<CreateRoomScreen> {
  final _title = TextEditingController(text: 'Practice Debate');
  final _motion = TextEditingController();
  String _format = '1v1';
  bool _saving = false;

  @override
  void dispose() {
    _title.dispose();
    _motion.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DebatePage(
      title: 'Tạo phòng',
      subtitle: 'Tạo một phòng luyện tập nhanh.',
      child: DebateCard(
        child: Column(
          children: [
            TextField(
              controller: _title,
              decoration: const InputDecoration(labelText: 'Tên phòng'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _motion,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'Motion'),
            ),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: '1v1',
                  icon: Icon(Icons.person_rounded),
                  label: Text('1v1'),
                ),
                ButtonSegment(
                  value: '3v3',
                  icon: Icon(Icons.groups_rounded),
                  label: Text('3v3'),
                ),
              ],
              selected: {_format},
              onSelectionChanged: (value) =>
                  setState(() => _format = value.first),
            ),
            const SizedBox(height: 16),
            DebatePrimaryButton(
              onPressed: _saving
                  ? null
                  : () async {
                      setState(() => _saving = true);
                      try {
                        final room = await ref
                            .read(debateRepositoryProvider)
                            .createRoom(
                              title: _title.text.trim(),
                              motion: _motion.text.trim(),
                              format: _format,
                            );
                        if (context.mounted) {
                          context.go('/rooms/${room.id}/lobby');
                        }
                      } catch (error) {
                        if (context.mounted) {
                          showDebateSnack(context, error.toString());
                        }
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    },
              icon: Icons.add_rounded,
              label: 'Tạo phòng',
              loading: _saving,
            ),
          ],
        ),
      ),
    );
  }
}

class LobbyScreen extends ConsumerWidget {
  const LobbyScreen({super.key, required this.roomId});

  final String roomId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(roomRealtimeProvider(roomId));
    final room = ref.watch(roomProvider(roomId));
    return DebatePage(
      title: 'Lobby',
      subtitle: 'Chuẩn bị vị trí trước khi vào debate.',
      onRefresh: () => ref.refresh(roomProvider(roomId).future),
      child: debateAsyncBody(
        value: room,
        data: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DebateRoomHeader(room: data),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () async {
                final messenger = ScaffoldMessenger.of(context);
                try {
                  await ref.read(debateRepositoryProvider).joinRoom(roomId);
                  ref.invalidate(roomProvider(roomId));
                } catch (error) {
                  messenger.showSnackBar(
                    SnackBar(content: Text(error.toString())),
                  );
                }
              },
              icon: const Icon(Icons.login_rounded),
              label: const Text('Tham gia phòng'),
            ),
            const SizedBox(height: 12),
            _PositionControls(roomId: roomId),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () => context.go('/debate/$roomId'),
              icon: const Icon(Icons.mic_rounded),
              label: const Text('Vào phòng debate'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () async {
                try {
                  await ref.read(debateRepositoryProvider).lockRoom(roomId);
                  await ref.read(debateRepositoryProvider).startRoom(roomId);
                  if (context.mounted) {
                    context.go('/debate/$roomId');
                  }
                } catch (error) {
                  if (context.mounted) {
                    showDebateSnack(context, error.toString());
                  }
                }
              },
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Lock & Start nếu đủ quyền'),
            ),
            const SizedBox(height: 16),
            const DebateSectionTitle(title: 'Người tham gia'),
            ...data.participants.map(
              (participant) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: DebateCard(
                  child: Row(
                    children: [
                      DebateAvatar(name: participant.username, radius: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              participant.username,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${participant.effectiveRole} · ${participant.team} ${participant.speakerSlot}',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        participant.positionLocked
                            ? Icons.lock_rounded
                            : Icons.lock_open_rounded,
                        color: DebateColors.muted,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class _PositionControls extends ConsumerStatefulWidget {
  const _PositionControls({required this.roomId});

  final String roomId;

  @override
  ConsumerState<_PositionControls> createState() => _PositionControlsState();
}

class _PositionControlsState extends ConsumerState<_PositionControls> {
  String _team = 'proposition';
  String _slot = 'S1';

  @override
  Widget build(BuildContext context) {
    return DebateCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Vị trí debate', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'proposition', label: Text('Prop')),
              ButtonSegment(value: 'opposition', label: Text('Opp')),
            ],
            selected: {_team},
            onSelectionChanged: (value) => setState(() => _team = value.first),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'S1', label: Text('S1')),
              ButtonSegment(value: 'S2', label: Text('S2')),
              ButtonSegment(value: 'S3', label: Text('S3')),
            ],
            selected: {_slot},
            onSelectionChanged: (value) => setState(() => _slot = value.first),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () async {
              try {
                await ref
                    .read(debateRepositoryProvider)
                    .selectPosition(widget.roomId, _team, _slot);
                ref.invalidate(roomProvider(widget.roomId));
              } catch (error) {
                if (context.mounted) {
                  showDebateSnack(context, error.toString());
                }
              }
            },
            icon: const Icon(Icons.check_rounded),
            label: const Text('Chọn vị trí'),
          ),
        ],
      ),
    );
  }
}
