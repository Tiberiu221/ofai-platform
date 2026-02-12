class Review {
  final int id;
  final int rating;
  final String? comment;
  final String? createdAt;
  final String? firstName;
  final String? lastName;
  final ReviewResponse? response;

  Review({
    required this.id,
    required this.rating,
    this.comment,
    this.createdAt,
    this.firstName,
    this.lastName,
    this.response,
  });

  String get reviewerName {
    if (firstName != null && lastName != null) return '$firstName $lastName';
    if (firstName != null) return firstName!;
    return 'Anonim';
  }

  String get reviewerInitials {
    if (firstName != null && lastName != null) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (firstName != null) return firstName![0].toUpperCase();
    return 'A';
  }

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      id: json['id'] as int,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: json['created_at'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      response: json['response'] != null && json['response'] is Map
          ? ReviewResponse.fromJson(json['response'] as Map<String, dynamic>)
          : null,
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
