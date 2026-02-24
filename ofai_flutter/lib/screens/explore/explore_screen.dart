import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
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
import '../../widgets/search_suggest_dropdown.dart';
import '../../widgets/fade_in_item.dart';
import '../../providers/search_suggest_provider.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  late TabController _tabController;
  final _searchController = TextEditingController();
  final _offersScrollController = ScrollController();
  final _businessesScrollController = ScrollController();
  Timer? _debounce;

  String? _lastAppliedQuery;
  int? _lastAppliedCategoryId;
  int? _lastAppliedCityId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _offersScrollController.addListener(_onOffersScroll);
    _businessesScrollController.addListener(_onBusinessesScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final params = GoRouterState.of(context).uri.queryParameters;
    final q = params['q'];
    final category = params['category'];
    final city = params['city'];

    if (q != null && q.isNotEmpty && q != _lastAppliedQuery) {
      _lastAppliedQuery = q;
      _searchController.text = q;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _onSearchChanged(q);
      });
    }

    // Apply category filter from query params (e.g. from HomeScreen category tap)
    if (category != null && category.isNotEmpty) {
      final catId = int.tryParse(category);
      if (catId != null && catId != _lastAppliedCategoryId) {
        _lastAppliedCategoryId = catId;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(offersListProvider.notifier).setFilter(categoryId: catId);
          ref.read(businessesListProvider.notifier).setFilter(categoryId: catId);
          setState(() {});
        });
      }
    }

    // Apply city filter from query params
    if (city != null && city.isNotEmpty) {
      final cityId = int.tryParse(city);
      if (cityId != null && cityId != _lastAppliedCityId) {
        _lastAppliedCityId = cityId;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref.read(offersListProvider.notifier).setFilter(cityId: cityId);
          ref.read(businessesListProvider.notifier).setFilter(cityId: cityId);
          setState(() {});
        });
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    _offersScrollController.dispose();
    _businessesScrollController.dispose();
    _debounce?.cancel();
    _searchFocusNode.dispose();
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

  bool _showSuggest = false;
  final FocusNode _searchFocusNode = FocusNode();

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      // Update autosuggest
      ref.read(searchSuggestProvider.notifier).search(query);
      setState(() => _showSuggest = query.length >= 2);
      // Update list filters
      if (_tabController.index == 0) {
        ref.read(offersListProvider.notifier).setFilter(query: query);
      } else {
        ref.read(businessesListProvider.notifier).setFilter(query: query);
      }
    });
  }

  void _dismissSuggest() {
    setState(() => _showSuggest = false);
    _searchFocusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final offersState = ref.watch(offersListProvider);
    final businessesState = ref.watch(businessesListProvider);
    final citiesAsync = ref.watch(citiesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final hasPrefs = user != null &&
        ((user.preferredCityIds?.isNotEmpty ?? false) ||
            (user.preferredCategoryIds?.isNotEmpty ?? false));
    // Chip reflects the active tab's state; both are kept in sync.
    final prefsActive = _tabController.index == 0
        ? offersState.prefsActive
        : businessesState.prefsActive;

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

            // Search + autosuggest dropdown
            Padding(
              padding: AppSpacing.pageH,
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    focusNode: _searchFocusNode,
                    onChanged: _onSearchChanged,
                    style: AppTypography.bodyMedium,
                    decoration: InputDecoration(
                      hintText: 'Cauta oferte, business-uri...',
                      hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.close, size: 18),
                              onPressed: () {
                                _searchController.clear();
                                _onSearchChanged('');
                                ref.read(searchSuggestProvider.notifier).clear();
                                setState(() => _showSuggest = false);
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
                  if (_showSuggest)
                    SearchSuggestDropdown(
                      onDismiss: _dismissSuggest,
                    ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.md),

            // Filter chips row
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                children: [
                  // Preferences chip (only shown when authenticated)
                  if (authState.status == AuthStatus.authenticated) ...[
                    _PrefsFilterChip(
                      isActive: prefsActive,
                      hasPrefs: hasPrefs,
                      onToggle: (selected) {
                        ref.read(offersListProvider.notifier).setFilter(prefs: selected);
                        ref.read(businessesListProvider.notifier).setFilter(prefs: selected);
                        setState(() {});
                      },
                      onNavigateToPrefs: () async {
                        final result = await context.push('/account/preferences');
                        if (result == true && mounted) {
                          await ref.read(authProvider.notifier).refreshUser();
                          ref.read(offersListProvider.notifier).setFilter(prefs: true);
                          ref.read(businessesListProvider.notifier).setFilter(prefs: true);
                          setState(() {});
                        }
                      },
                    ),
                    const SizedBox(width: AppSpacing.sm),
                  ],
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
                  // Clear all — shown when any filter is active or prefs is off
                  if ((offersState.cityId ?? businessesState.cityId) != null ||
                      (offersState.categoryId ?? businessesState.categoryId) != null ||
                      offersState.sort != null ||
                      !offersState.prefsActive) ...[
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
                height: 44,
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

            const SizedBox(height: AppSpacing.sm),

            // Results count
            Builder(builder: (_) {
              final isOffers = _tabController.index == 0;
              final count = isOffers ? offersState.offers.length : businessesState.businesses.length;
              final total = isOffers ? offersState.total : businessesState.total;
              final isLoading = isOffers ? offersState.isLoading : businessesState.isLoading;
              if (isLoading || total == null || total == 0) return const SizedBox.shrink();
              return Padding(
                padding: AppSpacing.pageH,
                child: Text(
                  'Afișând $count din $total ${isOffers ? 'oferte' : 'business-uri'}',
                  style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                ),
              );
            }),

            const SizedBox(height: AppSpacing.sm),

            // Tab content
            Expanded(
              child: GestureDetector(
                onPanDown: (_) => FocusScope.of(context).unfocus(),
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
          return FadeInItem(
            index: index,
            child: OfferCard(offer: state.offers[index]),
          );
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
          return FadeInItem(
            index: index,
            child: BusinessCard(business: state.businesses[index]),
          );
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
      clearCityId: true, clearCategoryId: true, query: '', prefs: true,
    );
    ref.read(businessesListProvider.notifier).setFilter(
      clearCityId: true, clearCategoryId: true, query: '', prefs: true,
    );
    setState(() {});
  }

  void _showGlassBottomSheet({required Widget child}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.overlay,
      builder: (_) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.bgGlass,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
              border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5)),
            ),
            child: child,
          ),
        ),
      ),
    );
  }

  void _showCityPicker(AsyncValue<List<City>> citiesAsync) {
    final cities = citiesAsync.valueOrNull;
    if (cities == null) return;

    _showGlassBottomSheet(
      child: _PickerSheet(
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

    _showGlassBottomSheet(
      child: _PickerSheet(
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
    _showGlassBottomSheet(
      child: _PickerSheet(
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

// Preferences toggle chip — shown only for authenticated users
class _PrefsFilterChip extends StatelessWidget {
  final bool isActive;
  final bool hasPrefs;
  final ValueChanged<bool> onToggle;
  final VoidCallback onNavigateToPrefs;

  const _PrefsFilterChip({
    required this.isActive,
    required this.hasPrefs,
    required this.onToggle,
    required this.onNavigateToPrefs,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        if (hasPrefs) {
          onToggle(!isActive);
        } else {
          onNavigateToPrefs();
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
            Icon(
              isActive ? Icons.tune : Icons.tune_outlined,
              size: 14,
              color: isActive
                  ? AppColors.accent
                  : hasPrefs
                      ? AppColors.textSecondary
                      : AppColors.textTertiary,
            ),
            const SizedBox(width: 6),
            Text(
              'Preferințele mele',
              style: AppTypography.labelMedium.copyWith(
                color: isActive
                    ? AppColors.accent
                    : hasPrefs
                        ? AppColors.textSecondary
                        : AppColors.textTertiary,
              ),
            ),
            if (isActive) ...[
              const SizedBox(width: 4),
              const Icon(
                Icons.check_circle,
                size: 14,
                color: AppColors.accent,
              ),
            ],
          ],
        ),
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
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
