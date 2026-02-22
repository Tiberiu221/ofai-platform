import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

class GamificationState {
  final int points;
  final int level;
  final String levelName;
  final double progress; // 0.0 to 1.0 progress to next level
  final int nextLevelPoints;
  final int currentStreak;
  final int longestStreak;
  final bool isLoading;
  final String? error;

  const GamificationState({
    this.points = 0,
    this.level = 1,
    this.levelName = 'Explorator',
    this.progress = 0.0,
    this.nextLevelPoints = 10,
    this.currentStreak = 0,
    this.longestStreak = 0,
    this.isLoading = false,
    this.error,
  });

  GamificationState copyWith({
    int? points,
    int? level,
    String? levelName,
    double? progress,
    int? nextLevelPoints,
    int? currentStreak,
    int? longestStreak,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return GamificationState(
      points: points ?? this.points,
      level: level ?? this.level,
      levelName: levelName ?? this.levelName,
      progress: progress ?? this.progress,
      nextLevelPoints: nextLevelPoints ?? this.nextLevelPoints,
      currentStreak: currentStreak ?? this.currentStreak,
      longestStreak: longestStreak ?? this.longestStreak,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class GamificationNotifier extends StateNotifier<GamificationState> {
  final ApiClient _api;

  GamificationNotifier(this._api) : super(const GamificationState());

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.gamification);
      final data = response.data as Map<String, dynamic>;
      state = GamificationState(
        points: data['points'] as int? ?? 0,
        level: data['level'] as int? ?? 1,
        levelName: data['level_name'] as String? ?? 'Explorator',
        progress: (data['progress'] as num?)?.toDouble() ?? 0.0,
        nextLevelPoints: data['next_level_points'] as int? ?? 10,
        currentStreak: data['current_streak'] as int? ?? 0,
        longestStreak: data['longest_streak'] as int? ?? 0,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }
}

final gamificationProvider =
    StateNotifierProvider<GamificationNotifier, GamificationState>((ref) {
  return GamificationNotifier(ApiClient());
});
