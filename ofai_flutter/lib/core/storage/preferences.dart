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
}
