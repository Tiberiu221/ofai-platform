/// Catalog models for unified services / products / menu items.
class CatalogCategory {
  final int? id; // null for uncategorized
  final String name;
  final List<CatalogItem> items;

  CatalogCategory({this.id, required this.name, required this.items});

  factory CatalogCategory.fromJson(Map<String, dynamic> json) {
    return CatalogCategory(
      id: json['id'] as int?,
      name: json['name'] as String? ?? 'Altele',
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => CatalogItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class CatalogItem {
  final int id;
  final String type; // 'service', 'product', 'menu_item'
  final String name;
  final String? description;
  final String? priceDisplay; // pre-formatted e.g. "35.00 RON"
  final int? durationMinutes;
  final String? imageUrl;

  CatalogItem({
    required this.id,
    required this.type,
    required this.name,
    this.description,
    this.priceDisplay,
    this.durationMinutes,
    this.imageUrl,
  });

  String get typeLabel {
    switch (type) {
      case 'service':
        return 'Serviciu';
      case 'product':
        return 'Produs';
      case 'menu_item':
        return 'Meniu';
      default:
        return type;
    }
  }

  factory CatalogItem.fromJson(Map<String, dynamic> json) {
    return CatalogItem(
      id: json['id'] as int,
      type: json['type'] as String? ?? 'service',
      name: json['name'] as String,
      description: json['description'] as String?,
      priceDisplay: json['price_display'] as String?,
      durationMinutes: json['duration_minutes'] as int?,
      imageUrl: json['image_url'] as String?,
    );
  }
}
