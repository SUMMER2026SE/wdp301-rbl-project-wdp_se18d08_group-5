// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room_participant.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoomParticipant _$RoomParticipantFromJson(Map<String, dynamic> json) =>
    RoomParticipant(
      userId: readUserId(json, 'userId') as String? ?? '',
      username: json['username'] as String? ?? '',
      avatar: json['avatar'] as String? ?? '',
      role: readRoomRole(json, 'role') as String? ?? '',
      primaryRole: json['primaryRole'] as String? ?? '',
      team: json['team'] as String? ?? '',
      speakerSlot: json['speakerSlot'] as String? ?? '',
      positionLocked: json['positionLocked'] as bool? ?? false,
      muted: json['muted'] as bool? ?? false,
    );
