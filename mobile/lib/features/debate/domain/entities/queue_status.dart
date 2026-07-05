import 'package:json_annotation/json_annotation.dart';

part 'queue_status.g.dart';

@JsonSerializable(createToJson: false)
class QueueStatus {
  const QueueStatus({
    required this.status,
    required this.format,
    required this.waitTime,
    required this.eloRange,
    required this.roomId,
  });

  @JsonKey(defaultValue: 'idle')
  final String status;
  @JsonKey(defaultValue: '')
  final String format;
  @JsonKey(defaultValue: 0)
  final int waitTime;
  @JsonKey(defaultValue: 0)
  final int eloRange;
  @JsonKey(defaultValue: '')
  final String roomId;

  factory QueueStatus.fromJson(Map<String, dynamic> json) =>
      _$QueueStatusFromJson(json);
}
