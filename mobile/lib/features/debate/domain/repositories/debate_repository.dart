import 'package:flutter_riverpod_clean_architecture/features/debate/domain/entities/debate_entities.dart';

abstract class DebateRepository {
  Future<String> accessToken();
  Future<bool> hasToken();
  Future<DebateProfile> login(String email, String password);
  Future<DebateProfile> register(
    String username,
    String email,
    String password,
  );
  Future<void> forgotPassword(String email);
  Future<void> changePassword(String currentPassword, String newPassword);
  Future<DebateProfile> me();
  Future<void> logout();
  Future<RankingSummary> rankingForUser(String userId);
  Future<List<LeaderboardEntry>> leaderboard();
  Future<DebateProfile> profile(String userId);
  Future<DebateProfile> updateProfile(String userId, Map<String, String> data);
  Future<List<HistoryItem>> history(String userId);
  Future<QueueStatus> joinQueue(String format);
  Future<QueueStatus> queueStatus();
  Future<void> leaveQueue();
  Future<List<DebateRoomModel>> rooms({String? status});
  Future<DebateRoomModel> room(String roomId);
  Future<DebateRoomModel> createRoom({
    required String title,
    required String motion,
    required String format,
  });
  Future<DebateRoomModel> joinRoom(String roomId);
  Future<DebateRoomModel> selectPosition(
    String roomId,
    String team,
    String speakerSlot,
  );
  Future<void> lockRoom(String roomId);
  Future<void> startRoom(String roomId);
  Future<Map<String, dynamic>> session(String roomId);
  Future<void> surrender(String roomId);
  Future<void> requestDraw(String roomId);
  Future<void> submitJudgeScore(String roomId, Map<String, dynamic> data);
  Future<SessionResult> result(String roomId);
}
