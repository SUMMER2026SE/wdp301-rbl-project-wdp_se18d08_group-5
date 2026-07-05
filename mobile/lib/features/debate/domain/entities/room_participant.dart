import 'package:json_annotation/json_annotation.dart';

import 'json_helpers.dart';

part 'room_participant.g.dart';

@JsonSerializable(createToJson: false)
class RoomParticipant {
  const RoomParticipant({
    required this.userId,
    required this.username,
    required this.avatar,
    required this.role,
    required this.primaryRole,
    required this.team,
    required this.speakerSlot,
    required this.positionLocked,
    required this.muted,
  });

  @JsonKey(readValue: readUserId, defaultValue: '')
  final String userId;
  @JsonKey(defaultValue: '')
  final String username;
  @JsonKey(defaultValue: '')
  final String avatar;
  @JsonKey(readValue: readRoomRole, defaultValue: '')
  final String role;
  @JsonKey(defaultValue: '')
  final String primaryRole;
  @JsonKey(defaultValue: '')
  final String team;
  @JsonKey(defaultValue: '')
  final String speakerSlot;
  @JsonKey(defaultValue: false)
  final bool positionLocked;
  @JsonKey(defaultValue: false)
  final bool muted;

  String get effectiveRole =>
      role == 'owner' && primaryRole.isNotEmpty ? primaryRole : role;

  factory RoomParticipant.fromJson(Map<String, dynamic> json) =>
      _$RoomParticipantFromJson(json);
}
