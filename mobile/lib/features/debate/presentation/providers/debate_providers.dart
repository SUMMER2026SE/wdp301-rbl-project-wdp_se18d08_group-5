import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/core/constants/app_constants.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/repositories/debate_repository_impl.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

final dashboardProvider = FutureProvider<DashboardData>((ref) async {
  final repository = ref.watch(debateRepositoryProvider);
  final profile = await repository.me();
  final ranking = await repository.rankingForUser(profile.id);
  return DashboardData(profile: profile, ranking: ranking);
});

final leaderboardProvider = FutureProvider<List<LeaderboardEntry>>((ref) {
  return ref.watch(debateRepositoryProvider).leaderboard();
});

final profileProvider = FutureProvider.family<DebateProfile, String>((
  ref,
  userId,
) {
  return ref.watch(debateRepositoryProvider).profile(userId);
});

final historyProvider = FutureProvider.family<List<HistoryItem>, String>((
  ref,
  userId,
) {
  return ref.watch(debateRepositoryProvider).history(userId);
});

final roomProvider = FutureProvider.family<DebateRoomModel, String>((
  ref,
  roomId,
) {
  return ref.watch(debateRepositoryProvider).room(roomId);
});

final roomListProvider = FutureProvider<List<DebateRoomModel>>((ref) {
  return ref.watch(debateRepositoryProvider).rooms(status: 'waiting');
});

final sessionProvider = FutureProvider.family<Map<String, dynamic>, String>((
  ref,
  roomId,
) {
  return ref.watch(debateRepositoryProvider).session(roomId);
});

final resultProvider = FutureProvider.family<SessionResult, String>((
  ref,
  roomId,
) {
  return ref.watch(debateRepositoryProvider).result(roomId);
});

final roomRealtimeProvider = Provider.family<void, String>((ref, roomId) {
  var disposed = false;
  io.Socket? socket;

  void refresh(dynamic _) {
    if (disposed) return;
    ref.invalidate(roomProvider(roomId));
    ref.invalidate(sessionProvider(roomId));
    ref.invalidate(resultProvider(roomId));
  }

  ref.read(debateRepositoryProvider).accessToken().then((token) {
    if (disposed || token.isEmpty) return;
    socket = io.io(
      AppConstants.socketBaseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .build(),
    );
    socket!
      ..onConnect((_) => socket!.emit('room:join', {'roomId': roomId}))
      ..on('room:joined', refresh)
      ..on('room:state-restore', refresh)
      ..on('room:state-updated', refresh)
      ..on('room:participant-update', refresh)
      ..on('room:motion-updated', refresh)
      ..on('debate:started', refresh)
      ..on('debate:phase-change', refresh)
      ..on('debate:timer-update', refresh)
      ..on('debate:paused', refresh)
      ..on('debate:resumed', refresh)
      ..on('debate:ended', refresh)
      ..on('score:aggregate-updated', refresh)
      ..connect();
  });

  ref.onDispose(() {
    disposed = true;
    socket?.emit('room:leave', {'roomId': roomId});
    socket?.dispose();
  });
});

class QueueController extends AsyncNotifier<QueueStatus> {
  Timer? _timer;

  @override
  Future<QueueStatus> build() async {
    ref.onDispose(() => _timer?.cancel());
    return ref.watch(debateRepositoryProvider).queueStatus();
  }

  Future<void> join(String format) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final status = await ref.read(debateRepositoryProvider).joinQueue(format);
      _startPolling();
      return status;
    });
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(debateRepositoryProvider).queueStatus(),
    );
  }

  Future<void> leave() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      await ref.read(debateRepositoryProvider).leaveQueue();
      _timer?.cancel();
      return const QueueStatus(
        status: 'idle',
        format: '',
        waitTime: 0,
        eloRange: 0,
        roomId: '',
      );
    });
  }

  void _startPolling() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) async {
      final next = await AsyncValue.guard(
        () => ref.read(debateRepositoryProvider).queueStatus(),
      );
      state = next;
      final value = next.whenOrNull(data: (value) => value);
      if (value == null ||
          value.status == 'matched' ||
          value.status == 'idle') {
        _timer?.cancel();
      }
    });
  }
}

final queueControllerProvider =
    AsyncNotifierProvider<QueueController, QueueStatus>(QueueController.new);
