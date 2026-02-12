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
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _favScrollController = ScrollController();
  final _subScrollController = ScrollController();
  bool _didFetch = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    // Listen for auth changes to trigger fetch
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated && !_didFetch) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
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
            const SizedBox(height: AppSpacing.lg),

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
                  _FavoritesTab(scrollController: _favScrollController),
                  _SubscriptionsTab(scrollController: _subScrollController),
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

  const _FavoritesTab({required this.scrollController});

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

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () => ref.read(favoritesProvider.notifier).fetch(),
      child: ListView.separated(
        controller: scrollController,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding, vertical: AppSpacing.sm),
        itemCount: state.offers.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= state.offers.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 2),
              ),
            );
          }
          final offer = state.offers[index];
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

  const _SubscriptionsTab({required this.scrollController});

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

    return RefreshIndicator(
      color: AppColors.accent,
      onRefresh: () => ref.read(subscriptionsProvider.notifier).fetch(),
      child: ListView.separated(
        controller: scrollController,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding, vertical: AppSpacing.sm),
        itemCount: state.businesses.length + (state.isLoadingMore ? 1 : 0),
        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
        itemBuilder: (context, index) {
          if (index >= state.businesses.length) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: CircularProgressIndicator(color: AppColors.accent, strokeWidth: 2),
              ),
            );
          }
          final biz = state.businesses[index];
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
