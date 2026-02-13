class BusinessRequest {
  final int id;
  final String name;
  final String status; // pending, approved, rejected
  final String? adminNotes;
  final String? createdAt;
  final String? reviewedAt;
  final String? cityName;
  final String? categoryName;
  final String? address;
  final String? phone;
  final String? website;
  final String? description;

  BusinessRequest({
    required this.id,
    required this.name,
    required this.status,
    this.adminNotes,
    this.createdAt,
    this.reviewedAt,
    this.cityName,
    this.categoryName,
    this.address,
    this.phone,
    this.website,
    this.description,
  });

  factory BusinessRequest.fromJson(Map<String, dynamic> json) {
    return BusinessRequest(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      adminNotes: json['admin_notes'] as String?,
      createdAt: json['created_at'] as String?,
      reviewedAt: json['reviewed_at'] as String?,
      cityName: json['city_name'] as String?,
      categoryName: json['category_name'] as String?,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      website: json['website'] as String?,
      description: json['description'] as String?,
    );
  }

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
}
