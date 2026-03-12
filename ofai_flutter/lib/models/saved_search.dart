class SavedSearch {
  final int id;
  final String? label;
  final String? query;
  final int? cityId;
  final int? categoryId;
  final String? cityName;
  final String? categoryName;
  final DateTime createdAt;

  const SavedSearch({
    required this.id,
    this.label,
    this.query,
    this.cityId,
    this.categoryId,
    this.cityName,
    this.categoryName,
    required this.createdAt,
  });

  factory SavedSearch.fromJson(Map<String, dynamic> json) {
    return SavedSearch(
      id: json['id'] as int,
      label: json['label'] as String?,
      query: json['query'] as String?,
      cityId: json['city_id'] as int?,
      categoryId: json['category_id'] as int?,
      cityName: json['city_name'] as String?,
      categoryName: json['category_name'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  String get displayLabel {
    if (label != null && label!.isNotEmpty) return label!;
    final parts = <String>[];
    if (query != null && query!.isNotEmpty) parts.add('"$query"');
    if (cityName != null) parts.add(cityName!);
    if (categoryName != null) parts.add(categoryName!);
    return parts.isNotEmpty ? parts.join(' · ') : 'Cautare salvata';
  }
}
