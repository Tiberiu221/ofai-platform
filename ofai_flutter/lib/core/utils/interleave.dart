import '../../models/offer.dart';

/// Interleave offers so same business doesn't appear consecutively.
/// Round-robin from business-grouped buckets, sorted by bucket size DESC.
List<Offer> interleaveOffers(List<Offer> offers) {
  if (offers.length <= 2) return offers;

  // Group by business ID
  final buckets = <int, List<Offer>>{};
  for (final offer in offers) {
    final bizId = offer.business?.id ?? 0;
    buckets.putIfAbsent(bizId, () => []).add(offer);
  }

  // If all from different businesses, no interleaving needed
  if (buckets.length == offers.length) return offers;

  // Sort buckets by size DESC (largest groups first)
  final sortedBuckets = buckets.values.toList()
    ..sort((a, b) => b.length.compareTo(a.length));

  // Round-robin: pick one from each bucket in turn
  final result = <Offer>[];
  final indices = List<int>.filled(sortedBuckets.length, 0);
  var placed = 0;
  final total = offers.length;

  while (placed < total) {
    var placedThisRound = false;
    for (var i = 0; i < sortedBuckets.length; i++) {
      if (indices[i] < sortedBuckets[i].length) {
        result.add(sortedBuckets[i][indices[i]]);
        indices[i]++;
        placed++;
        placedThisRound = true;
      }
    }
    if (!placedThisRound) break;
  }

  return result;
}
