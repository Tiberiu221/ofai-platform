import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/business.dart';
import '../models/pagination.dart';

// Businesses list state
class BusinessesListState {
  final List<Business> businesses;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;
  final int? cityId;
  final int? categoryId;
  final String? query;

  const BusinessesListState({
    this.businesses = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
    this.cityId,
    this.categoryId,
    this.query,
  });

  BusinessesListState copyWith({
    List<Business>? businesses,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    int? cityId,
    int? categoryId,
    String? query,
    bool clearCityId = false,
    bool clearCategoryId = false,
    bool clearQuery = false,
    bool clearError = false,
  }) {
    return BusinessesListState(
      businesses: businesses ?? this.businesses,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      cityId: clearCityId ? null : (cityId ?? this.cityId),
      categoryId: clearCategoryId ? null : (categoryId ?? this.categoryId),
      query: clearQuery ? null : (query ?? this.query),
    );
  }
}

class BusinessesListNotifier extends StateNotifier<BusinessesListState> {
  final ApiClient _api;

  BusinessesListNotifier(this._api) : super(const BusinessesListState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.businesses, queryParameters: _params(1));
      final paginated = PaginatedResponse.fromJson(response.data, Business.fromJson);
      state = state.copyWith(
        businesses: paginated.data,
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
      final response = await _api.dio.get(ApiEndpoints.businesses, queryParameters: _params(nextPage));
      final paginated = PaginatedResponse.fromJson(response.data, Business.fromJson);
      state = state.copyWith(
        businesses: [...state.businesses, ...paginated.data],
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void setFilter({int? cityId, int? categoryId, String? query,
    bool clearCityId = false, bool clearCategoryId = false}) {
    state = state.copyWith(
      cityId: cityId, categoryId: categoryId, query: query,
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
      if (state.query != null && state.query!.isNotEmpty) 'q': state.query,
    };
  }
}

// Providers
final businessesListProvider = StateNotifierProvider<BusinessesListNotifier, BusinessesListState>((ref) {
  return BusinessesListNotifier(ApiClient());
});

// Home screen businesses (limited)
final homeBusinessesProvider = FutureProvider<List<Business>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.businesses, queryParameters: {
    'limit': 6,
    'page': 1,
  });
  final paginated = PaginatedResponse.fromJson(response.data, Business.fromJson);
  return paginated.data;
});

// Single business detail
final businessDetailProvider = FutureProvider.family<Business, int>((ref, id) async {
  final response = await ApiClient().dio.get(ApiEndpoints.businessDetail(id));
  return Business.fromJson(response.data);
});
