import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
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
import '../../providers/search_history_provider.dart';
import '../../providers/saved_searches_provider.dart';
import '../../core/utils/distance.dart';
import '../../models/offer.dart';
import '../../widgets/location_banner.dart';
import '../../services/analytics_service.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

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

  int _locationCheckKey = 0;
  bool _isHeaderCollapsed = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_onTabChanged);
    _offersScrollController.addListener(_onOffersScroll);
    _businessesScrollController.addListener(_onBusinessesScroll);
    _searchFocusNode.addListener(() {
      if (mounted) setState(() {});
    });
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
    _updateHeaderCollapse(_offersScrollController);
    if (_offersScrollController.position.pixels >=
        _offersScrollController.position.maxScrollExtent - 200) {
      ref.read(offersListProvider.notifier).loadMore();
    }
  }

  void _onBusinessesScroll() {
    _updateHeaderCollapse(_businessesScrollController);
    if (_businessesScrollController.position.pixels >=
        _businessesScrollController.position.maxScrollExtent - 200) {
      ref.read(businessesListProvider.notifier).loadMore();
    }
  }

  void _updateHeaderCollapse(ScrollController controller) {
    if (!controller.hasClients) return;
    final offset = controller.offset;
    if (offset > 60 && !_isHeaderCollapsed) {
      setState(() => _isHeaderCollapsed = true);
    } else if (offset <= 10 && _isHeaderCollapsed) {
      setState(() => _isHeaderCollapsed = false);
    }
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) return;
    // Sync collapse state with the new tab's scroll position
    final controller = _tabController.index == 0
        ? _offersScrollController
        : _businessesScrollController;
    if (controller.hasClients) {
      final collapsed = controller.offset > 60;
      if (collapsed != _isHeaderCollapsed) {
        setState(() => _isHeaderCollapsed = collapsed);
      }
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
      // Search history saved on dismiss/unfocus, not on every keystroke
    });
  }

  void _dismissSuggest() {
    // Save search to history on dismiss (not on every keystroke)
    final query = _searchController.text.trim();
    if (query.length >= 3) {
      ref.read(searchHistoryProvider.notifier).addQuery(query);
      // Track search in Firebase Analytics
      final offersState = ref.read(offersListProvider);
      AnalyticsService.trackSearch(
        query,
        city: offersState.cityId?.toString(),
        category: offersState.categoryId?.toString(),
      );
    }
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
            // Collapsible title
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              alignment: Alignment.topCenter,
              child: _isHeaderCollapsed
                  ? const SizedBox(width: double.infinity)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: AppSpacing.lg),
                        Padding(
                          padding: AppSpacing.pageH,
                          child: Text(AppLocalizations.of(context)!.explore, style: AppTypography.displaySmall),
                        ),
                      ],
                    ),
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
                      hintText: AppLocalizations.of(context)!.searchHint,
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
                      query: _searchController.text.trim(),
                    )
                  else if (_searchFocusNode.hasFocus && _searchController.text.isEmpty)
                    _SearchHistoryDropdown(
                      onSelect: (query) {
                        _searchController.text = query;
                        _searchController.selection = TextSelection.fromPosition(
                          TextPosition(offset: query.length),
                        );
                        _onSearchChanged(query);
                      },
                      onDismiss: _dismissSuggest,
                    ),
                ],
              ),
            ),

            // Collapsible filters, tabs, results count, location banner
            AnimatedSize(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              alignment: Alignment.topCenter,
              child: _isHeaderCollapsed
                  ? const SizedBox(width: double.infinity)
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
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
                    label: _selectedCityName(citiesAsync, offersState.cityId ?? businessesState.cityId) ?? AppLocalizations.of(context)!.cityFilter,
                    isActive: (offersState.cityId ?? businessesState.cityId) != null,
                    onTap: () => _showCityPicker(citiesAsync),
                    semanticsLabel: 'Filtreaza dupa oras',
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Category dropdown
                  _FilterChip(
                    label: _selectedCategoryName(categoriesAsync, offersState.categoryId ?? businessesState.categoryId) ?? AppLocalizations.of(context)!.categoryFilter,
                    isActive: (offersState.categoryId ?? businessesState.categoryId) != null,
                    onTap: () => _showCategoryPicker(categoriesAsync),
                    semanticsLabel: 'Filtreaza dupa categorie',
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  // Sort (only for offers tab)
                  if (_tabController.index == 0) ...[
                    _FilterChip(
                      label: _sortLabel(offersState.sort),
                      isActive: offersState.sort != null,
                      onTap: () => _showSortPicker(),
                      semanticsLabel: 'Sorteaza ofertele',
                    ),
                  ],
                  // Save search — shown when any meaningful filter is active and user is authenticated
                  if (authState.status == AuthStatus.authenticated &&
                      (_searchController.text.isNotEmpty ||
                       (offersState.cityId ?? businessesState.cityId) != null ||
                       (offersState.categoryId ?? businessesState.categoryId) != null)) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _FilterChip(
                      label: AppLocalizations.of(context)!.saveSearch,
                      isActive: false,
                      icon: Icons.bookmark_add_outlined,
                      onTap: () => _saveCurrentSearch(offersState, businessesState),
                    ),
                  ],
                  // Clear all — shown when any filter is active or prefs is off
                  if ((offersState.cityId ?? businessesState.cityId) != null ||
                      (offersState.categoryId ?? businessesState.categoryId) != null ||
                      offersState.sort != null ||
                      !offersState.prefsActive) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _FilterChip(
                      label: AppLocalizations.of(context)!.resetFilters,
                      isActive: false,
                      icon: Icons.close,
                      onTap: _clearFilters,
                      semanticsLabel: 'Reseteaza filtrele',
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
                  tabs: [
                    Tab(text: AppLocalizations.of(context)!.offers),
                    Tab(text: AppLocalizations.of(context)!.businesses),
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
                  AppLocalizations.of(context)!.showingResults(count, total, isOffers ? AppLocalizations.of(context)!.offers.toLowerCase() : AppLocalizations.of(context)!.businesses.toLowerCase()),
                  style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                ),
              );
            }),

            // Location banner (shown only when location NOT granted)
            LocationBanner(key: ValueKey(_locationCheckKey)),
                      ],
                    ),
            ),

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
        message: AppLocalizations.of(context)!.errorLoadingOffers,
        onRetry: () => ref.read(offersListProvider.notifier).fetch(),
      );
    }
    if (state.offers.isEmpty) {
      return EmptyState(
        icon: Icons.local_offer_outlined,
        title: AppLocalizations.of(context)!.noOfferFound,
        subtitle: AppLocalizations.of(context)!.tryOtherFilters,
        actionLabel: AppLocalizations.of(context)!.resetFilters,
        onAction: _clearFilters,
      );
    }
    // Auto-resort when new items arrive via loadMore
    if (_isDistanceSort && _userPosition != null && state.offers.length > (_distanceSortedOffers?.length ?? 0)) {
      _sortCurrentOffersByDistance();
    }
    // Use distance-sorted list if active, otherwise normal provider list
    final displayOffers = (_isDistanceSort && _distanceSortedOffers != null)
        ? _distanceSortedOffers!
        : state.offers;
    return RefreshIndicator(
      color: AppColors.accent,
      backgroundColor: AppColors.bgCard,
      onRefresh: () async {
        await ref.read(offersListProvider.notifier).fetch();
        if (_isDistanceSort) _sortCurrentOffersByDistance();
      },
      child: ListView.separated(
        controller: _offersScrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.pagePadding, 0, AppSpacing.pagePadding, AppSpacing.huge,
        ),
        itemCount: displayOffers.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= displayOffers.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
            );
          }
          return FadeInItem(
            index: index,
            child: OfferCard(offer: displayOffers[index]),
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
        message: AppLocalizations.of(context)!.errorLoadingBusinesses,
        onRetry: () => ref.read(businessesListProvider.notifier).fetch(),
      );
    }
    if (state.businesses.isEmpty) {
      return EmptyState(
        icon: Icons.store_outlined,
        title: AppLocalizations.of(context)!.noBusinessFound,
        subtitle: AppLocalizations.of(context)!.tryOtherFilters,
        actionLabel: AppLocalizations.of(context)!.resetFilters,
        onAction: _clearFilters,
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

  // Distance sort state (client-side only, overlays API results)
  bool _isDistanceSort = false;
  List<Offer>? _distanceSortedOffers;
  Position? _userPosition;

  String _sortLabel(String? sort) {
    final l = AppLocalizations.of(context)!;
    if (_isDistanceSort) return '📍 ${l.sortDistance}';
    switch (sort) {
      case 'popular':
        return '🔥 ${l.sortPopular}';
      case 'discount_desc':
        return '↓% ${l.sortDiscountShort}';
      case 'ending_soon':
        return '⏰ ${l.sortEndingSoon}';
      default:
        return '🕐 ${l.sorting}';
    }
  }

  Future<void> _saveCurrentSearch(OffersListState offersState, BusinessesListState businessesState) async {
    final query = _searchController.text.trim().isNotEmpty ? _searchController.text.trim() : null;
    final cityId = offersState.cityId ?? businessesState.cityId;
    final categoryId = offersState.categoryId ?? businessesState.categoryId;

    final success = await ref.read(savedSearchesProvider.notifier).create(
      query: query,
      cityId: cityId,
      categoryId: categoryId,
    );

    if (!mounted) return;
    final l = AppLocalizations.of(context)!;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(success ? l.searchSaved : l.searchSaveError),
        backgroundColor: success ? AppColors.bgSecondary : AppColors.danger,
      ),
    );
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

    final l = AppLocalizations.of(context)!;
    _showGlassBottomSheet(
      child: _PickerSheet(
        title: l.chooseCity,
        items: [
          _PickerItem(label: l.allCities, value: null),
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

    final l = AppLocalizations.of(context)!;
    _showGlassBottomSheet(
      child: _PickerSheet(
        title: l.chooseCategory,
        items: [
          _PickerItem(label: l.allCategories, value: null),
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
    final l = AppLocalizations.of(context)!;
    _showGlassBottomSheet(
      child: _PickerSheet(
        title: l.sorting,
        items: [
          _PickerItem(label: '🕐 ${l.sortDefault}', value: null),
          _PickerItem(label: '🔥 ${l.sortPopular}', value: 'popular'),
          _PickerItem(label: '↓% ${l.sortDiscount}', value: 'discount_desc'),
          _PickerItem(label: '⏰ ${l.sortEndingSoon}', value: 'ending_soon'),
          _PickerItem(label: '📍 ${l.sortDistance}', value: 'distance'),
        ],
        onSelected: (value) {
          Navigator.pop(context);
          if (value == 'distance') {
            _applyDistanceSort();
          } else {
            setState(() => _isDistanceSort = false);
            ref.read(offersListProvider.notifier).setFilter(sort: value);
          }
          setState(() {});
        },
      ),
    );
  }

  Future<void> _applyDistanceSort() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        await Geolocator.openLocationSettings();
        return;
      }
      if (permission == LocationPermission.denied) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(AppLocalizations.of(context)!.locationUnavailable)),
          );
        }
        return;
      }
      _userPosition ??= await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(timeLimit: Duration(seconds: 8)),
      );
      if (!mounted) return;

      _sortCurrentOffersByDistance();
      setState(() {
        _isDistanceSort = true;
        _locationCheckKey++;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context)!.locationError)),
        );
      }
    }
  }

  void _sortCurrentOffersByDistance() {
    if (_userPosition == null) return;
    final pos = _userPosition!;
    final offersState = ref.read(offersListProvider);
    final sorted = List<Offer>.from(offersState.offers);
    sorted.sort((a, b) {
      final aLat = a.business?.lat ?? a.locations?.firstOrNull?.lat;
      final aLng = a.business?.lng ?? a.locations?.firstOrNull?.lng;
      final bLat = b.business?.lat ?? b.locations?.firstOrNull?.lat;
      final bLng = b.business?.lng ?? b.locations?.firstOrNull?.lng;
      final aHas = aLat != null && aLng != null;
      final bHas = bLat != null && bLng != null;
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1;
      if (!bHas) return -1;
      final aDist = DistanceUtils.haversine(pos.latitude, pos.longitude, aLat, aLng);
      final bDist = DistanceUtils.haversine(pos.latitude, pos.longitude, bLat, bLng);
      return aDist.compareTo(bDist);
    });
    _distanceSortedOffers = sorted;
  }
}

