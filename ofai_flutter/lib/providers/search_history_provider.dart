import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/storage/preferences.dart';

class SearchHistoryNotifier extends StateNotifier<List<String>> {
  SearchHistoryNotifier() : super(const []) {
    _load();
  }

  Future<void> _load() async {
    state = await AppPreferences.getSearchHistory();
  }

  Future<void> addQuery(String query) async {
    await AppPreferences.addSearchQuery(query);
    await _load();
  }

  Future<void> removeQuery(String query) async {
    await AppPreferences.removeSearchQuery(query);
    await _load();
  }

  Future<void> clearAll() async {
    await AppPreferences.clearSearchHistory();
    state = [];
  }
}

final searchHistoryProvider =
    StateNotifierProvider<SearchHistoryNotifier, List<String>>(
  (ref) => SearchHistoryNotifier(),
);
