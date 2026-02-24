import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

// Models
class SuggestOffer {
  final int id;
  final String title;
  final String? discountType;
  final num? discountValue;
  final String? businessName;

  SuggestOffer({
    required this.id,
    required this.title,
    this.discountType,
    this.discountValue,
    this.businessName,
  });

  factory SuggestOffer.fromJson(Map<String, dynamic> json) => SuggestOffer(
        id: json['id'] as int,
        title: json['title'] as String,
        discountType: json['discount_type'] as String?,
        discountValue: json['discount_value'] as num?,
        businessName: json['business_name'] as String?,
      );

  String? get discountLabel {
    if (discountValue == null || discountValue == 0) return null;
    if (discountType == 'percentage') return '-${discountValue!.toInt()}%';
    if (discountType == 'fixed') return '-${discountValue!.toInt()} RON';
    return null;
  }
}

class SuggestBusiness {
  final int id;
  final String name;
  final String? logoUrl;
  final String? categoryName;

  SuggestBusiness({
    required this.id,
    required this.name,
    this.logoUrl,
    this.categoryName,
  });

  factory SuggestBusiness.fromJson(Map<String, dynamic> json) => SuggestBusiness(
        id: json['id'] as int,
        name: json['name'] as String,
        logoUrl: json['logo_url'] as String?,
        categoryName: json['category_name'] as String?,
      );
}

// State
class SearchSuggestState {
  final List<SuggestOffer> offers;
  final List<SuggestBusiness> businesses;
  final bool isLoading;
  final String query;

  const SearchSuggestState({
    this.offers = const [],
    this.businesses = const [],
    this.isLoading = false,
    this.query = '',
  });

  bool get hasResults => offers.isNotEmpty || businesses.isNotEmpty;
  bool get showDropdown => query.length >= 2;

  SearchSuggestState copyWith({
    List<SuggestOffer>? offers,
    List<SuggestBusiness>? businesses,
    bool? isLoading,
    String? query,
  }) =>
      SearchSuggestState(
        offers: offers ?? this.offers,
        businesses: businesses ?? this.businesses,
        isLoading: isLoading ?? this.isLoading,
        query: query ?? this.query,
      );
}

// Notifier
class SearchSuggestNotifier extends StateNotifier<SearchSuggestState> {
  SearchSuggestNotifier() : super(const SearchSuggestState());

  final _api = ApiClient();
  String? _activeQuery;

  Future<void> search(String query) async {
    if (query.length < 2) {
      state = const SearchSuggestState();
      _activeQuery = null;
      return;
    }

    _activeQuery = query;
    state = state.copyWith(isLoading: true, query: query);

    try {
      final resp = await _api.dio.get(
        ApiEndpoints.searchSuggest,
        queryParameters: {'q': query},
      );

      if (!mounted) return;
      if (_activeQuery != query) return; // Stale response, discard

      final data = resp.data as Map<String, dynamic>;
      final offers = (data['offers'] as List?)
              ?.map((e) => SuggestOffer.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];
      final businesses = (data['businesses'] as List?)
              ?.map((e) => SuggestBusiness.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [];

      state = state.copyWith(
        offers: offers,
        businesses: businesses,
        isLoading: false,
        query: query,
      );
    } catch (_) {
      if (mounted && _activeQuery == query) {
        state = state.copyWith(isLoading: false);
      }
    }
  }

  void clear() {
    state = const SearchSuggestState();
    _activeQuery = null;
  }
}

// Provider
final searchSuggestProvider =
    StateNotifierProvider.autoDispose<SearchSuggestNotifier, SearchSuggestState>(
  (ref) => SearchSuggestNotifier(),
);
