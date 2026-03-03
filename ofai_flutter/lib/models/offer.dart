class Offer {
  final int id;
  final String title;
  final String? description;
  final String? discountType; // "percentage" | "fixed"
  final num? discountValue;
  final String? startDate;
  final String? endDate;
  final String? imageUrl;
  final String? conditions;
  final bool isActive;
  final OfferBusiness? business;
  final List<OfferLocation>? locations;
  // Detail-only fields
  final Booking? booking;
  final List<GalleryImage>? gallery;
  final bool hasPromoCode;
  // Platform polish fields
  final int? saveCount;
  final bool isTrending;
  final bool isPromoted;
  final int? maxReveals;
  final int? revealCount;

  Offer({
    required this.id,
    required this.title,
    this.description,
    this.discountType,
    this.discountValue,
    this.startDate,
    this.endDate,
    this.imageUrl,
    this.conditions,
    this.isActive = true,
    this.business,
    this.locations,
    this.booking,
    this.gallery,
    this.hasPromoCode = false,
    this.saveCount,
    this.isTrending = false,
    this.isPromoted = false,
    this.maxReveals,
    this.revealCount,
  });

  String get discountLabel {
    if (discountValue == null) return '';
    if (discountType == 'percentage') return '-${discountValue!.toStringAsFixed(0)}%';
    return '-${discountValue!.toStringAsFixed(0)} RON';
  }

  /// Best image: offer image → business logo → null
  String? get displayImage => imageUrl ?? business?.logoUrl;

  factory Offer.fromJson(Map<String, dynamic> json) {
    return Offer(
      id: json['id'] as int,
      title: json['title'] as String,
      description: json['description'] as String?,
      discountType: json['discount_type'] as String?,
      discountValue: json['discount_value'] as num?,
      startDate: json['start_date'] as String?,
      endDate: json['end_date'] as String?,
      imageUrl: json['image_url'] as String?,
      conditions: json['conditions'] as String?,
      isActive: json['is_active'] as bool? ?? true,
      business: json['business'] != null
          ? OfferBusiness.fromJson(json['business'] as Map<String, dynamic>)
          : null,
      locations: (json['locations'] as List<dynamic>?)
          ?.map((e) => OfferLocation.fromJson(e as Map<String, dynamic>))
          .toList(),
      booking: json['booking'] != null
          ? Booking.fromJson(json['booking'] as Map<String, dynamic>)
          : null,
      gallery: (json['gallery'] as List<dynamic>?)
          ?.map((e) => GalleryImage.fromJson(e as Map<String, dynamic>))
          .toList(),
      hasPromoCode: json['has_promo_code'] as bool? ?? false,
      saveCount: json['save_count'] as int?,
      isTrending: json['is_trending'] as bool? ?? false,
      isPromoted: json['is_promoted'] == true,
      maxReveals: json['max_reveals'] as int?,
      revealCount: json['reveal_count'] as int?,
    );
  }

  /// Remaining codes available (null if unlimited)
  int? get remainingCodes {
    if (maxReveals == null) return null;
    return (maxReveals! - (revealCount ?? 0)).clamp(0, maxReveals!);
  }

  /// Whether codes are exhausted
  bool get codesExhausted => maxReveals != null && remainingCodes == 0;
}

class OfferBusiness {
  final int id;
  final String name;
  final String? logoUrl;
  final String? coverImageUrl;
  final String? city;
  final String? category;
  final double? lat;
  final double? lng;
  final double? rating;
  final int? ratingCount;
  final bool isVerified;
  final String? badgeType; // effective badge: null, 'verified', 'premium'
  final int? categoryId;

  OfferBusiness({
    required this.id,
    required this.name,
    this.logoUrl,
    this.coverImageUrl,
    this.city,
    this.category,
    this.lat,
    this.lng,
    this.rating,
    this.ratingCount,
    this.isVerified = false,
    this.badgeType,
    this.categoryId,
  });

  factory OfferBusiness.fromJson(Map<String, dynamic> json) {
    final isVerified = json['is_verified'] as bool? ?? false;
    return OfferBusiness(
      id: json['id'] as int,
      name: json['name'] as String,
      logoUrl: json['logo_url'] as String?,
      coverImageUrl: json['cover_image_url'] as String?,
      city: json['city'] is Map ? (json['city'] as Map)['name'] as String? : json['city'] as String?,
      category: json['category'] is Map ? (json['category'] as Map)['name'] as String? : json['category'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      rating: (json['rating'] as num?)?.toDouble(),
      ratingCount: json['rating_count'] as int?,
      isVerified: isVerified,
      badgeType: json['badge_type'] as String?
          ?? json['subscription_badge_type'] as String?
          ?? (isVerified ? 'verified' : null),
      categoryId: json['category_id'] as int?,
    );
  }
}

class OfferLocation {
  final int id;
  final String? address;
  final double? lat;
  final double? lng;
  final String? cityName;

  OfferLocation({
    required this.id,
    this.address,
    this.lat,
    this.lng,
    this.cityName,
  });

  factory OfferLocation.fromJson(Map<String, dynamic> json) {
    return OfferLocation(
      id: json['id'] as int,
      address: json['address'] as String?,
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      cityName: json['city_name'] as String?,
    );
  }
}

class Booking {
  final String? type;
  final String? phone;
  final String? whatsapp;
  final String? url;
  final String? instructions;

  Booking({this.type, this.phone, this.whatsapp, this.url, this.instructions});

  bool get hasBooking => type != null && type != 'none';

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      type: json['type'] as String?,
      phone: json['phone'] as String?,
      whatsapp: json['whatsapp'] as String?,
      url: json['url'] as String?,
      instructions: json['instructions'] as String?,
    );
  }
}

class GalleryImage {
  final String url;

  GalleryImage({required this.url});

  factory GalleryImage.fromJson(Map<String, dynamic> json) {
    return GalleryImage(url: json['url'] as String);
  }
}
