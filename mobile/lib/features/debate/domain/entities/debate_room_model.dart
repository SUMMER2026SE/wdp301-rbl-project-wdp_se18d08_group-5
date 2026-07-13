import 'package:json_annotation/json_annotation.dart';

import 'json_helpers.dart';
import 'room_participant.dart';

part 'debate_room_model.g.dart';

@JsonSerializable(createToJson: false)
class DebateRoomModel {
  const DebateRoomModel({
    required this.id,
    required this.title,
    required this.motion,
    required this.format,
    required this.status,
    required this.roomType,
    required this.hostType,
    required this.judgeType,
    required this.createdBy,
    required this.currentPhase,
    required this.participants,
  });

  @JsonKey(readValue: readId, defaultValue: '')
  final String id;
  @JsonKey(defaultValue: '')
  final String title;
  @JsonKey(defaultValue: '')
  final String motion;
  @JsonKey(defaultValue: '')
  final String format;
  @JsonKey(defaultValue: '')
  final String status;
  @JsonKey(defaultValue: '')
  final String roomType;
  @JsonKey(defaultValue: '')
  final String hostType;
  @JsonKey(defaultValue: '')
  final String judgeType;
  @JsonKey(defaultValue: '')
  final String createdBy;
  @JsonKey(defaultValue: '')
  final String currentPhase;
  @JsonKey(defaultValue: <RoomParticipant>[])
  final List<RoomParticipant> participants;

  factory DebateRoomModel.fromJson(Map<String, dynamic> json) =>
      _$DebateRoomModelFromJson(json);
}
