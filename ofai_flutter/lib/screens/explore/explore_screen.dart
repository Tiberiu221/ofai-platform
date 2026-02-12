import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/offers_provider.dart';
import '../../providers/businesses_provider.dart';
import '../../providers/static_data_provider.dart';
import '../../models/city.dart';
import '../../models/category.dart' as model;
import '../../widgets/offer_card.dart';
import '../../widgets/business_card.dart';
import '../../widgets/skeleton_loader.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/error_state.dart' as w;

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _searchController = TextEditingController();
  final _offersScrollController = ScrollController();
  final _businessesScrollController = ScrollController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _offersScrollController.addListener(_onOffersScroll);
    _businessesScrollController.addListener(_onBusinessesScroll);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _offersScrollController.dispose();
    _businessesScrollController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onOffersScroll() {
    if (_offersScrollController.position.pixels >=
        _offersScrollController.position.maxScrollExtent - 200) {
      ref.read(offersListProvider.notifier).loadMore();
    }
  }

  void _onBusinessesScroll() {
    if (_businessesScrollController.position.pixels >=
        _businessesScrollController.position.maxScrollExtent - 200) {
      ref.read(businessesListProvider.notifier).loadMore();
    }
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (_tabController.index == 0) {
        ref.read(offersListProvider.notifier).setFilter(query: query);
      } else {
        ref.read(businessesListProvider.notifier).setFilter(query: query);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final offersState = ref.watch(offersListProvider);
    final businessesState = ref.watch(businessesListProvider);
    final citiesAsync = ref.watch(citiesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.lg),

            // Title
            Padding(
              padding: AppSpacing.pageH,
              child: Text('Explorează', style: AppTypography.displaySmall),
            ),

            const SizedBox(height: AppSpacing.md),

            // Search
            Padding(
              padding: AppSpacing.pageH,
              child: TextField(
                controller: _searchController,
                onChanged: _onSearchChanged,
                style: AppTypography.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'Caută oferte, business-uri...',
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            _onSearchChanged('');
                          },
                        )
                      : null,
                  filled: true,
                  fillColor: AppColors.bgCard,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    borderSide: BorderSide(color: AppColors.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    borderSide: BorderSide(color: AppColors.accent),
                  ),
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Filter chips row
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                children: [
                  // City dropdown
                  _FilterChip(
                    label: _selectedCityName(citiesAsync, offersState.cityId ?? businessesState.cityId) ?? 'Oraș',
                    isActive: (offersState.cityId ?? businessesState.cityId) != null,
                    onTap: () => _showCityPicker(citiesAsync),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Category dropdown
                  _FilterChip(
                    label: _selectedCategoryName(categoriesAsync, offersState.categoryId ?? businessesState.categoryId) ?? 'Categorie',
                    isActive: (offersState.categoryId ?? businessesState.categoryId) != null,
                    onTap: () => _showCategoryPicker(categoriesAsync),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Sort (only for offers tab)
                  if (_tabController.index == 0) ...[
                    _FilterChip(
                      label: _sortLabel(offersState.sort),
                      isActive: offersState.sort != null,
                      onTap: () => _showSortPicker(),
                    ),
                  ],
                  // Clear all
                  if ((offersState.cityId ?? businessesState.cityId) != null ||
                      (offersState.categoryId ?? businessesState.categoryId) != null ||
                      offersState.sort != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _FilterChip(
                      label: 'Resetează',
                      isActive: false,
                      icon: Icons.close,
                      onTap: _clearFilters,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Tab bar
            Padding(
              padding: AppSpacing.pageH,
              child: Container(
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.bgSecondary,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: TabBar(
                  controller: _tabController,
                  onTap: (_) => setState(() {}),
                  indicator: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                  ),
                  indicatorSize: TabBarIndicatorSize.tab,
                  dividerColor: Colors.transparent,
                  labelColor: AppColors.bgPrimary,
                  unselectedLabelColor: AppColors.textSecondary,
                  labelStyle: AppTypography.labelMedium,
                  unselectedLabelStyle: AppTypography.labelMedium,
                  tabs: const [
                    Tab(text: 'Oferte'),
                    Tab(text: 'Business-uri'),
                  ],
                ),
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Offers tab
                  _buildOffersTab(offersState),
                  // Businesses tab
                  _buildBusinessesTab(businessesState),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOffersTab(OffersListState state) {
    if (state.isLoading) {
      return Padding(
        padding: AppSpacing.pageH,
        child: SkeletonLoader(count: 4, type: SkeletonType.offerCard),
      );
    }
    if (state.error != null) {
      return w.ErrorState(
        message: 'Nu s-au putut încărca ofertele',
        onRetry: () => ref.read(offersListProvider.notifier).fetch(),
      );
    }
    if (state.offers.isEmpty) {
      return const EmptyState(
        icon: Icons.local_offer_outlined,
        title: 'Nicio ofertă găsită',
        subtitle: 'Încearcă alte filtre sau caută altceva',
      );
    }
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.bgCard,
      onRefresh: () => ref.read(offersListProvider.notifier).fetch(),
      child: ListView.separated(
        controller: _offersScrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.pagePadding, 0, AppSpacing.pagePadding, AppSpacing.huge,
        ),
        itemCount: state.offers.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= state.offers.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
            );
          }
          return OfferCard(offer: state.offers[index]);
        },
      ),
    );
  }

  Widget _buildBusinessesTab(BusinessesListState state) {
    if (state.isLoading) {
      return Padding(
        padding: AppSpacing.pageH,
        child: SkeletonLoader(count: 6, type: SkeletonType.businessCard),
      );
    }
    if (state.error != null) {
      return w.ErrorState(
        message: 'Nu s-au putut încărca business-urile',
        onRetry: () => ref.read(businessesListProvider.notifier).fetch(),
      );
    }
    if (state.businesses.isEmpty) {
      return const EmptyState(
        icon: Icons.store_outlined,
        title: 'Niciun business găsit',
        subtitle: 'Încearcă alte filtre sau caută altceva',
      );
    }
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.bgCard,
      onRefresh: () => ref.read(businessesListProvider.notifier).fetch(),
      child: ListView.separated(
        controller: _businessesScrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.pagePadding, 0, AppSpacing.pagePadding, AppSpacing.huge,
        ),
        itemCount: state.businesses.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          if (index >= state.businesses.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
            );
          }
          return BusinessCard(business: state.businesses[index]);
        },
      ),
    );
  }

  String? _selectedCityName(AsyncValue<List<City>> citiesAsync, int? cityId) {
    if (cityId == null) return null;
    return citiesAsync.whenOrNull(
      data: (cities) => cities.where((c) => c.id == cityId).firstOrNull?.name,
    );
  }

  String? _selectedCategoryName(AsyncValue<List<model.Category>> categoriesAsync, int? categoryId) {
    if (categoryId == null) return null;
    return categoriesAsync.whenOrNull(
      data: (cats) => cats.where((c) => c.id == categoryId).firstOrNull?.name,
    );
  }

  String _sortLabel(String? sort) {
    switch (sort) {
      case 'popular':
        return 'Populare';
      case 'discount_desc':
        return 'Reducere max';
      case 'ending_soon':
        return 'Se termină';
      default:
        return 'Sortare';
    }
  }

  void _clearFilters() {
    _searchController.clear();
    ref.read(offersListProvider.notifier).setFilter(
      clearCityId: true, clearCategoryId: true, query: '',
    );
    ref.read(businessesListProvider.notifier).setFilter(
      clearCityId: true, clearCategoryId: true, query: '',
    );
    setState(() {});
  }

  void _showCityPicker(AsyncValue<List<City>> citiesAsync) {
    final cities = citiesAsync.valueOrNull;
    if (cities == null) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
      ),
      builder: (_) => _PickerSheet(
        title: 'Alege orașul',
        items: [
          _PickerItem(label: 'Toate orașele', value: null),
          ...cities.map((c) => _PickerItem(label: c.name, value: c.id)),
        ],
        onSelected: (value) {
          Navigator.pop(context);
          if (_tabController.index == 0) {
            ref.read(offersListProvider.notifier).setFilter(
              cityId: value, clearCityId: value == null,
            );
          } else {
            ref.read(businessesListProvider.notifier).setFilter(
              cityId: value, clearCityId: value == null,
            );
          }
          setState(() {});
        },
      ),
    );
  }

  void _showCategoryPicker(AsyncValue<List<model.Category>> categoriesAsync) {
    final categories = categoriesAsync.valueOrNull;
    if (categories == null) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
      ),
      builder: (_) => _PickerSheet(
        title: 'Alege categoria',
        items: [
          _PickerItem(label: 'Toate categoriile', value: null),
          ...categories.map((c) => _PickerItem(label: c.name, value: c.id)),
        ],
        onSelected: (value) {
          Navigator.pop(context);
          if (_tabController.index == 0) {
            ref.read(offersListProvider.notifier).setFilter(
              categoryId: value, clearCategoryId: value == null,
            );
          } else {
            ref.read(businessesListProvider.notifier).setFilter(
              categoryId: value, clearCategoryId: value == null,
            );
          }
          setState(() {});
        },
      ),
    );
  }

  void _showSortPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgCard,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
      ),
      builder: (_) => _PickerSheet(
        title: 'Sortare',
        items: [
          _PickerItem(label: 'Implicit', value: null),
          _PickerItem(label: 'Populare', value: 'popular'),
          _PickerItem(label: 'Reducere maximă', value: 'discount_desc'),
          _PickerItem(label: 'Se termină curând', value: 'ending_soon'),
        ],
        onSelected: (value) {
          Navigator.pop(context);
          ref.read(offersListProvider.notifier).setFilter(sort: value);
          setState(() {});
        },
      ),
    );
  }
}

