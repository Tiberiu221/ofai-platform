import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/category_feed.dart';
import '../core/utils/interleave.dart';

class CategoryFeedState {
  final List<CategoryWithOffers> categories;
  final bool isLoading;
  final bool hasMore;
  final int offset;
  final String? error;

  const CategoryFeedState({
    this.categories = const [],
    this.isLoading = false,
    this.hasMore = true,
    this.offset = 0,
    this.error,
  });

  CategoryFeedState copyWith({
    List<CategoryWithOffers>? categories,
    bool? isLoading,
    bool? hasMore,
    int? offset,
    String? error,
  }) {
    return CategoryFeedState(
      categories: categories ?? this.categories,
      isLoading: isLoading ?? this.isLoading,
      hasMore: hasMore ?? this.hasMore,
      offset: offset ?? this.offset,
      error: error,
    );
  }
}

class CategoryFeedNotifier extends StateNotifier<CategoryFeedState> {
  CategoryFeedNotifier() : super(const CategoryFeedState());

  Future<void> loadNextBatch() async {
    if (state.isLoading || !state.hasMore) return;

    state = state.copyWith(isLoading: true, error: null);

    try {
      final response = await ApiClient().dio.get(
        ApiEndpoints.categoryFeed,
        queryParameters: {
          'offset': state.offset,
          'batch': 2,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final rawCategories = data['categories'] as List<dynamic>? ?? [];
      final hasMore = data['hasMore'] as bool? ?? false;

      final newCategories = rawCategories.map((e) {
        final cat = CategoryWithOffers.fromJson(e as Map<String, dynamic>);
        // Interleave offers within each category
        return CategoryWithOffers(
          id: cat.id,
          name: cat.name,
          offerCount: cat.offerCount,
          offers: interleaveOffers(cat.offers),
        );
      }).toList();

      state = state.copyWith(
        categories: [...state.categories, ...newCategories],
        isLoading: false,
        hasMore: hasMore,
        offset: state.offset + newCategories.length,
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
