// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'debate_profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DebateProfile _$DebateProfileFromJson(Map<String, dynamic> json) =>
    DebateProfile(
      id: readId(json, 'id') as String? ?? '',
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      displayName: readProfileDisplayName(json, 'displayName') as String? ?? '',
      avatar: readProfileAvatar(json, 'avatar') as String? ?? '',
      bio: readProfileBio(json, 'bio') as String? ?? '',
      school: readProfileSchool(json, 'school') as String? ?? '',
      club: readProfileClub(json, 'club') as String? ?? '',
      elo: (readRankingElo(json, 'elo') as num?)?.toInt() ?? 1000,
      tier: readRankingTier(json, 'tier') as String? ?? '',
      totalDebates:
          (readStatsTotalDebates(json, 'totalDebates') as num?)?.toInt() ?? 0,
      wins: (readStatsWins(json, 'wins') as num?)?.toInt() ?? 0,
      losses: (readStatsLosses(json, 'losses') as num?)?.toInt() ?? 0,
      draws: (readStatsDraws(json, 'draws') as num?)?.toInt() ?? 0,
    );
