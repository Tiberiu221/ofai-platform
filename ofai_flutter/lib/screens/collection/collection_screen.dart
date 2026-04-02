import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/distance.dart';
import '../../providers/auth_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../widgets/offer_card.dart';
import '../../widgets/business_card.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/skeleton_loader.dart';

class CollectionScreen extends ConsumerStatefulWidget {
  const CollectionScreen({super.key});

  @override
  ConsumerState<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends ConsumerState<CollectionScreen>
    with SingleTickerProviderStateMixin, AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  late TabController _tabController;
  final _favScrollController = ScrollController();
  final _subScrollController = ScrollController();
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String? _sortMode; // 'name_asc' | 'rating_desc' | 'distance' (both tabs)
  bool _didFetch = false;
  Position? _userPosition;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) setState(() {});
    });
    _favScrollController.addListener(_onFavScroll);
    _subScrollController.addListener(_onSubScroll);
  }

  void _tryFetch() {
    final auth = ref.read(authProvider);
    if (auth.status == AuthStatus.authenticated && !_didFetch) {
      _didFetch = true;
      ref.read(favoritesProvider.notifier).fetch();
      ref.read(followedBusinessesProvider.notifier).fetch();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _favScrollController.dispose();
    _subScrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _onFavScroll() {
    if (_favScrollController.position.pixels >=
        _favScrollController.position.maxScrollExtent - 200) {
      ref.read(favoritesProvider.notifier).loadMore();
    }
  }

  void _onSubScroll() {
    if (_subScrollController.position.pixels >=
        _subScrollController.position.maxScrollExtent - 200) {
      ref.read(followedBusinessesProvider.notifier).loadMore();
    }
  }

  Future<void> _activateDistanceSort() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        await Geolocator.openLocationSettings();
        return;
      }
      if (permission == LocationPermission.denied) return;

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
      setState(() {
        _userPosition = pos;
        _sortMode = 'distance';
      });
    } catch (_) {
      // Location unavailable — silently ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    // Listen for auth changes to trigger fetch or reset
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated && !_didFetch) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
      } else if (next.status == AuthStatus.unauthenticated) {
        _didFetch = false;
      }
    });

    if (!isLoggedIn) {
      return Scaffold(
        body: SafeArea(
          child: EmptyState(
            icon: Icons.bookmark_outline,
            title: AppLocalizations.of(context)!.loginToSaveOffers,
            subtitle: AppLocalizations.of(context)!.loginToSaveSubtitle,
            actionLabel: AppLocalizations.of(context)!.signIn,
            onAction: () => context.push('/login'),
          ),
        ),
      );
    }

    // Trigger fetch after auth confirmed (post-frame to avoid setState during build)
    if (!_didFetch) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.xxl),
            Padding(
              padding: AppSpacing.pageH,
              child: Text(AppLocalizations.of(context)!.myCollection, style: AppTypography.displaySmall),
            ),
            const SizedBox(height: AppSpacing.md),

            // Search field
            Padding(
              padding: AppSpacing.pageH,
              child: TextField(
                controller: _searchController,
                onChanged: (v) => setState(() => _searchQuery = v.trim().toLowerCase()),
                style: AppTypography.bodyMedium,
                decoration: InputDecoration(
                  hintText: _tabController.index == 0 ? AppLocalizations.of(context)!.searchInOffers : AppLocalizations.of(context)!.searchInBusinesses,
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                  prefixIcon: const Icon(Icons.search, size: 20),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
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

            // Sort chips (both tabs)
            ...[
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                  children: [
                    // Common sort chips for both tabs
                    _CollectionSortChip(
                      label: AppLocalizations.of(context)!.sortNameAZ,
                      isActive: _sortMode == 'name_asc',
                      onTap: () => setState(() => _sortMode = _sortMode == 'name_asc' ? null : 'name_asc'),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _CollectionSortChip(
                      label: AppLocalizations.of(context)!.sortRating,
                      isActive: _sortMode == 'rating_desc',
                      onTap: () => setState(() => _sortMode = _sortMode == 'rating_desc' ? null : 'rating_desc'),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    // Favorites-only sort chips
                    if (_tabController.index == 0) ...[
                      _CollectionSortChip(
                        label: AppLocalizations.of(context)!.sortDiscountShort,
                        isActive: _sortMode == 'discount_desc',
                        onTap: () => setState(() => _sortMode = _sortMode == 'discount_desc' ? null : 'discount_desc'),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      _CollectionSortChip(
                        label: AppLocalizations.of(context)!.sortEndingSoonShort,
                        isActive: _sortMode == 'ending_soon',
                        onTap: () => setState(() => _sortMode = _sortMode == 'ending_soon' ? null : 'ending_soon'),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    _CollectionSortChip(
                      label: AppLocalizations.of(context)!.sortDistanceShort,
                      isActive: _sortMode == 'distance',
                      onTap: () {
                        if (_sortMode == 'distance') {
                          setState(() => _sortMode = null);
                        } else if (_userPosition != null) {
                          setState(() => _sortMode = 'distance');
                        } else {
                          _activateDistanceSort();
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: AppSpacing.md),

            // Tab bar
            Container(
              margin: AppSpacing.pageH,
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                labelColor: AppColors.bgPrimary,
                unselectedLabelColor: AppColors.textSecondary,
                labelStyle: AppTypography.labelMedium,
                dividerHeight: 0,
                tabs: [
                  Tab(text: AppLocalizations.of(context)!.offers),
                  Tab(text: AppLocalizations.of(context)!.businesses),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _FavoritesTab(scrollController: _favScrollController, searchQuery: _searchQuery, sortMode: _sortMode, userPosition: _userPosition),
                  _SubscriptionsTab(scrollController: _subScrollController, searchQuery: _searchQuery, sortMode: _sortMode, userPosition: _userPosition),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FavoritesTab extends ConsumerWidget {
  final ScrollController scrollController;
  final String searchQuery;
  final String? sortMode;
  final Position? userPosition;

  const _FavoritesTab({required this.scrollController, required this.searchQuery, this.sortMode, this.userPosition});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(favoritesProvider);

    if (state.isLoading) {
      return Padding(
        padding: AppSpacing.pageH,
        child: const SkeletonLoader(count: 3, type: SkeletonType.offerCard),
      );
    }

    if (state.error != null && state.offers.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(AppLocalizations.of(context)!.loadingError, style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: () => ref.read(favoritesProvider.notifier).fetch(),
              child: Text(AppLocalizations.of(context)!.retry),
            ),
          ],
        ),
      );
    }

    if (state.offers.isEmpty) {
      return EmptyState(
        icon: Icons.bookmark_outline,
        title: AppLocalizations.of(context)!.noFavoriteOffers,
        subtitle: AppLocalizations.of(context)!.noFavoriteOffersSubtitle,
      );
    }

    var filtered = searchQuery.isEmpty
        ? state.offers.toList()
        : state.offers.where((o) =>
            o.title.toLowerCase().contains(searchQuery) ||
            (o.business?.name.toLowerCase().contains(searchQuery) ?? false)
          ).toList();

    // Apply sort for favorites
    if (sortMode == 'name_asc') {
      filtered.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
    } else if (sortMode == 'rating_desc') {
      filtered.sort((a, b) => (b.business?.rating ?? 0).compareTo(a.business?.rating ?? 0));
    } else if (sortMode == 'discount_desc') {
      filtered.sort((a, b) => (b.discountValue ?? 0).compareTo(a.discountValue ?? 0));
    } else if (sortMode == 'ending_soon') {
      filtered.sort((a, b) {
        if (a.endDate == null && b.endDate == null) return 0;
        if (a.endDate == null) return 1;
        if (b.endDate == null) return -1;
        return a.endDate!.compareTo(b.endDate!);
      });
    } else if (sortMode == 'distance' && userPosition != null) {
      filtered.sort((a, b) {
        final aLat = a.business?.lat;
        final aLng = a.business?.lng;
        final bLat = b.business?.lat;
        final bLng = b.business?.lng;
        final aHas = aLat != null && aLng != null;
        final bHas = bLat != null && bLng != null;
        if (!aHas && !bHas) return 0;
        if (!aHas) return 1;
        if (!bHas) return -1;
        final aDist = DistanceUtils.haversine(userPosition!.latitude, userPosition!.longitude, aLat!, aLng!);
        final bDist = DistanceUtils.haversine(userPosition!.latitude, userPosition!.longitude, bLat!, bLng!);
        return aDist.compareTo(bDist);
      });
    }

    if (filtered.isEmpty && searchQuery.isNotEmpty) {
      return EmptyState(
        icon: Icons.search_off,
        title: AppLocalizations.of(context)!.noResults,
        subtitle: AppLocalizations.of(context)!.noFavoriteOfferMatch,
      );
    }

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () => ref.read(favoritesProvider.notifier).fetch(),
      child: ListView.separated(
        controller: scrollController,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding, vertical: AppSpacing.sm),
        itemCount: filtered.length + (state.isLoadingMore && searchQuery.isEmpty ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= filtered.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 2),
              ),
            );
          }
          final offer = filtered[index];
          return Stack(
            children: [
              OfferCard(offer: offer),
              Positioned(
                top: 52,
                left: 12,
                child: Semantics(
                  label: 'Elimină din favorite',
                  button: true,
                  child: GestureDetector(
                  onTap: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        backgroundColor: AppColors.bgSecondary,
                        title: Text('Elimină din favorite?', style: AppTypography.labelLarge),
                        content: Text(offer.title, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: Text(AppLocalizations.of(context)!.cancel, style: TextStyle(color: AppColors.textSecondary)),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: Text('Elimină', style: TextStyle(color: AppColors.danger)),
                          ),
                        ],
                      ),
                    );
                    if (confirm != true) return;
                    try {
                      await ref.read(favoritesProvider.notifier).toggleFavorite(offer.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(AppLocalizations.of(context)!.removedFromFavorites(offer.title)),
                            backgroundColor: AppColors.bgSecondary,
                            action: SnackBarAction(
                              label: AppLocalizations.of(context)!.cancel,
                              textColor: AppColors.accent,
                              onPressed: () => ref.read(favoritesProvider.notifier).toggleFavorite(offer.id),
                            ),
                          ),
                        );
                      }
                    } catch (_) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(AppLocalizations.of(context)!.removeError), backgroundColor: AppColors.danger),
                        );
                      }
                    }
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xB3111111),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border, width: 0.5),
                    ),
                    child: const Icon(Icons.close, size: 18, color: Color(0xFFEF4444)),
                  ),
                ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SubscriptionsTab extends ConsumerWidget {
  final ScrollController scrollController;
  final String searchQuery;
  final String? sortMode;
  final Position? userPosition;

  const _SubscriptionsTab({required this.scrollController, required this.searchQuery, this.sortMode, this.userPosition});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(followedBusinessesProvider);

    if (state.isLoading) {
      return Padding(
        padding: AppSpacing.pageH,
        child: const SkeletonLoader(count: 4, type: SkeletonType.businessCard),
      );
    }

    if (state.error != null && state.businesses.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(AppLocalizations.of(context)!.loadingError, style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: () => ref.read(followedBusinessesProvider.notifier).fetch(),
              child: Text(AppLocalizations.of(context)!.retry),
            ),
          ],
        ),
      );
    }

    if (state.businesses.isEmpty) {
      return EmptyState(
        icon: Icons.store_outlined,
        title: AppLocalizations.of(context)!.noFollowedBusinesses,
        subtitle: AppLocalizations.of(context)!.noFollowedBusinessesSubtitle,
      );
    }

    var filtered = searchQuery.isEmpty
        ? state.businesses.toList()
        : state.businesses.where((b) =>
            b.name.toLowerCase().contains(searchQuery) ||
            (b.categoryName.toLowerCase().contains(searchQuery))
          ).toList();

    // Apply sort
    if (sortMode == 'name_asc') {
      filtered.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    } else if (sortMode == 'rating_desc') {
      filtered.sort((a, b) => (b.rating ?? 0).compareTo(a.rating ?? 0));
    } else if (sortMode == 'distance' && userPosition != null) {
      filtered.sort((a, b) {
        final aHas = a.lat != null && a.lng != null;
        final bHas = b.lat != null && b.lng != null;
        if (!aHas && !bHas) return 0;
        if (!aHas) return 1;
        if (!bHas) return -1;
        final aDist = DistanceUtils.haversine(userPosition!.latitude, userPosition!.longitude, a.lat!, a.lng!);
        final bDist = DistanceUtils.haversine(userPosition!.latitude, userPosition!.longitude, b.lat!, b.lng!);
        return aDist.compareTo(bDist);
      });
    }

    if (filtered.isEmpty && searchQuery.isNotEmpty) {
      return EmptyState(
        icon: Icons.search_off,
        title: AppLocalizations.of(context)!.noResults,
        subtitle: AppLocalizations.of(context)!.noFollowedBusinessMatch,
      );
    }

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () => ref.read(followedBusinessesProvider.notifier).fetch(),
      child: ListView.separated(
        controller: scrollController,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding, vertical: AppSpacing.sm),
        itemCount: filtered.length + (state.isLoadingMore && searchQuery.isEmpty ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= filtered.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 2),
              ),
            );
          }
          final biz = filtered[index];
          return Stack(
            children: [
              BusinessCard(business: biz),
              Positioned(
                top: AppSpacing.sm,
                right: AppSpacing.sm,
                child: Semantics(
                  label: 'Nu mai urmări',
                  button: true,
                  child: GestureDetector(
                  onTap: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        backgroundColor: AppColors.bgSecondary,
                        title: Text('Nu mai urmări?', style: AppTypography.labelLarge),
                        content: Text(biz.name, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, false),
                            child: Text(AppLocalizations.of(context)!.cancel, style: TextStyle(color: AppColors.textSecondary)),
                          ),
                          TextButton(
                            onPressed: () => Navigator.pop(ctx, true),
                            child: Text('Elimină', style: TextStyle(color: AppColors.danger)),
                          ),
                        ],
                      ),
                    );
                    if (confirm != true) return;
                    try {
                      await ref.read(followedBusinessesProvider.notifier).toggleFollow(biz.id);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(AppLocalizations.of(context)!.removedFromFollowed(biz.name)),
                            backgroundColor: AppColors.bgSecondary,
                            action: SnackBarAction(
                              label: AppLocalizations.of(context)!.cancel,
                              textColor: AppColors.accent,
                              onPressed: () => ref.read(followedBusinessesProvider.notifier).toggleFollow(biz.id),
                            ),
                          ),
                        );
                      }
                    } catch (_) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(AppLocalizations.of(context)!.removeError), backgroundColor: AppColors.danger),
                        );
                      }
                    }
                  },
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xB3111111),
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.border, width: 0.5),
                    ),
                    child: const Icon(Icons.close, size: 18, color: Color(0xFFEF4444)),
                  ),
                ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _CollectionSortChip extends StatelessWidget {
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _CollectionSortChip({
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.accentMuted : AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(
            color: isActive ? AppColors.accent : AppColors.border,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.labelMedium.copyWith(
            color: isActive ? AppColors.accent : AppColors.textSecondary,
          ),
        ),
      ),
    );
  }
}
