import 'package:json_annotation/json_annotation.dart';

part 'history_item.g.dart';

@JsonSerializable(createToJson: false)
class HistoryItem {
  const HistoryItem({
    required this.sessionId,
    required this.roomId,
    required this.roomTitle,
    required this.motion,
    required this.format,
    required this.result,
    required this.userSide,
    required this.endedAt,
  });

  @JsonKey(defaultValue: '')
  final String sessionId;
  @JsonKey(defaultValue: '')
  final String roomId;
  @JsonKey(defaultValue: '')
  final String roomTitle;
  @JsonKey(defaultValue: '')
  final String motion;
  @JsonKey(defaultValue: '')
  final String format;
  @JsonKey(defaultValue: '')
  final String result;
  @JsonKey(defaultValue: '')
  final String userSide;
  @JsonKey(defaultValue: '')
  final String endedAt;

  factory HistoryItem.fromJson(Map<String, dynamic> json) =>
      _$HistoryItemFromJson(json);
}
