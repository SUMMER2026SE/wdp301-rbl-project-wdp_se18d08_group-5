import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/data/datasources/debate_remote_data_source.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';
import 'package:flutter_riverpod_clean_architecture/features/debate/domain/repositories/debate_repository.dart';

class DebateRepositoryImpl implements DebateRepository {
  DebateRepositoryImpl({required DebateRemoteDataSource remoteDataSource})
    : _remoteDataSource = remoteDataSource;

  final DebateRemoteDataSource _remoteDataSource;

  @override
  Future<String> accessToken() => _remoteDataSource.accessToken();

  @override
  Future<void> changePassword(String currentPassword, String newPassword) =>
      _remoteDataSource.changePassword(currentPassword, newPassword);

  @override
  Future<DebateRoomModel> createRoom({
    required String title,
    required String motion,
    required String format,
  }) => _remoteDataSource.createRoom(
    title: title,
    motion: motion,
    format: format,
  );

  @override
  Future<void> forgotPassword(String email) =>
      _remoteDataSource.forgotPassword(email);

  @override
  Future<bool> hasToken() => _remoteDataSource.hasToken();

  @override
  Future<List<HistoryItem>> history(String userId) =>
      _remoteDataSource.history(userId);

  @override
  Future<QueueStatus> joinQueue(String format) =>
      _remoteDataSource.joinQueue(format);

  @override
  Future<DebateRoomModel> joinRoom(String roomId) =>
      _remoteDataSource.joinRoom(roomId);

  @override
  Future<void> leaveRoom(String roomId) => _remoteDataSource.leaveRoom(roomId);

  @override
  Future<List<LeaderboardEntry>> leaderboard() =>
      _remoteDataSource.leaderboard();

  @override
  Future<void> leaveQueue() => _remoteDataSource.leaveQueue();

  @override
  Future<DebateProfile> login(String email, String password) =>
      _remoteDataSource.login(email, password);

  @override
  Future<void> logout() => _remoteDataSource.logout();

  @override
  Future<DebateProfile> me() => _remoteDataSource.me();

  @override
  Future<DebateProfile> profile(String userId) =>
      _remoteDataSource.profile(userId);

  @override
  Future<QueueStatus> queueStatus() => _remoteDataSource.queueStatus();

  @override
  Future<RankingSummary> rankingForUser(String userId) =>
      _remoteDataSource.rankingForUser(userId);

  @override
  Future<SessionResult> result(String roomId) =>
      _remoteDataSource.result(roomId);

  @override
  Future<DebateRoomModel> room(String roomId) => _remoteDataSource.room(roomId);

  @override
  Future<List<DebateRoomModel>> rooms({String? status}) =>
      _remoteDataSource.rooms(status: status);

  @override
  Future<DebateProfile> register(
    String username,
    String email,
    String password,
  ) => _remoteDataSource.register(username, email, password);

  @override
  Future<DebateRoomModel> selectPosition(
    String roomId,
    String team,
    String speakerSlot,
  ) => _remoteDataSource.selectPosition(roomId, team, speakerSlot);

  @override
  Future<Map<String, dynamic>> session(String roomId) =>
      _remoteDataSource.session(roomId);

  @override
  Future<void> startRoom(String roomId) => _remoteDataSource.startRoom(roomId);

  @override
  Future<void> lockRoom(String roomId) => _remoteDataSource.lockRoom(roomId);

  @override
  Future<void> requestDraw(String roomId) =>
      _remoteDataSource.requestDraw(roomId);

  @override
  Future<void> submitJudgeScore(String roomId, Map<String, dynamic> data) =>
      _remoteDataSource.submitJudgeScore(roomId, data);

  @override
  Future<void> surrender(String roomId) => _remoteDataSource.surrender(roomId);

  @override
  Future<DebateProfile> updateProfile(
    String userId,
    Map<String, String> data,
  ) => _remoteDataSource.updateProfile(userId, data);

  @override
  Future<String> uploadAvatar(Uint8List bytes, String filename) =>
      _remoteDataSource.uploadAvatar(bytes, filename);
}

final debateRemoteDataSourceProvider = Provider<DebateRemoteDataSource>((ref) {
  return DebateRemoteDataSource();
});

final debateRepositoryProvider = Provider<DebateRepository>((ref) {
  return DebateRepositoryImpl(
    remoteDataSource: ref.watch(debateRemoteDataSourceProvider),
  );
});
