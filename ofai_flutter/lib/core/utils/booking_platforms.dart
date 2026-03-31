import 'package:flutter/material.dart';

/// A booking method from the multi-platform booking system.
class BookingMethod {
  final String platform;
  final String? platformLabel;
  final String value;
  final String label;
  final String href;
  final Color color;
  final String type; // 'phone', 'whatsapp', 'url'

  const BookingMethod({
    required this.platform,
    this.platformLabel,
    required this.value,
    required this.label,
    required this.href,
    required this.color,
    required this.type,
  });

  factory BookingMethod.fromJson(Map<String, dynamic> json) {
    return BookingMethod(
      platform: json['platform'] as String? ?? 'other',
      platformLabel: json['platform_label'] as String?,
      value: json['value'] as String? ?? '',
      label: json['label'] as String? ?? json['platform'] as String? ?? '',
      href: json['href'] as String? ?? '',
      color: _parseColor(json['color'] as String?),
      type: json['type'] as String? ?? 'url',
    );
  }

  bool get isPhone => type == 'phone';
  bool get isWhatsApp => platform == 'whatsapp';
  bool get isUrl => type == 'url';

  static Color _parseColor(String? hex) {
    if (hex == null || hex.isEmpty) return const Color(0xFFa1a1aa);
    final buffer = StringBuffer();
    if (hex.startsWith('#')) hex = hex.substring(1);
    if (hex.length == 6) buffer.write('FF');
    buffer.write(hex);
    return Color(int.tryParse(buffer.toString(), radix: 16) ?? 0xFFa1a1aa);
  }
}
