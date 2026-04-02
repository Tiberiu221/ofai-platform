import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/collection.dart';

// Home screen — list of active collections
final collectionsProvider = FutureProvider.autoDispose<List<OfferCollection>>((ref) async {
  final response = await ApiClient().dio.get(ApiEndpoints.collections);
  final List<dynamic> data = response.data['data'] ?? [];
  return data.map((e) => OfferCollection.fromJson(e as Map<String, dynamic>)).toList();
});

// Collection detail — single collection with offers
final collectionDetailProvider = FutureProvider.autoDispose.family<OfferCollection, int>((ref, id) async {
  final response = await ApiClient().dio.get(ApiEndpoints.collectionDetail(id));
  return OfferCollection.fromJson(response.data);
});
