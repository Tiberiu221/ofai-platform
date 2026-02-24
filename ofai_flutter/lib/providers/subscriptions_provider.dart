import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../models/business.dart';
import '../models/pagination.dart';
import '../services/analytics_service.dart';

class SubscriptionsState {
  final List<Business> businesses;
  final Set<int> subscribedIds;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;

  const SubscriptionsState({
    this.businesses = const [],
    this.subscribedIds = const {},
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
  });

  SubscriptionsState copyWith({
    List<Business>? businesses,
    Set<int>? subscribedIds,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    bool clearError = false,
  }) {
    return SubscriptionsState(
      businesses: businesses ?? this.businesses,
      subscribedIds: subscribedIds ?? this.subscribedIds,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class SubscriptionsNotifier extends StateNotifier<SubscriptionsState> {
  final ApiClient _api;

  SubscriptionsNotifier(this._api) : super(const SubscriptionsState());

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.subscriptions, queryParameters: {
        'page': 1,
        'limit': 50,
      });
      final paginated = PaginatedResponse.fromJson(response.data, Business.fromJson);
      final ids = paginated.data.map((b) => b.id).toSet();
      state = state.copyWith(
        businesses: paginated.data,
        subscribedIds: ids,
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
      final response = await _api.dio.get(ApiEndpoints.subscriptions, queryParameters: {
        'page': nextPage,
        'limit': 20,
      });
      final paginated = PaginatedResponse.fromJson(response.data, Business.fromJson);
      final newList = [...state.businesses, ...paginated.data];
      final ids = newList.map((b) => b.id).toSet();
      state = state.copyWith(
        businesses: newList,
        subscribedIds: ids,
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void clear() {
    state = const SubscriptionsState();
  }

  bool isSubscribed(int businessId) => state.subscribedIds.contains(businessId);

  Future<void> toggleSubscription(int businessId) async {
    final wasSubscribed = state.subscribedIds.contains(businessId);

    // Optimistic update
    final newIds = Set<int>.from(state.subscribedIds);
    if (wasSubscribed) {
      newIds.remove(businessId);
      state = state.copyWith(
        subscribedIds: newIds,
        businesses: state.businesses.where((b) => b.id != businessId).toList(),
      );
    } else {
      newIds.add(businessId);
      state = state.copyWith(subscribedIds: newIds);
    }

    try {
      if (wasSubscribed) {
        await _api.dio.delete(ApiEndpoints.deleteSubscription(businessId));
      } else {
        await _api.dio.post(ApiEndpoints.subscriptions, data: {'business_id': businessId});
      }

      // Track follow/unfollow action
      AnalyticsService.trackClick(
        businessId: businessId,
        actionType: wasSubscribed ? 'unfollow' : 'follow',
      );
    } catch (e) {
      // Revert on failure
      if (wasSubscribed) {
        newIds.add(businessId);
      } else {
        newIds.remove(businessId);
      }
      state = state.copyWith(subscribedIds: newIds);
      fetch();
    }
  }
}

final subscriptionsProvider = StateNotifierProvider<SubscriptionsNotifier, SubscriptionsState>((ref) {
  return SubscriptionsNotifier(ApiClient());
});
