import 'package:json_annotation/json_annotation.dart';

import 'json_helpers.dart';

part 'leaderboard_entry.g.dart';

@JsonSerializable(createToJson: false)
class LeaderboardEntry {
  const LeaderboardEntry({
    required this.id,
    required this.username,
    required this.displayName,
    required this.avatar,
    required this.elo,
    required this.tier,
    required this.wins,
    required this.losses,
    required this.draws,
    required this.rank,
  });

  @JsonKey(readValue: readId, defaultValue: '')
  final String id;
  @JsonKey(defaultValue: '')
  final String username;
  @JsonKey(defaultValue: '')
  final String displayName;
  @JsonKey(defaultValue: '')
  final String avatar;
  @JsonKey(defaultValue: 1000)
  final int elo;
  @JsonKey(defaultValue: '')
  final String tier;
  @JsonKey(defaultValue: 0)
  final int wins;
  @JsonKey(defaultValue: 0)
  final int losses;
  @JsonKey(defaultValue: 0)
  final int draws;
  @JsonKey(defaultValue: 0)
  final int rank;

  String get name => displayName.isNotEmpty ? displayName : username;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardEntryFromJson(json);
}
