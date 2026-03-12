import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../core/storage/preferences.dart';
import '../models/offer.dart';

// Bump this counter to re-fetch recently viewed offers
final _recentlyViewedRefresh = StateProvider.autoDispose<int>((ref) => 0);

final recentlyViewedOffersProvider =
    FutureProvider.autoDispose<List<Offer>>((ref) async {
  ref.watch(_recentlyViewedRefresh);

  final allIds = await AppPreferences.getRecentlyViewedOfferIds();
  if (allIds.isEmpty) return [];
  final ids = allIds.take(5).toList();

  final api = ApiClient();
  final futures = ids.map((idStr) async {
    try {
      final id = int.parse(idStr);
      final response = await api.dio.get(ApiEndpoints.offerDetail(id));
      return Offer.fromJson(response.data);
    } catch (_) {
      return null;
    }
  });

  final results = await Future.wait(futures);
  return results.whereType<Offer>().toList();
});

/// Record an offer as recently viewed and refresh the provider.
Future<void> recordRecentlyViewed(int offerId, WidgetRef ref) async {
  await AppPreferences.addRecentlyViewedOffer(offerId);
  ref.read(_recentlyViewedRefresh.notifier).state++;
}
