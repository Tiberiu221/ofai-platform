import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

class GamificationData {
  final int points;
  final String level;
  final String levelIcon;
  final String? nextLevelName;
  final int? nextLevelMinPoints;
  final int currentStreak;
  final List<BadgeData> badges;
  final List<BadgeData> allBadges;

  GamificationData({
    required this.points,
    required this.level,
    required this.levelIcon,
    this.nextLevelName,
    this.nextLevelMinPoints,
    required this.currentStreak,
    required this.badges,
    required this.allBadges,
  });

  factory GamificationData.fromJson(Map<String, dynamic> json) {
    return GamificationData(
      points: json['points'] as int? ?? 0,
      level: json['level'] as String? ?? 'Explorator',
      levelIcon: json['level_icon'] as String? ?? 'explore',
      nextLevelName: json['next_level']?['name'] as String?,
      nextLevelMinPoints: json['next_level']?['min_points'] as int?,
      currentStreak: json['current_streak'] as int? ?? 0,
      badges: (json['badges'] as List? ?? [])
          .map((b) => BadgeData.fromJson(b as Map<String, dynamic>))
          .toList(),
      allBadges: (json['all_badges'] as List? ?? [])
          .map((b) => BadgeData.fromJson(b as Map<String, dynamic>))
          .toList(),
    );
  }

  /// Progress toward next level, 0.0–1.0.
  double get levelProgress {
    if (nextLevelMinPoints == null) return 1.0;
    // Known level thresholds (must match backend).
    const levelMins = [0, 100, 500, 1500];
    int currentMin = 0;
    for (final min in levelMins) {
      if (points >= min) currentMin = min;
    }
    final range = nextLevelMinPoints! - currentMin;
    if (range <= 0) return 1.0;
    return ((points - currentMin) / range).clamp(0.0, 1.0);
  }
}

class BadgeData {
  final String type;
  final String label;
  final String description;
  final String icon;
  final bool unlocked;
  final String? unlockedAt;

  BadgeData({
    required this.type,
    required this.label,
    required this.description,
    required this.icon,
    required this.unlocked,
    this.unlockedAt,
  });

  factory BadgeData.fromJson(Map<String, dynamic> json) {
    return BadgeData(
      type: json['type'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      icon: json['icon'] as String? ?? 'emoji_events',
      unlocked: json['unlocked'] as bool? ?? (json['unlocked_at'] != null),
      unlockedAt: json['unlocked_at'] as String?,
    );
  }
}

final gamificationProvider = FutureProvider.autoDispose<GamificationData?>((ref) async {
  try {
    final response = await ApiClient().dio.get(ApiEndpoints.gamification);
    if (response.statusCode == 200 && response.data != null) {
      return GamificationData.fromJson(response.data as Map<String, dynamic>);
    }
  } catch (_) {}
  return null;
});
