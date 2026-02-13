import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/business_request.dart';

// State
class BusinessRequestsState {
  final List<BusinessRequest> requests;
  final bool isLoading;
  final String? error;

  const BusinessRequestsState({
    this.requests = const [],
    this.isLoading = false,
    this.error,
  });

  BusinessRequest? get latestRequest =>
      requests.isNotEmpty ? requests.first : null;

  BusinessRequestsState copyWith({
    List<BusinessRequest>? requests,
    bool? isLoading,
    String? error,
  }) =>
      BusinessRequestsState(
        requests: requests ?? this.requests,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

// Notifier
class BusinessRequestsNotifier extends StateNotifier<BusinessRequestsState> {
  BusinessRequestsNotifier() : super(const BusinessRequestsState());

  final _api = ApiClient();

  Future<void> fetchMyRequests() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final resp = await _api.dio.get(ApiEndpoints.myBusinessRequests);
      final data = resp.data;

      List<BusinessRequest> requests = [];
      if (data is Map && data['requests'] is List) {
        requests = (data['requests'] as List)
            .map((e) => BusinessRequest.fromJson(e as Map<String, dynamic>))
            .toList();
      } else if (data is List) {
        requests = data
            .map((e) => BusinessRequest.fromJson(e as Map<String, dynamic>))
            .toList();
      }

      state = state.copyWith(requests: requests, isLoading: false);
    } catch (e) {
      if (mounted) {
        state = state.copyWith(isLoading: false, error: 'Eroare la incarcare');
      }
    }
  }

  Future<bool> submitRequest({
    required String name,
    required int cityId,
    int? categoryId,
    String? address,
    String? phone,
    String? website,
    String? description,
  }) async {
    try {
      final body = <String, dynamic>{
        'name': name,
        'city_id': cityId,
      };
      if (categoryId != null) body['category_id'] = categoryId;
      if (address != null && address.isNotEmpty) body['address'] = address;
      if (phone != null && phone.isNotEmpty) body['phone'] = phone;
      if (website != null && website.isNotEmpty) body['website'] = website;
      if (description != null && description.isNotEmpty) {
        body['description'] = description;
      }

      await _api.dio.post(ApiEndpoints.businessRequests, data: body);

      // Refresh the list after submitting
      await fetchMyRequests();
      return true;
    } catch (_) {
      return false;
    }
  }
}

// Provider
final businessRequestsProvider =
    StateNotifierProvider<BusinessRequestsNotifier, BusinessRequestsState>(
  (ref) => BusinessRequestsNotifier(),
);
