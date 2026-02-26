class Review {
  final int id;
  final int? userId;
  final bool isOwn;
  final int rating;
  final String? comment;
  final String? createdAt;
  final String? firstName;
  final String? lastName;
  final ReviewResponse? response;
  final String? reviewerProfilePictureUrl;
  final bool reviewerShowPicture;
  final String? displayBadgeColor;
  final String? displayBadgeName;

  Review({
    required this.id,
    this.userId,
    this.isOwn = false,
    required this.rating,
    this.comment,
    this.createdAt,
    this.firstName,
    this.lastName,
    this.response,
    this.reviewerProfilePictureUrl,
    this.reviewerShowPicture = true,
    this.displayBadgeColor,
    this.displayBadgeName,
  });

  String get reviewerName {
    if (firstName != null && lastName != null) return '$firstName $lastName';
    if (firstName != null) return firstName!;
    return 'Anonim';
  }

  String get reviewerInitials {
    if (firstName != null && firstName!.isNotEmpty && lastName != null && lastName!.isNotEmpty) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (firstName != null && firstName!.isNotEmpty) return firstName![0].toUpperCase();
    return 'A';
  }

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] as int,
      userId: json['user_id'] as int?,
      isOwn: json['is_own'] as bool? ?? false,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: json['created_at'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      response: json['response'] != null && json['response'] is Map
          ? ReviewResponse.fromJson(json['response'] as Map<String, dynamic>)
          : null,
      reviewerProfilePictureUrl: json['reviewer_profile_picture_url'] as String?,
      reviewerShowPicture: json['reviewer_show_picture'] as bool? ?? true,
      displayBadgeColor: json['display_badge_color'] as String?,
      displayBadgeName: json['display_badge_name'] as String?,
    );
  }
}

class ReviewResponse {
  final String text;
  final String? date;

  ReviewResponse({required this.text, this.date});

  factory ReviewResponse.fromJson(Map<String, dynamic> json) {
    return ReviewResponse(
      text: json['text'] as String,
      date: json['date'] as String?,
    );
  }
}
