class UserReport {
  final int id;
  final String targetType; // 'offer' | 'business'
  final int targetId;
  final String reason;
  final String? details;
  final String status; // 'pending' | 'reviewed' | 'resolved'
  final DateTime createdAt;

  UserReport({
    required this.id,
    required this.targetType,
    required this.targetId,
    required this.reason,
    this.details,
    required this.status,
    required this.createdAt,
  });

  factory UserReport.fromJson(Map<String, dynamic> json) {
    return UserReport(
      id: json['id'] as int,
      targetType: json['target_type'] as String,
      targetId: json['target_id'] as int,
      reason: json['reason'] as String,
      details: json['details'] as String?,
      status: json['status'] as String? ?? 'pending',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  bool get isPending => status == 'pending';
}
