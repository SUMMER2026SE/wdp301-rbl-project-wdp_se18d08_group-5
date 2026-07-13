// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'leaderboard_entry.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LeaderboardEntry _$LeaderboardEntryFromJson(Map<String, dynamic> json) =>
    LeaderboardEntry(
      id: readId(json, 'id') as String? ?? '',
      username: json['username'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      avatar: json['avatar'] as String? ?? '',
      elo: (json['elo'] as num?)?.toInt() ?? 1000,
      tier: json['tier'] as String? ?? '',
      wins: (json['wins'] as num?)?.toInt() ?? 0,
      losses: (json['losses'] as num?)?.toInt() ?? 0,
      draws: (json['draws'] as num?)?.toInt() ?? 0,
      rank: (json['rank'] as num?)?.toInt() ?? 0,
    );
