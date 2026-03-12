import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/saved_search.dart';

class SavedSearchesState {
  final List<SavedSearch> searches;
  final bool isLoading;
  final String? error;

  const SavedSearchesState({
    this.searches = const [],
    this.isLoading = false,
    this.error,
  });

  SavedSearchesState copyWith({
    List<SavedSearch>? searches,
    bool? isLoading,
    String? error,
    bool clearError = false,
  }) {
    return SavedSearchesState(
      searches: searches ?? this.searches,
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

class SavedSearchesNotifier extends StateNotifier<SavedSearchesState> {
  final ApiClient _api;

  SavedSearchesNotifier(this._api) : super(const SavedSearchesState());

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.savedSearches);
      final List<dynamic> data = response.data['data'] ?? [];
      final searches = data.map((e) => SavedSearch.fromJson(e as Map<String, dynamic>)).toList();
      state = state.copyWith(searches: searches, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> create({
    String? label,
    String? query,
    int? cityId,
    int? categoryId,
  }) async {
    try {
      await _api.dio.post(ApiEndpoints.savedSearches, data: {
        if (label != null) 'label': label,
        if (query != null) 'query': query,
        if (cityId != null) 'city_id': cityId,
        if (categoryId != null) 'category_id': categoryId,
      });
      await fetch();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> delete(int id) async {
    // Optimistic removal
    final prev = state.searches;
    state = state.copyWith(
      searches: prev.where((s) => s.id != id).toList(),
    );
    try {
      await _api.dio.delete(ApiEndpoints.deleteSavedSearch(id));
    } catch (_) {
      state = state.copyWith(searches: prev);
    }
  }
}

final savedSearchesProvider =
    StateNotifierProvider<SavedSearchesNotifier, SavedSearchesState>((ref) {
  return SavedSearchesNotifier(ApiClient());
});
