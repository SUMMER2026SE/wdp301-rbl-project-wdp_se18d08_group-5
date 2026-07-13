// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'debate_room_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DebateRoomModel _$DebateRoomModelFromJson(Map<String, dynamic> json) =>
    DebateRoomModel(
      id: readId(json, 'id') as String? ?? '',
      title: json['title'] as String? ?? '',
      motion: json['motion'] as String? ?? '',
      format: json['format'] as String? ?? '',
      status: json['status'] as String? ?? '',
      roomType: json['roomType'] as String? ?? '',
      hostType: json['hostType'] as String? ?? '',
      judgeType: json['judgeType'] as String? ?? '',
      createdBy: json['createdBy'] as String? ?? '',
      currentPhase: json['currentPhase'] as String? ?? '',
      participants:
          (json['participants'] as List<dynamic>?)
              ?.map((e) => RoomParticipant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
