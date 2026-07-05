import 'package:json_annotation/json_annotation.dart';

part 'ranking_summary.g.dart';

@JsonSerializable(createToJson: false)
class RankingSummary {
  const RankingSummary({
    required this.elo,
    required this.tier,
    required this.rank,
    required this.totalDebates,
    required this.wins,
    required this.losses,
    required this.draws,
  });

  @JsonKey(defaultValue: 1000)
  final int elo;
  @JsonKey(defaultValue: 'Novice')
  final String tier;
  @JsonKey(defaultValue: 0)
  final int rank;
  @JsonKey(defaultValue: 0)
  final int totalDebates;
  @JsonKey(defaultValue: 0)
  final int wins;
  @JsonKey(defaultValue: 0)
  final int losses;
  @JsonKey(defaultValue: 0)
  final int draws;

  factory RankingSummary.fromJson(Map<String, dynamic> json) =>
      _$RankingSummaryFromJson(json);
}
