import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/category_feed.dart';

class CategoryFeedState {
  final List<CategoryWithOffers> categories;
  final bool isLoading;
  final String? error;

  const CategoryFeedState({
    this.categories = const [],
    this.isLoading = false,
    this.error,
  });

  CategoryFeedState copyWith({
    List<CategoryWithOffers>? categories,
    bool? isLoading,
    String? error,
  }) {
    return CategoryFeedState(
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class CategoryFeedNotifier extends StateNotifier<CategoryFeedState> {
  CategoryFeedNotifier() : super(const CategoryFeedState());

  Future<void> loadAll() async {
    if (state.isLoading) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await ApiClient().dio.get(
        ApiEndpoints.categoryFeed,
        queryParameters: {
          'offset': 0,
          'batch': 50,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final rawCategories = data['categories'] as List<dynamic>? ?? [];

      final categories = rawCategories
          .map((e) => CategoryWithOffers.fromJson(e as Map<String, dynamic>))
          .toList();

      state = state.copyWith(
        categories: categories,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Nu s-au putut incarca categoriile',
      );
    }
  }

  void reset() {
    state = const CategoryFeedState();
  }
}

final categoryFeedProvider =
    StateNotifierProvider<CategoryFeedNotifier, CategoryFeedState>(
  (ref) => CategoryFeedNotifier(),
);
