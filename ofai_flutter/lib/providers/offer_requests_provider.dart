import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import 'package:dio/dio.dart';
import '../core/network/api_exceptions.dart';

/// State for offer request (pinch) data for a specific business
class OfferRequestState {
  final int total;
  final int uniqueUsers;
  final bool userRequested;
  final bool isLoading;
  final bool isSubmitting;
  final String? error;
  /// Days remaining until user can request again (null = can request now)
  final int? daysRemaining;

  const OfferRequestState({
    this.total = 0,
    this.uniqueUsers = 0,
    this.userRequested = false,
    this.isLoading = false,
    this.isSubmitting = false,
    this.error,
    this.daysRemaining,
  });

  OfferRequestState copyWith({
    int? total,
    int? uniqueUsers,
    bool? userRequested,
    bool? isLoading,
    bool? isSubmitting,
    String? error,
    int? daysRemaining,
    bool clearError = false,
    bool clearDaysRemaining = false,
  }) {
    return OfferRequestState(
      total: total ?? this.total,
      uniqueUsers: uniqueUsers ?? this.uniqueUsers,
      userRequested: userRequested ?? this.userRequested,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: clearError ? null : (error ?? this.error),
      daysRemaining: clearDaysRemaining ? null : (daysRemaining ?? this.daysRemaining),
    );
  }

  /// Whether the user can submit a new request right now
  bool get canRequest => !userRequested || daysRemaining == null || daysRemaining! <= 0;
}

class OfferRequestNotifier extends StateNotifier<OfferRequestState> {
  final ApiClient _api;
  final int businessId;

  OfferRequestNotifier(this._api, this.businessId) : super(const OfferRequestState());

  /// Fetch current request count + user status for this business
  Future<void> fetch() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final response = await _api.dio.get(ApiEndpoints.offerRequestCount(businessId));
      final data = response.data;
      state = state.copyWith(
        total: data['total'] as int? ?? 0,
        uniqueUsers: data['uniqueUsers'] as int? ?? 0,
        userRequested: data['userRequested'] as bool? ?? false,
        daysRemaining: data['daysRemaining'] as int?,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: friendlyError(e));
    }
  }

  /// Submit a new offer request (pinch)
  Future<bool> submitRequest() async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final response = await _api.dio.post(
        ApiEndpoints.offerRequests,
        data: {'business_id': businessId},
      );
      final data = response.data;
      state = state.copyWith(
        isSubmitting: false,
        userRequested: true,
        total: data['totalRequests'] as int? ?? state.total + 1,
        uniqueUsers: data['uniqueUsers'] as int? ?? state.uniqueUsers,
        daysRemaining: 7,
      );
      return true;
    } catch (e) {
      // Check for 429 rate limit
      String errorMsg = 'Eroare la trimiterea cererii';
      final statusCode = e is DioException ? e.response?.statusCode : null;
      if (statusCode == 429) {
        errorMsg = 'Ai cerut deja recent. Poți cere din nou peste câteva zile.';
        state = state.copyWith(
          isSubmitting: false,
          userRequested: true,
          error: errorMsg,
        );
      } else {
        state = state.copyWith(isSubmitting: false, error: errorMsg);
      }
      return false;
    }
  }

  /// Cancel (delete) the user's most recent request
  Future<bool> cancelRequest() async {
    try {
      await _api.dio.delete(ApiEndpoints.offerRequestDelete(businessId));
      state = state.copyWith(
        userRequested: false,
        total: (state.total - 1).clamp(0, 999999),
        clearDaysRemaining: true,
      );
      return true;
    } catch (e) {
      return false;
    }
  }
}

/// Family provider — one notifier per businessId
final offerRequestProvider =
    StateNotifierProvider.autoDispose.family<OfferRequestNotifier, OfferRequestState, int>(
  (ref, businessId) {
    final notifier = OfferRequestNotifier(ApiClient(), businessId);
    notifier.fetch();
    return notifier;
  },
);
