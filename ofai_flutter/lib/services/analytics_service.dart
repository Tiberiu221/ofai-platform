import 'package:firebase_analytics/firebase_analytics.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

/// Fire-and-forget analytics service.
/// Tracks user interactions (click events) and Firebase Analytics screen/search events.
class AnalyticsService {
  static final _api = ApiClient();
  static final _analytics = FirebaseAnalytics.instance;

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

  /// Track screen views via Firebase Analytics.
  static Future<void> trackScreenView(String screenName) async {
    try {
      await _analytics.logScreenView(screenName: screenName);
    } catch (_) {}
  }

  /// Track search queries via Firebase Analytics.
  static Future<void> trackSearch(
    String query, {
    String? city,
    String? category,
  }) async {
    try {
      await _analytics.logSearch(
        searchTerm: query,
        parameters: {
          if (city != null) 'city': city,
          if (category != null) 'category': category,
        },
      );
    } catch (_) {}
  }

  /// Track onboarding completion via Firebase Analytics.
  static Future<void> trackOnboardingComplete() async {
    try {
      await _analytics.logEvent(name: 'onboarding_complete');
    } catch (_) {}
  }

  /// Observer for GoRouter — automatically tracks screen views on navigation.
  static FirebaseAnalyticsObserver get observer =>
      FirebaseAnalyticsObserver(analytics: _analytics);
}
