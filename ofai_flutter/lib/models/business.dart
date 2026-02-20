import 'offer.dart' show Booking;

class Business {
  final int id;
  final String name;
  final String? address;
  final String? phone;
  final String? website;
  final double? lat;
  final double? lng;
  final String? logoUrl;
  final String? coverImage;
  final IdName? city;
  final IdName? category;
  final int? activeOffersCount;
  final double? rating;
  final int? ratingCount;
  // Detail-only fields
  final List<BusinessImage>? images;
  final List<BusinessLocation>? locations;
  final Booking? booking;
  final ReviewSummary? reviewSummary;
  // Offer request (pinch) fields — returned from detail API
  final List<ActiveOffer>? activeOffers;
  final int? offerRequestCount;
  final bool? showPinchFlag;
  final bool isVerified;

  Business({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    this.website,
    this.lat,
    this.lng,
    this.logoUrl,
    this.coverImage,
    this.city,
    this.category,
    this.activeOffersCount,
    this.rating,
    this.ratingCount,
    this.images,
    this.locations,
    this.booking,
    this.reviewSummary,
    this.activeOffers,
    this.offerRequestCount,
    this.showPinchFlag,
    this.isVerified = false,
  });

  String get cityName => city?.name ?? '';
  String get categoryName => category?.name ?? '';

  factory Business.fromJson(Map<String, dynamic> json) {
    return Business(
      id: json['id'] as int,
      name: json['name'] as String,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      website: json['website'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      logoUrl: json['logo_url'] as String?,
      coverImage: json['cover_image'] as String?,
      city: json['city'] != null && json['city'] is Map
          ? IdName.fromJson(json['city'] as Map<String, dynamic>)
          : null,
      category: json['category'] != null && json['category'] is Map
          ? IdName.fromJson(json['category'] as Map<String, dynamic>)
          : null,
      activeOffersCount: json['active_offers_count'] as int?,
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['rating_count'] as int?,
      images: (json['images'] as List<dynamic>?)
          ?.map((e) => BusinessImage.fromJson(e as Map<String, dynamic>))
          .toList(),
      locations: (json['locations'] as List<dynamic>?)
          ?.map((e) => BusinessLocation.fromJson(e as Map<String, dynamic>))
          .toList(),
      booking: json['booking'] != null
          ? Booking.fromJson(json['booking'] as Map<String, dynamic>)
          : null,
      reviewSummary: json['review_summary'] != null
          ? ReviewSummary.fromJson(json['review_summary'] as Map<String, dynamic>)
          : null,
      activeOffers: (json['activeOffers'] as List<dynamic>?)
          ?.map((e) => ActiveOffer.fromJson(e as Map<String, dynamic>))
          .toList(),
      offerRequestCount: json['offerRequestCount'] is Map
          ? (json['offerRequestCount'] as Map)['total'] as int? ?? 0
          : json['offerRequestCount'] as int?,
      showPinchFlag: json['showPinch'] as bool?,
      isVerified: json['is_verified'] as bool? ?? false,
    );
  }

  /// Whether the pinch card should be shown
  /// Uses server-side flag if available, otherwise falls back to no active offers
  bool get showPinch => showPinchFlag ?? (activeOffers == null || activeOffers!.isEmpty);
}

class IdName {
  final int id;
  final String name;

  IdName({required this.id, required this.name});

  factory IdName.fromJson(Map<String, dynamic> json) {
    return IdName(
      id: json['id'] as int,
      name: json['name'] as String,
    );
  }
}

class BusinessLocation {
  final dynamic id; // can be int or "main"
  final String? address;
  final double? lat;
  final double? lng;
  final String? phone;
  final IdName? city;
  final String? bookingType;
  final String? bookingPhone;
  final String? bookingWhatsapp;
  final String? bookingUrl;
  final String? bookingInstructions;

  BusinessLocation({
    required this.id,
    this.address,
    this.lat,
    this.lng,
    this.phone,
    this.city,
    this.bookingType,
    this.bookingPhone,
    this.bookingWhatsapp,
    this.bookingUrl,
    this.bookingInstructions,
  });

  factory BusinessLocation.fromJson(Map<String, dynamic> json) {
    return BusinessLocation(
      id: json['id'],
      address: json['address'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      phone: json['phone'] as String?,
      city: json['city'] != null && json['city'] is Map
          ? IdName.fromJson(json['city'] as Map<String, dynamic>)
          : null,
      bookingType: json['booking_type'] as String?,
      bookingPhone: json['booking_phone'] as String?,
      bookingWhatsapp: json['booking_whatsapp'] as String?,
      bookingUrl: json['booking_url'] as String?,
      bookingInstructions: json['booking_instructions'] as String?,
    );
  }
}

class BusinessImage {
  final int id;
  final String url;
  final int? sortOrder;

  BusinessImage({required this.id, required this.url, this.sortOrder});

  factory BusinessImage.fromJson(Map<String, dynamic> json) {
    return BusinessImage(
      id: json['id'] as int,
      url: json['url'] as String,
      sortOrder: json['sort_order'] as int?,
    );
  }
}

class ReviewSummary {
  final String text;
  final int reviewCount;
  final String? generatedAt;

  ReviewSummary({required this.text, required this.reviewCount, this.generatedAt});

  factory ReviewSummary.fromJson(Map<String, dynamic> json) {
    return ReviewSummary(
      text: json['text'] as String? ?? json['summary'] as String? ?? '',
      reviewCount: json['review_count'] as int? ?? 0,
      generatedAt: json['generated_at'] as String?,
    );
  }
}

class ActiveOffer {
  final int id;
  final String title;
  final String? discountType;
  final num? discountValue;
  final String? startDate;
  final String? endDate;
  final bool isActive;

  ActiveOffer({
    required this.id,
    required this.title,
    this.discountType,
    this.discountValue,
    this.startDate,
    this.endDate,
    this.isActive = true,
  });

  String get discountLabel {
    if (discountValue == null) return '';
    if (discountType == 'percentage') return '-${discountValue!.toStringAsFixed(0)}%';
    return '-${discountValue!.toStringAsFixed(0)} RON';
  }

  factory ActiveOffer.fromJson(Map<String, dynamic> json) {
    return ActiveOffer(
      id: json['id'] as int,
      title: json['title'] as String,
      discountType: json['discount_type'] as String?,
      discountValue: json['discount_value'] as num?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}
