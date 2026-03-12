import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

class NotificationPreferencesNotifier extends StateNotifier<Map<String, bool>> {
  final ApiClient _api;
  bool _fetched = false;

  NotificationPreferencesNotifier(this._api) : super({});

  Future<void> fetch() async {
    try {
      final response = await _api.dio.get(ApiEndpoints.notificationPreferences);
      final Map<String, dynamic> prefs = response.data['preferences'] ?? {};
      state = prefs.map((k, v) => MapEntry(k, v as bool));
      _fetched = true;
    } catch (_) {
      // Defaults: all enabled
    }
  }

  Future<void> ensureLoaded() async {
    if (!_fetched) await fetch();
  }

  Future<void> toggle(String key, bool value) async {
    // Optimistic update
    state = {...state, key: value};
    try {
      await _api.dio.put(ApiEndpoints.notificationPreferences, data: {
        'preferences': {key: value},
      });
    } catch (_) {
      // Revert
      state = {...state, key: !value};
    }
  }
}

final notificationPreferencesProvider =
    StateNotifierProvider.autoDispose<NotificationPreferencesNotifier, Map<String, bool>>((ref) {
  return NotificationPreferencesNotifier(ApiClient());
});
