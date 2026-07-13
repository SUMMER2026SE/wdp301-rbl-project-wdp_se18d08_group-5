import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/auth/presentation/providers/auth_provider.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/providers/debate_providers.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/debate_shared_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/ios_debate_widgets.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/presentation/widgets/screen_state_widgets.dart';
import 'package:go_router/go_router.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider(userId));
    final authUser = ref.watch(authProvider).user;
    final isMe = authUser?.id == userId;

    return DebatePage(
      title: 'Profile',
      subtitle: isMe ? 'Hồ sơ tranh biện của bạn.' : 'Hồ sơ người chơi.',
      actions: [
        if (isMe)
          IconButton(
            onPressed: () =>
                context.push('${AppConstants.profileRoute}/$userId/edit'),
            icon: const Icon(Icons.edit_rounded),
          ),
      ],
      child: debateAsyncBody(
        value: profile,
        data: (data) => Column(
          children: [
            DebateCard(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  DebateAvatar(
                    name: data.name,
                    imageUrl: data.avatar,
                    radius: 42,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    data.name.isEmpty ? 'Debater' : data.name,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '@${data.username}',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  if (data.bio.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(
                        data.bio,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            DebateCard(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  DebateStatTile(label: 'ELO', value: '${data.elo}'),
                  const SizedBox(width: 8),
                  DebateStatTile(label: 'Tier', value: data.tier),
                  const SizedBox(width: 8),
                  DebateStatTile(label: 'Trận', value: '${data.totalDebates}'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () =>
                  context.push('${AppConstants.profileRoute}/$userId/history'),
              icon: const Icon(Icons.history),
              label: const Text('Xem lịch sử debate'),
            ),
            const SizedBox(height: 92),
          ],
        ),
      ),
    );
  }
}

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key, required this.userId});

  final String userId;

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _displayName = TextEditingController();
  final _bio = TextEditingController();
  final _school = TextEditingController();
  final _club = TextEditingController();
  bool _seeded = false;
  bool _saving = false;

  @override
  void dispose() {
    _displayName.dispose();
    _bio.dispose();
    _school.dispose();
    _club.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(profileProvider(widget.userId));
    return DebatePage(
      title: 'Sửa hồ sơ',
      child: debateAsyncBody(
        value: profile,
        data: (data) {
          if (!_seeded) {
            _displayName.text = data.displayName;
            _bio.text = data.bio;
            _school.text = data.school;
            _club.text = data.club;
            _seeded = true;
          }
          return DebateCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _displayName,
                  decoration: const InputDecoration(labelText: 'Tên hiển thị'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _bio,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Bio'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _school,
                  decoration: const InputDecoration(labelText: 'Trường'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _club,
                  decoration: const InputDecoration(labelText: 'CLB'),
                ),
                const SizedBox(height: 16),
                DebatePrimaryButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          setState(() => _saving = true);
                          try {
                            await ref
                                .read(debateRepositoryProvider)
                                .updateProfile(widget.userId, {
                                  'displayName': _displayName.text.trim(),
                                  'bio': _bio.text.trim(),
                                  'school': _school.text.trim(),
                                  'club': _club.text.trim(),
                                });
                            ref.invalidate(profileProvider(widget.userId));
                            if (context.mounted) {
                              context.pop();
                            }
                          } catch (error) {
                            if (context.mounted) {
                              showDebateSnack(context, error.toString());
                            }
                          } finally {
                            if (mounted) setState(() => _saving = false);
                          }
                        },
                  icon: Icons.save_rounded,
                  label: 'Lưu',
                  loading: _saving,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(historyProvider(userId));
    return DebatePage(
      title: 'Lịch sử',
      child: debateAsyncBody(
        value: history,
        data: (items) {
          if (items.isEmpty) {
            return const DebateEmptyState(
              icon: Icons.history_rounded,
              title: 'Chưa có trận đã hoàn thành',
              message: 'Các trận debate đã kết thúc sẽ nằm ở đây.',
            );
          }
          return Column(
            children: [
              for (final entry in items.asMap().entries) ...[
                DebateCard(
                  onTap: () => context.push('/results/${entry.value.roomId}'),
                  child: Row(
                    children: [
                      Icon(
                        entry.value.result == 'win'
                            ? Icons.trending_up_rounded
                            : entry.value.result == 'loss'
                            ? Icons.trending_down_rounded
                            : Icons.drag_handle_rounded,
                        color: entry.value.result == 'win'
                            ? DebateColors.mint
                            : entry.value.result == 'loss'
                            ? DebateColors.rose
                            : DebateColors.muted,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entry.value.roomTitle.isEmpty
                                  ? entry.value.motion
                                  : entry.value.roomTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${entry.value.format} · ${entry.value.userSide} · ${entry.value.endedAt}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                      DebatePill(
                        label: entry.value.result.isEmpty
                            ? '-'
                            : entry.value.result,
                        color: entry.value.result == 'win'
                            ? DebateColors.mint
                            : entry.value.result == 'loss'
                            ? DebateColors.rose
                            : DebateColors.muted,
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
}
