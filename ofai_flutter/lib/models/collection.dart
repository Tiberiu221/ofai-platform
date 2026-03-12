import 'offer.dart';

class OfferCollection {
  final int id;
  final String title;
  final String? description;
  final String? imageUrl;
  final int offerCount;
  final List<Offer>? offers;

  OfferCollection({
    required this.id,
    required this.title,
    this.description,
    this.imageUrl,
    this.offerCount = 0,
    this.offers,
  });

  factory OfferCollection.fromJson(Map<String, dynamic> json) {
    return OfferCollection(
      id: json['id'] as int,
      title: json['title'] as String,
      description: json['description'] as String?,
      imageUrl: json['image_url'] as String?,
      offerCount: int.tryParse('${json['offer_count'] ?? 0}') ?? 0,
      offers: (json['offers'] as List<dynamic>?)
          ?.map((e) => Offer.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
