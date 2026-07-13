Map<String, dynamic> asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.map((key, value) => MapEntry('$key', value));
  return <String, dynamic>{};
}

List<dynamic> asList(dynamic value) => value is List ? value : const [];

Object? readId(Map<dynamic, dynamic> json, String key) =>
    json['_id'] ?? json['id'];

Object? readUserId(Map<dynamic, dynamic> json, String key) {
  final value = json['userId'] ?? json['_id'] ?? json['id'];
  return value?.toString();
}

Object? readProfileDisplayName(Map<dynamic, dynamic> json, String key) {
  return asMap(json['profile'])['displayName'];
}

Object? readProfileAvatar(Map<dynamic, dynamic> json, String key) {
  return asMap(json['profile'])['avatar'];
}

Object? readProfileBio(Map<dynamic, dynamic> json, String key) {
  return asMap(json['profile'])['bio'];
}

Object? readProfileSchool(Map<dynamic, dynamic> json, String key) {
  return asMap(json['profile'])['school'];
}

Object? readProfileClub(Map<dynamic, dynamic> json, String key) {
  return asMap(json['profile'])['club'];
}

Object? readRankingElo(Map<dynamic, dynamic> json, String key) {
  return asMap(json['ranking'])['elo'] ?? json['elo'];
}

Object? readRankingTier(Map<dynamic, dynamic> json, String key) {
  final value = asMap(json['ranking'])['tier'] ?? json['tier'];
  if (value == null || value.toString().isEmpty) return 'Novice';
  return value;
}

Object? readStatsTotalDebates(Map<dynamic, dynamic> json, String key) {
  return asMap(json['stats'])['totalDebates'] ?? json['totalDebates'];
}

Object? readStatsWins(Map<dynamic, dynamic> json, String key) {
  return asMap(json['stats'])['wins'] ?? json['wins'];
}

Object? readStatsLosses(Map<dynamic, dynamic> json, String key) {
  return asMap(json['stats'])['losses'] ?? json['losses'];
}

Object? readStatsDraws(Map<dynamic, dynamic> json, String key) {
  return asMap(json['stats'])['draws'] ?? json['draws'];
}

Object? readRoomRole(Map<dynamic, dynamic> json, String key) {
  return json['roomRole'] ?? json['role'];
}

Object? readQueueStatus(Map<dynamic, dynamic> json, String key) {
  final value = json['status'];
  if (value == null || value.toString().isEmpty) return 'idle';
  return value;
}
