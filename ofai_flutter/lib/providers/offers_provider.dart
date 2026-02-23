import 'package:dio/dio.dart';
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
  final bool prefsActive;

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
    this.prefsActive = true,
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
    bool? prefsActive,
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
      prefsActive: prefsActive ?? this.prefsActive,
    );
  }
}

class OffersListNotifier extends StateNotifier<OffersListState> {
  final ApiClient _api;
  CancelToken? _cancelToken;
  static const _maxItems = 500;

  OffersListNotifier(this._api) : super(const OffersListState()) {
    fetch();
  }

  Future<void> fetch() async {
    _cancelToken?.cancel();
    _cancelToken = CancelToken();
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(
        ApiEndpoints.offers,
        queryParameters: _params(1),
        cancelToken: _cancelToken,
      );
      final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
      state = state.copyWith(
        offers: paginated.data,
        isLoading: false,
        page: 1,
        hasMore: paginated.hasMore,
      );
    } on DioException catch (e) {
      if (e.type == DioExceptionType.cancel) return;
      state = state.copyWith(isLoading: false, error: e.toString());
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    if (state.offers.length >= _maxItems) return;
    state = state.copyWith(isLoadingMore: true);
    final loadMoreToken = CancelToken();
    try {
      final nextPage = state.page + 1;
      final response = await _api.dio.get(
        ApiEndpoints.offers,
        queryParameters: _params(nextPage),
        cancelToken: loadMoreToken,
      );
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

  void setFilter({int? cityId, int? categoryId, String? sort, String? query, bool? prefs,
    bool clearCityId = false, bool clearCategoryId = false, bool clearSort = false}) {
    _cancelToken?.cancel();

    // If activating/deactivating prefs, update that flag (and clear manual
    // city/category filters when prefs is turned on so they don't conflict).
    if (prefs != null) {
      state = state.copyWith(
        offers: [],
        page: 1,
        prefsActive: prefs,
        clearCityId: prefs ? true : clearCityId,
        clearCategoryId: prefs ? true : clearCategoryId,
        clearSort: prefs ? true : clearSort,
        sort: sort,
        query: query,
      );
      fetch();
      return;
    }

    // If a manual city/category filter is being set, disable prefs.
    final disablePrefs = cityId != null || categoryId != null;
    state = state.copyWith(
      offers: [],
      page: 1,
      prefsActive: disablePrefs ? false : state.prefsActive,
      cityId: cityId, categoryId: categoryId, sort: sort, query: query,
      clearCityId: clearCityId, clearCategoryId: clearCategoryId,
    );
    fetch();
  }

  Map<String, dynamic> _params(int page) {
    return {
      'page': page,
      'limit': 20,
      if (state.prefsActive) 'prefs': '1',
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
final popularOffersProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.offers, queryParameters: {
    'sort': 'popular',
    'limit': 10,
    'page': 1,
  });
  final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
  return paginated.data;
});

// Personalized feed for home screen (authenticated users)
final feedProvider = FutureProvider.autoDispose<List<Offer>>((ref) async {
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

// Deal of the day
final dealOfDayProvider = FutureProvider.autoDispose<Offer?>((ref) async {
  try {
    final response = await ApiClient().dio.get(ApiEndpoints.dealOfDay);
    if (response.data == null) return null;
    return Offer.fromJson(response.data);
  } catch (_) {
    return null;
  }
});

// Similar offers for offer detail (filtered by category for relevance)
final similarOffersProvider = FutureProvider.autoDispose.family<List<Offer>, ({int offerId, int? categoryId})>((ref, params) async {
  try {
    final response = await ApiClient().dio.get(
      ApiEndpoints.offers,
      queryParameters: {
        'exclude': params.offerId,
        'limit': 6,
        'sort': 'popular',
        if (params.categoryId != null) 'category_id': params.categoryId,
      },
    );
    final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
    return paginated.data;
  } catch (_) {
    return [];
  }
});
