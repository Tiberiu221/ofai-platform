import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../models/business.dart';
import '../models/pagination.dart';
import '../services/analytics_service.dart';

class FollowedBusinessesState {
  final List<Business> businesses;
  final Set<int> followedIds;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;

  const FollowedBusinessesState({
    this.businesses = const [],
    this.followedIds = const {},
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
  });

  FollowedBusinessesState copyWith({
    List<Business>? businesses,
    Set<int>? followedIds,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    bool clearError = false,
  }) {
    return FollowedBusinessesState(
      businesses: businesses ?? this.businesses,
      followedIds: followedIds ?? this.followedIds,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class FollowedBusinessesNotifier extends StateNotifier<FollowedBusinessesState> {
  final ApiClient _api;
  final Set<int> _pendingToggles = {};

  FollowedBusinessesNotifier(this._api) : super(const FollowedBusinessesState());

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
        followedIds: ids,
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
        followedIds: ids,
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  void clear() {
    state = const FollowedBusinessesState();
  }

  bool isFollowed(int businessId) => state.followedIds.contains(businessId);

  Future<void> toggleFollow(int businessId) async {
    if (_pendingToggles.contains(businessId)) return;
    _pendingToggles.add(businessId);

    final wasFollowed = state.followedIds.contains(businessId);

    // Snapshot full state for complete rollback on failure
    final previousState = state;

    // Optimistic update
    final newIds = Set<int>.from(state.followedIds);
    if (wasFollowed) {
      newIds.remove(businessId);
      state = state.copyWith(
        followedIds: newIds,
        businesses: state.businesses.where((b) => b.id != businessId).toList(),
      );
    } else {
      newIds.add(businessId);
      state = state.copyWith(followedIds: newIds);
    }

    try {
      if (wasFollowed) {
        await _api.dio.delete(ApiEndpoints.deleteSubscription(businessId));
      } else {
        await _api.dio.post(ApiEndpoints.subscriptions, data: {'business_id': businessId});
      }

      // Track follow/unfollow action
      AnalyticsService.trackClick(
        businessId: businessId,
        actionType: wasFollowed ? 'unfollow' : 'follow',
      );
    } catch (e) {
      // Full rollback to pre-optimistic state
      state = previousState;
    } finally {
      _pendingToggles.remove(businessId);
    }
  }
}

final followedBusinessesProvider = StateNotifierProvider<FollowedBusinessesNotifier, FollowedBusinessesState>((ref) {
  return FollowedBusinessesNotifier(ApiClient());
});
