class User {
  final int id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;
  final int? preferredCityId;
  final List<int>? preferredCategoryIds;
  final int? points;
  final String? createdAt;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.role,
    this.preferredCityId,
    this.preferredCategoryIds,
    this.points,
    this.createdAt,
  });

  String get displayName {
    if (firstName != null && lastName != null) return '$firstName $lastName';
    if (firstName != null) return firstName!;
    return email.split('@').first;
  }

  String get initials {
    if (firstName != null && lastName != null) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (firstName != null) return firstName![0].toUpperCase();
    return email[0].toUpperCase();
  }

  bool get isBusinessOwner => role == 'business_owner' || role == 'admin';
  bool get isAdmin => role == 'admin';

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      email: json['email'] as String,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      role: json['role'] as String? ?? 'user',
      preferredCityId: json['preferred_city_id'] as int?,
      preferredCategoryIds: (json['preferred_category_ids'] as List<dynamic>?)
          ?.map((e) => e as int)
          .toList(),
      points: json['points'] as int?,
      createdAt: json['created_at'] as String?,
    );
  }
}
