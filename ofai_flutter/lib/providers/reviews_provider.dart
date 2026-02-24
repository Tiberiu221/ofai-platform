import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/network/api_exceptions.dart';
import '../models/review.dart';
import '../models/pagination.dart';

class ReviewsState {
  final List<Review> reviews;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int page;
  final bool hasMore;

  const ReviewsState({
    this.reviews = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.page = 1,
    this.hasMore = true,
  });

  ReviewsState copyWith({
    List<Review>? reviews,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? page,
    bool? hasMore,
    bool clearError = false,
  }) {
    return ReviewsState(
      reviews: reviews ?? this.reviews,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: clearError ? null : (error ?? this.error),
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
    );
  }
}

class ReviewsNotifier extends StateNotifier<ReviewsState> {
  final ApiClient _api;
  final int businessId;

  ReviewsNotifier(this._api, this.businessId) : super(const ReviewsState()) {
    fetch();
  }

  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(
        ApiEndpoints.businessReviews(businessId),
        queryParameters: {'page': 1, 'limit': 10},
      );
      final paginated = PaginatedResponse.fromJson(response.data, Review.fromJson);
      state = state.copyWith(
        reviews: paginated.data,
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
      final response = await _api.dio.get(
        ApiEndpoints.businessReviews(businessId),
        queryParameters: {'page': nextPage, 'limit': 10},
      );
      final paginated = PaginatedResponse.fromJson(response.data, Review.fromJson);
      state = state.copyWith(
        reviews: [...state.reviews, ...paginated.data],
        isLoadingMore: false,
        page: nextPage,
        hasMore: paginated.hasMore,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false);
    }
  }

  Future<bool> submitReview({required int rating, String? comment}) async {
    try {
      await _api.dio.post(ApiEndpoints.reviews, data: {
        'business_id': businessId,
        'rating': rating,
        if (comment != null && comment.isNotEmpty) 'comment': comment,
      });
      // Refresh reviews after submission
      await fetch();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteReview(int reviewId) async {
    try {
      await _api.dio.delete(ApiEndpoints.deleteReview(reviewId));
      // Remove from local state
      state = state.copyWith(
        reviews: state.reviews.where((r) => r.id != reviewId).toList(),
      );
      return true;
    } catch (e) {
      debugPrint('deleteReview error: $e');
      return false;
    }
  }
}

final businessReviewsProvider =
    StateNotifierProvider.autoDispose.family<ReviewsNotifier, ReviewsState, int>((ref, businessId) {
  return ReviewsNotifier(ApiClient(), businessId);
});
