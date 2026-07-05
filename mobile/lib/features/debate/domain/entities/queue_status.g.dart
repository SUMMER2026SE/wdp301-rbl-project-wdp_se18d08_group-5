// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'queue_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QueueStatus _$QueueStatusFromJson(Map<String, dynamic> json) => QueueStatus(
  status: json['status'] as String? ?? 'idle',
  format: json['format'] as String? ?? '',
  waitTime: (json['waitTime'] as num?)?.toInt() ?? 0,
  eloRange: (json['eloRange'] as num?)?.toInt() ?? 0,
  roomId: json['roomId'] as String? ?? '',
);
