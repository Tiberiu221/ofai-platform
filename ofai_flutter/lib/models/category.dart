import 'package:flutter/material.dart';

class Category {
  final int id;
  final String name;
  final int? count;

  Category({
    required this.id,
    required this.name,
    this.count,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as int,
      name: json['name'] as String,
      count: json['count'] as int?,
    );
  }

  IconData get icon {
    switch (name.toLowerCase()) {
      case 'clinica':
        return Icons.local_hospital;
      case 'frizerie':
        return Icons.content_cut;
      case 'beauty':
        return Icons.spa;
      case 'auto':
        return Icons.directions_car;
      case 'magazine online':
        return Icons.shopping_cart;
      case 'cafenea':
        return Icons.coffee;
      case 'fitness':
        return Icons.fitness_center;
      case 'spa & wellness':
        return Icons.hot_tub;
      case 'optica':
        return Icons.visibility;
      case 'farmacie':
        return Icons.local_pharmacy;
      case 'veterinar':
        return Icons.pets;
      case 'stomatologie':
        return Icons.medical_services;
      case 'florarie':
        return Icons.local_florist;
      case 'curatatorie':
        return Icons.dry_cleaning;
      case 'foto & video':
        return Icons.camera_alt;
      default:
        return Icons.store;
    }
  }
}
