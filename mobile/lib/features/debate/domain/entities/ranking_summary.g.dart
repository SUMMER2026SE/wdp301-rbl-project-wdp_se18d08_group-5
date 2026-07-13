// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ranking_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RankingSummary _$RankingSummaryFromJson(Map<String, dynamic> json) =>
    RankingSummary(
      elo: (json['elo'] as num?)?.toInt() ?? 1000,
      tier: json['tier'] as String? ?? 'Novice',
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      totalDebates: (json['totalDebates'] as num?)?.toInt() ?? 0,
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      draws: (json['draws'] as num?)?.toInt() ?? 0,
    );
