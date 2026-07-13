import 'debate_profile.dart';
import 'ranking_summary.dart';

class DashboardData {
  const DashboardData({required this.profile, required this.ranking});

  final DebateProfile profile;
  final RankingSummary ranking;
}
