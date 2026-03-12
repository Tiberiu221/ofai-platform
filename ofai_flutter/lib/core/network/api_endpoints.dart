class AppConfig {
  AppConfig._();

  /// Google OAuth Client ID — uses --dart-define=GOOGLE_CLIENT_ID=... at build time
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
    defaultValue: '',
  );
}

class ApiEndpoints {
  ApiEndpoints._();

  // Base URL — change for production
  static const String baseUrl = 'https://ofai.ro'; // Production (switch to http://10.0.2.2:4000 for local dev)

  // Auth
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String forgotPassword = '/auth/forgot-password';
  static const String verifyResetCode = '/auth/verify-reset-code';
  static const String resetPassword = '/auth/reset-password';
  static const String changePassword = '/auth/change-password';
  static const String me = '/auth/me';
  static const String googleAuth = '/auth/google';

  // Offers
  static const String offers = '/offers';
  static const String offersFeed = '/offers/feed';
  static String offerDetail(int id) => '/offers/$id';
  static String revealCode(int id) => '/offers/$id/reveal-code';
  static const String dealOfDay = '/offers/deal-of-day';
  static const String flashOffers = '/offers/flash';
  static String similarOffers(int id) => '/offers/$id/similar';

  // Businesses
  static const String businesses = '/businesses';
  static String businessDetail(int id) => '/businesses/$id';
  static String businessReviewSummary(int id) => '/businesses/$id/review-summary';

  // Reviews
  static String businessReviews(int id) => '/reviews/business/$id';
  static const String reviews = '/reviews';
  static String deleteReview(int id) => '/reviews/$id';

  // Favorites
  static const String favorites = '/favorites';
  static String deleteFavorite(int offerId) => '/favorites/$offerId';

  // Subscriptions
  static const String subscriptions = '/subscriptions';
  static String deleteSubscription(int businessId) => '/subscriptions/$businessId';

  // Users
  static const String userMe = '/users/me';
  static const String userPreferences = '/users/me/preferences';
  static const String userExport = '/users/me/export';
  static const String userDelete = '/users/me';
  static const String userProfilePicture = '/users/me/profile-picture';
  static const String notificationPreferences = '/users/me/notification-preferences';

  // Push
  static const String pushTokens = '/push-tokens';
  static const String pushTokensMyDevices = '/push-tokens/my-devices';

  // Offer Requests (Pinch)
  static const String offerRequests = '/offer-requests';
  static String offerRequestCount(int businessId) => '/offer-requests/$businessId/count';
  static String offerRequestDelete(int businessId) => '/offer-requests/$businessId';

  // Analytics (click tracking)
  static const String clicks = '/offers/clicks';

  // Search
  static const String searchSuggest = '/api/web/search/suggest';

  // Business Requests
  static const String businessRequests = '/api/business-requests';
  static const String myBusinessRequests = '/api/business-requests/mine';

  // Reports
  static const String reports = '/reports';

  // Static data
  static const String cities = '/cities';
  static const String categories = '/categories';

  // Saved Searches
  static const String savedSearches = '/saved-searches';
  static String deleteSavedSearch(int id) => '/saved-searches/$id';

  // Gamification
  static const String gamification = '/users/me/gamification';

  // Collections
  static const String collections = '/collections';
  static String collectionDetail(int id) => '/collections/$id';
}
