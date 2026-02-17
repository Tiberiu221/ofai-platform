import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/offer.dart';
import '../models/pagination.dart';

// Offers list state
class OffersListState {
  final List<Offer> offers;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;
  // Filters
  final int? cityId;
  final int? categoryId;
  final String? sort;
  final String? query;

  const OffersListState({
    this.offers = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
    this.cityId,
    this.categoryId,
    this.sort,
    this.query,
  });

  OffersListState copyWith({
    List<Offer>? offers,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    int? cityId,
    int? categoryId,
    String? sort,
    String? query,
    bool clearCityId = false,
    bool clearCategoryId = false,
    bool clearSort = false,
    bool clearQuery = false,
    bool clearError = false,
  }) {
    return OffersListState(
      offers: offers ?? this.offers,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      cityId: clearCityId ? null : (cityId ?? this.cityId),
      categoryId: clearCategoryId ? null : (categoryId ?? this.categoryId),
      sort: clearSort ? null : (sort ?? this.sort),
      query: clearQuery ? null : (query ?? this.query),
    );
  }
}

class OffersListNotifier extends StateNotifier<OffersListState> {
  final ApiClient _api;

  OffersListNotifier(this._api) : super(const OffersListState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.offers, queryParameters: _params(1));
      final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
      state = state.copyWith(
        offers: paginated.data,
        isLoading: false,
        page: 1,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final nextPage = state.page + 1;
      final response = await _api.dio.get(ApiEndpoints.offers, queryParameters: _params(nextPage));
      final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
      state = state.copyWith(
        offers: [...state.offers, ...paginated.data],
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void setFilter({int? cityId, int? categoryId, String? sort, String? query,
    bool clearCityId = false, bool clearCategoryId = false}) {
    state = state.copyWith(
      offers: [],
      page: 1,
      cityId: cityId, categoryId: categoryId, sort: sort, query: query,
      clearCityId: clearCityId, clearCategoryId: clearCategoryId,
    );
    fetch();
  }

  Map<String, dynamic> _params(int page) {
    return {
      'page': page,
      'limit': 20,
      if (state.cityId != null) 'city_id': state.cityId,
      if (state.categoryId != null) 'category_id': state.categoryId,
      if (state.sort != null) 'sort': state.sort,
      if (state.query != null && state.query!.isNotEmpty) 'q': state.query,
    };
  }
}

// Providers
final offersListProvider = StateNotifierProvider<OffersListNotifier, OffersListState>((ref) {
  return OffersListNotifier(ApiClient());
});

// Popular offers for home screen (limited)
final popularOffersProvider = FutureProvider<List<Offer>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
    'sort': 'popular',
    'limit': 10,
    'page': 1,
  });
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data;
});

// Personalized feed for home screen (authenticated users)
final feedProvider = FutureProvider<List<Offer>>((ref) async {
  try {
    final response = await ApiClient().dio.get(ApiEndpoints.offersFeed, queryParameters: {
      'limit': 10,
      'page': 1,
    });
    final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
    return paginated.data;
  } catch (_) {
    // Fall back to popular offers if feed fails (e.g. not authenticated)
    final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
      'sort': 'popular',
      'limit': 10,
      'page': 1,
    });
    final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
    return paginated.data;
  }
});

// Single offer detail
final offerDetailProvider = FutureProvider.autoDispose.family<Offer, int>((ref, id) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offerDetail(id));
  return Offer.fromJson(response.data);
});
