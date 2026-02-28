import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../models/offer.dart';
import '../models/pagination.dart';
import '../services/analytics_service.dart';

class FavoritesState {
  final List<Offer> offers;
  final Set<int> favoriteIds;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;

  const FavoritesState({
    this.offers = const [],
    this.favoriteIds = const {},
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
  });

  FavoritesState copyWith({
    List<Offer>? offers,
    Set<int>? favoriteIds,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    bool clearError = false,
  }) {
    return FavoritesState(
      offers: offers ?? this.offers,
      favoriteIds: favoriteIds ?? this.favoriteIds,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class FavoritesNotifier extends StateNotifier<FavoritesState> {
  final ApiClient _api;

  FavoritesNotifier(this._api) : super(const FavoritesState());

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.favorites, queryParameters: {
        'page': 1,
        'limit': 50,
      });
      final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
      final ids = paginated.data.map((o) => o.id).toSet();
      state = state.copyWith(
        offers: paginated.data,
        favoriteIds: ids,
        isLoading: false,
        page: 1,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: friendlyError(e));
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || !state.hasMore) return;
    state = state.copyWith(isLoadingMore: true);
    try {
      final nextPage = state.page + 1;
      final response = await _api.dio.get(ApiEndpoints.favorites, queryParameters: {
        'page': nextPage,
        'limit': 20,
      });
      final paginated = PaginatedResponse.fromJson(response.data, Offer.fromJson);
      final newOffers = [...state.offers, ...paginated.data];
      final ids = newOffers.map((o) => o.id).toSet();
      state = state.copyWith(
        offers: newOffers,
        favoriteIds: ids,
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void clear() {
    state = const FavoritesState();
  }

  bool isFavorite(int offerId) => state.favoriteIds.contains(offerId);

  Future<void> toggleFavorite(int offerId) async {
    final wasFavorite = state.favoriteIds.contains(offerId);

    // Capture analytics data BEFORE optimistic removal (offer disappears from list on unfavorite)
    final offerForAnalytics = state.offers.where((o) => o.id == offerId).firstOrNull;

    // Optimistic update
    final newIds = Set<int>.from(state.favoriteIds);
    if (wasFavorite) {
      newIds.remove(offerId);
      state = state.copyWith(
        favoriteIds: newIds,
        offers: state.offers.where((o) => o.id != offerId).toList(),
      );
    } else {
      newIds.add(offerId);
      state = state.copyWith(favoriteIds: newIds);
    }

    try {
      if (wasFavorite) {
        await _api.dio.delete(ApiEndpoints.deleteFavorite(offerId));
      } else {
        await _api.dio.post(ApiEndpoints.favorites, data: {'offer_id': offerId});
      }

      // Track favorite/unfavorite action (using pre-captured reference)
      if (offerForAnalytics?.business != null) {
        AnalyticsService.trackClick(
          businessId: offerForAnalytics!.business!.id,
          offerId: offerId,
          actionType: wasFavorite ? 'unfavorite' : 'favorite',
        );
      }
    } catch (e) {
      // Revert on failure
      if (wasFavorite) {
        newIds.add(offerId);
      } else {
        newIds.remove(offerId);
      }
      state = state.copyWith(favoriteIds: newIds);
      // Re-fetch to get correct state
      fetch();
    }
  }
}

final favoritesProvider = StateNotifierProvider<FavoritesNotifier, FavoritesState>((ref) {
  return FavoritesNotifier(ApiClient());
});