// Filter chip widget
class _FilterChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final IconData? icon;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isActive,
    this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.accentMuted : AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(
            color: isActive ? AppColors.accent : AppColors.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 14, color: isActive ? AppColors.accent : AppColors.textSecondary),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: AppTypography.labelMedium.copyWith(
                color: isActive ? AppColors.accent : AppColors.textSecondary,
              ),
            ),
            const SizedBox(width: 4),
            Icon(
              Icons.keyboard_arrow_down,
              size: 16,
              color: isActive ? AppColors.accent : AppColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

// Picker item model
class _PickerItem {
  final String label;
  final dynamic value;

  _PickerItem({required this.label, required this.value});
}

// Bottom sheet picker
class _PickerSheet extends StatelessWidget {
  final String title;
  final List<_PickerItem> items;
  final ValueChanged<dynamic> onSelected;

  const _PickerSheet({
    required this.title,
    required this.items,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: AppSpacing.md),
          Container(
            width: 32,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.textTertiary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(title, style: AppTypography.headlineSmall),
          const SizedBox(height: AppSpacing.md),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: items.length,
              itemBuilder: (_, index) {
                final item = items[index];
                return ListTile(
                  title: Text(item.label, style: AppTypography.bodyMedium),
                  onTap: () => onSelected(item.value),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ),
    );
  }
}
