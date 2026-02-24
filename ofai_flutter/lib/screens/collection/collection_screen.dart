import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/subscriptions_provider.dart';
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
  String? _sortMode; // 'name_asc' | 'rating_desc' (subscriptions only)
  bool _didFetch = false;

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
      ref.read(subscriptionsProvider.notifier).fetch();
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
      ref.read(subscriptionsProvider.notifier).loadMore();
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
            title: 'Conectează-te pentru a salva oferte',
            subtitle: 'Salvează ofertele preferate și urmărește business-urile favorite',
            actionLabel: 'Conectează-te',
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
              child: Text('Colecția mea', style: AppTypography.displaySmall),
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
                  hintText: _tabController.index == 0 ? 'Caută în favorite...' : 'Caută în urmărite...',
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

            // Sort chips (only for Urmărite tab)
            if (_tabController.index == 1) ...[
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                  children: [
                    _CollectionSortChip(
                      label: 'Nume A-Z',
                      isActive: _sortMode == 'name_asc',
                      onTap: () => setState(() => _sortMode = _sortMode == 'name_asc' ? null : 'name_asc'),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    _CollectionSortChip(
                      label: 'Rating',
                      isActive: _sortMode == 'rating_desc',
                      onTap: () => setState(() => _sortMode = _sortMode == 'rating_desc' ? null : 'rating_desc'),
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
                tabs: const [
                  Tab(text: 'Favorite'),
                  Tab(text: 'Urmărite'),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),

            // Tab content
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _FavoritesTab(scrollController: _favScrollController, searchQuery: _searchQuery),
                  _SubscriptionsTab(scrollController: _subScrollController, searchQuery: _searchQuery, sortMode: _sortMode),
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

  const _FavoritesTab({required this.scrollController, required this.searchQuery});

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
            Text('Eroare la încărcare', style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: () => ref.read(favoritesProvider.notifier).fetch(),
              child: const Text('Reîncearcă'),
            ),
          ],
        ),
      );
    }

    if (state.offers.isEmpty) {
      return const EmptyState(
        icon: Icons.bookmark_outline,
        title: 'Nu ai oferte favorite',
        subtitle: 'Salvează oferte din pagina de explorare sau din detaliile unei oferte',
      );
    }

    final filtered = searchQuery.isEmpty
        ? state.offers
        : state.offers.where((o) =>
            o.title.toLowerCase().contains(searchQuery) ||
            (o.business?.name.toLowerCase().contains(searchQuery) ?? false)
          ).toList();

    if (filtered.isEmpty && searchQuery.isNotEmpty) {
      return const EmptyState(
        icon: Icons.search_off,
        title: 'Niciun rezultat',
        subtitle: 'Nicio ofertă favorită nu corespunde căutării',
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
          return Dismissible(
            key: ValueKey('fav_${offer.id}'),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: AppSpacing.xxl),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              ),
              child: const Icon(Icons.delete_outline, color: AppColors.danger),
            ),
            onDismissed: (_) {
              ref.read(favoritesProvider.notifier).toggleFavorite(offer.id);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('${offer.title} eliminată din favorite'),
                  backgroundColor: AppColors.bgSecondary,
                  action: SnackBarAction(
                    label: 'Anulează',
                    textColor: AppColors.accent,
                    onPressed: () => ref.read(favoritesProvider.notifier).toggleFavorite(offer.id),
                  ),
                ),
              );
            },
            child: OfferCard(offer: offer),
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

  const _SubscriptionsTab({required this.scrollController, required this.searchQuery, this.sortMode});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(subscriptionsProvider);

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
            Text('Eroare la încărcare', style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary)),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: () => ref.read(subscriptionsProvider.notifier).fetch(),
              child: const Text('Reîncearcă'),
            ),
          ],
        ),
      );
    }

    if (state.businesses.isEmpty) {
      return const EmptyState(
        icon: Icons.store_outlined,
        title: 'Nu urmărești niciun business',
        subtitle: 'Urmărește business-uri pentru a primi notificări despre ofertele lor',
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
    }

    if (filtered.isEmpty && searchQuery.isNotEmpty) {
      return const EmptyState(
        icon: Icons.search_off,
        title: 'Niciun rezultat',
        subtitle: 'Niciun business urmărit nu corespunde căutării',
      );
    }

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () => ref.read(subscriptionsProvider.notifier).fetch(),
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
          return Dismissible(
            key: ValueKey('sub_${biz.id}'),
            direction: DismissDirection.endToStart,
            background: Container(
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(right: AppSpacing.xxl),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              ),
              child: const Icon(Icons.delete_outline, color: AppColors.danger),
            ),
            onDismissed: (_) {
              ref.read(subscriptionsProvider.notifier).toggleSubscription(biz.id);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('${biz.name} eliminat din urmărite'),
                  backgroundColor: AppColors.bgSecondary,
                  action: SnackBarAction(
                    label: 'Anulează',
                    textColor: AppColors.accent,
                    onPressed: () => ref.read(subscriptionsProvider.notifier).toggleSubscription(biz.id),
                  ),
                ),
              );
            },
            child: BusinessCard(business: biz),
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
