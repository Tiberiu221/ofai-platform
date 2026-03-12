import 'package:shared_preferences/shared_preferences.dart';

class AppPreferences {
  static const _keyOnboardingDone = 'onboarding_done';
  static const _keyLocationBannerDismissed = 'location_banner_dismissed';

  static Future<bool> isOnboardingDone() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyOnboardingDone) ?? false;
  }

  static Future<void> setOnboardingDone() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyOnboardingDone, true);
  }

  static Future<bool> isLocationBannerDismissed() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyLocationBannerDismissed) ?? false;
  }

  static Future<void> setLocationBannerDismissed() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyLocationBannerDismissed, true);
  }

  // ── Recently Viewed Offers ──────────────────────────────────

  static const _keyRecentlyViewedOffers = 'recently_viewed_offers';
  static const _maxRecentItems = 10;

  static Future<List<String>> getRecentlyViewedOfferIds() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_keyRecentlyViewedOffers) ?? [];
  }

  static Future<void> addRecentlyViewedOffer(int offerId) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keyRecentlyViewedOffers) ?? [];
    final idStr = offerId.toString();
    list.remove(idStr);
    list.insert(0, idStr);
    if (list.length > _maxRecentItems) {
      list.removeRange(_maxRecentItems, list.length);
    }
    await prefs.setStringList(_keyRecentlyViewedOffers, list);
  }

  // ── Search History ──────────────────────────────────────────

  static const _keySearchHistory = 'search_history';
  static const _maxSearchHistory = 10;

  static Future<List<String>> getSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_keySearchHistory) ?? [];
  }

  static Future<void> addSearchQuery(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keySearchHistory) ?? [];
    list.remove(trimmed);
    list.insert(0, trimmed);
    if (list.length > _maxSearchHistory) {
      list.removeRange(_maxSearchHistory, list.length);
    }
    await prefs.setStringList(_keySearchHistory, list);
  }

  static Future<void> removeSearchQuery(String query) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_keySearchHistory) ?? [];
    list.remove(query);
    await prefs.setStringList(_keySearchHistory, list);
  }

  static Future<void> clearSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySearchHistory);
  }
}
