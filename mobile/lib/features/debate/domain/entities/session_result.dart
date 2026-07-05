import 'debate_room_model.dart';

class SessionResult {
  const SessionResult({
    required this.room,
    required this.session,
    required this.finalScores,
  });

  final DebateRoomModel? room;
  final Map<String, dynamic> session;
  final Map<String, dynamic> finalScores;
}
