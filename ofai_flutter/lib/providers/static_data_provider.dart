import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/city.dart';
import '../models/category.dart';

final citiesProvider = FutureProvider<List<City>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.cities);
  final list = response.data as List<dynamic>;
  return list.map((e) => City.fromJson(e as Map<String, dynamic>)).toList();
});

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.categories);
  final list = response.data as List<dynamic>;
  return list.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
});
