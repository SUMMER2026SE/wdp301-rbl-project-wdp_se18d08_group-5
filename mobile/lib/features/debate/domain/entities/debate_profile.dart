import 'package:flutter_riverpod_clean_architecture/features/auth/domain/entities/user_entity.dart';
import 'package:json_annotation/json_annotation.dart';

import 'json_helpers.dart';

part 'debate_profile.g.dart';

@JsonSerializable(createToJson: false)
class DebateProfile {
  const DebateProfile({
    required this.id,
    required this.username,
    required this.email,
    required this.displayName,
    required this.avatar,
    required this.bio,
    required this.school,
    required this.club,
    required this.elo,
    required this.tier,
    required this.totalDebates,
    required this.wins,
    required this.losses,
    required this.draws,
  });

  @JsonKey(readValue: readId, defaultValue: '')
  final String id;
  @JsonKey(defaultValue: '')
  final String username;
  @JsonKey(defaultValue: '')
  final String email;
  @JsonKey(readValue: readProfileDisplayName, defaultValue: '')
  final String displayName;
  @JsonKey(readValue: readProfileAvatar, defaultValue: '')
  final String avatar;
  @JsonKey(readValue: readProfileBio, defaultValue: '')
  final String bio;
  @JsonKey(readValue: readProfileSchool, defaultValue: '')
  final String school;
  @JsonKey(readValue: readProfileClub, defaultValue: '')
  final String club;
  @JsonKey(readValue: readRankingElo, defaultValue: 1000)
  final int elo;
  @JsonKey(readValue: readRankingTier, defaultValue: '')
  final String tier;
  @JsonKey(readValue: readStatsTotalDebates, defaultValue: 0)
  final int totalDebates;
  @JsonKey(readValue: readStatsWins, defaultValue: 0)
  final int wins;
  @JsonKey(readValue: readStatsLosses, defaultValue: 0)
  final int losses;
  @JsonKey(readValue: readStatsDraws, defaultValue: 0)
  final int draws;

  String get name => displayName.isNotEmpty ? displayName : username;

  UserEntity toUserEntity() {
    return UserEntity(id: id, name: name, email: email, profilePicture: avatar);
  }

  factory DebateProfile.fromJson(Map<String, dynamic> json) =>
      _$DebateProfileFromJson(json);
}
