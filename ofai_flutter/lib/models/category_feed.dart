import 'offer.dart';

class CategoryWithOffers {
  final int id;
  final String name;
  final int offerCount;
  final List<Offer> offers;

  const CategoryWithOffers({
    required this.id,
    required this.name,
    required this.offerCount,
    required this.offers,
  });

  factory CategoryWithOffers.fromJson(Map<String, dynamic> json) {
    return CategoryWithOffers(
      id: json['id'] as int,
      name: json['name'] as String,
      offerCount: json['offerCount'] as int? ?? 0,
      offers: (json['offers'] as List<dynamic>?)
              ?.map((e) => Offer.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