// Search history dropdown — shown when search focused + empty text
class _SearchHistoryDropdown extends ConsumerWidget {
  final ValueChanged<String> onSelect;
  final VoidCallback onDismiss;

  const _SearchHistoryDropdown({
    required this.onSelect,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(searchHistoryProvider);
    if (history.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 4),
      decoration: BoxDecoration(
        color: AppColors.bgSecondary,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 8, 4),
            child: Row(
              children: [
                Icon(Icons.history, size: 14, color: AppColors.textTertiary),
                const SizedBox(width: 6),
                Text(
                  AppLocalizations.of(context)!.recentSearches,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
                const Spacer(),
                GestureDetector(
                  onTap: () {
                    ref.read(searchHistoryProvider.notifier).clearAll();
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Text(
                      AppLocalizations.of(context)!.deleteAll,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Items
          ...history.map((query) => InkWell(
            onTap: () => onSelect(query),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      query,
                      style: AppTypography.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      ref.read(searchHistoryProvider.notifier).removeQuery(query);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: Icon(Icons.close, size: 14, color: AppColors.textTertiary),
                    ),
                  ),
                ],
              ),
            ),
          )),
          const SizedBox(height: 4),
        ],
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
    return Semantics(
      label: 'Preferinte',
      button: true,
      selected: isActive,
      child: GestureDetector(
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
                AppLocalizations.of(context)!.myPreferences,
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
  final String? semanticsLabel;

  const _FilterChip({
    required this.label,
    required this.isActive,
    this.icon,
    required this.onTap,
    this.semanticsLabel,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: semanticsLabel ?? label,
      button: true,
      child: GestureDetector(
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
