import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

/// Fire-and-forget click tracking service.
/// Tracks user interactions (phone, whatsapp, navigate, share, etc.)
/// for business analytics dashboards.
class AnalyticsService {
  static final _api = ApiClient();

  /// Track a click/interaction event.
  ///
  /// Valid [actionType] values:
  /// phone, whatsapp, booking_url, website, navigate,
  /// share, follow, unfollow, favorite, unfavorite, gallery, copy_code
  static Future<void> trackClick({
    required int businessId,
    int? offerId,
    required String actionType,
  }) async {
    try {
      await _api.dio.post(ApiEndpoints.clicks, data: {
        'business_id': businessId,
        if (offerId != null) 'offer_id': offerId,
        'action_type': actionType,
      });
    } catch (_) {
      // Fire-and-forget — never block UI for analytics
    }
  }
}
