class User {
  final int id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String role;
  final List<int>? preferredCityIds;
  final List<int>? preferredCategoryIds;
  final int? points;
  final String? createdAt;
  final String? profilePictureUrl;
  final bool hasPassword;
  final List<UserBadge>? badges;
  final bool showPictureInReviews;

  User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.role,
    this.preferredCityIds,
    this.preferredCategoryIds,
    this.points,
    this.createdAt,
    this.profilePictureUrl,
    this.hasPassword = true,
    this.badges,
    this.showPictureInReviews = true,
  });

  String get displayName {
    if (firstName != null && lastName != null) return '$firstName $lastName';
    if (firstName != null) return firstName!;
    return email.split('@').first;
  }

  String get initials {
    if (firstName != null && firstName!.isNotEmpty && lastName != null && lastName!.isNotEmpty) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (firstName != null && firstName!.isNotEmpty) return firstName![0].toUpperCase();
    return email.isNotEmpty ? email[0].toUpperCase() : '?';
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
      preferredCityIds: (json['preferred_city_ids'] as List<dynamic>?)
          ?.map((e) => e as int)
          .toList(),
      preferredCategoryIds: (json['preferred_category_ids'] as List<dynamic>?)
          ?.map((e) => e as int)
          .toList(),
      points: json['points'] as int?,
      createdAt: json['created_at'] as String?,
      profilePictureUrl: json['profile_picture_url'] as String?,
      hasPassword: json['has_password'] as bool? ?? true,
      badges: (json['badges'] as List<dynamic>?)
          ?.map((e) => UserBadge.fromJson(e as Map<String, dynamic>))
          .toList(),
      showPictureInReviews: json['show_picture_in_reviews'] as bool? ?? true,
    );
  }
}

class UserBadge {
  final String slug;
  final String name;
  final String? description;
  final String icon;
  final String color;
  final String category;
  final String? earnedAt;

  UserBadge({
    required this.slug,
    required this.name,
    this.description,
    this.icon = 'star',
    this.color = '#fb923c',
    this.category = 'general',
    this.earnedAt,
  });

  factory UserBadge.fromJson(Map<String, dynamic> json) {
    return UserBadge(
      slug: json['slug'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      icon: json['icon'] as String? ?? 'star',
      color: json['color'] as String? ?? '#fb923c',
      category: json['category'] as String? ?? 'general',
      earnedAt: json['earned_at'] as String?,
    );
  }
}
