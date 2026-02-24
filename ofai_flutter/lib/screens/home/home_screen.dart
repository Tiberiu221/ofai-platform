import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/offers_provider.dart';
import '../../providers/businesses_provider.dart';
import '../../models/business.dart';
import '../../providers/static_data_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/offer_card.dart';
import '../../widgets/business_card.dart';
import '../../widgets/category_chip.dart';
import '../../widgets/skeleton_loader.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fade_in_item.dart';
import '../../widgets/section_header.dart';
import '../../widgets/featured_offer_card.dart';
import '../../providers/gamification_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  final _searchController = TextEditingController();
  final _searchFocusNode = FocusNode();
  bool _hasFetchedGamification = false;

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }

  void _onSearchSubmit(String query) {
    if (query.trim().isEmpty) {
      context.go('/explore');
    } else {
      context.go('/explore?q=${Uri.encodeComponent(query.trim())}');
    }
    _searchController.clear();
    _searchFocusNode.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;
    final offersAsync = ref.watch(isLoggedIn ? feedProvider : popularOffersProvider);
    final businessesAsync = ref.watch(homeBusinessesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);
    final citiesAsync = ref.watch(citiesProvider);
    final dealAsync = ref.watch(dealOfDayProvider);
    final gamState = isLoggedIn ? ref.watch(gamificationProvider) : null;

    // Trigger gamification fetch once per session for logged-in users
    if (isLoggedIn && !_hasFetchedGamification) {
      _hasFetchedGamification = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) ref.read(gamificationProvider.notifier).fetch();
      });
    }

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accent,
          backgroundColor: AppColors.bgCard,
          onRefresh: () async {
            ref.invalidate(feedProvider);
            ref.invalidate(popularOffersProvider);
            ref.invalidate(homeBusinessesProvider);
            ref.invalidate(categoriesProvider);
            ref.invalidate(citiesProvider);
            ref.invalidate(dealOfDayProvider);
            if (isLoggedIn) ref.read(gamificationProvider.notifier).fetch();
          },
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 0,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.pagePadding,
                      AppSpacing.xxl,
                      AppSpacing.pagePadding,
                      AppSpacing.lg,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OFAI',
                          style: AppTypography.displayLarge.copyWith(
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Descopera cele mai bune oferte',
                          style: AppTypography.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                        // Streak pill
                        if (isLoggedIn && gamState != null && gamState.currentStreak > 0) ...[
                          const SizedBox(height: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.accent.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                              border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('\u{1F525}', style: TextStyle(fontSize: 14)),
                                const SizedBox(width: 4),
                                Text(
                                  '${gamState.currentStreak} ${gamState.currentStreak == 1 ? 'zi' : 'zile'} consecutiv${gamState.currentStreak > 1 ? 'e' : ''}',
                                  style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),

              // Stats row (dynamic)
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 1,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                    child: Row(
                      children: [
                        _AnimatedStatPill(
                          targetValue: categoriesAsync.whenOrNull(
                            data: (cats) => cats.fold<int>(0, (sum, c) => sum + (c.count ?? 0)),
                          ),
                          label: 'Business-uri',
                          suffix: '+',
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _AnimatedStatPill(
                          targetValue: ref.watch(offersCountProvider).whenOrNull(data: (t) => t),
                          label: 'Oferte active',
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _AnimatedStatPill(
                          targetValue: categoriesAsync.whenOrNull(data: (cats) => cats.length),
                          label: 'Categorii',
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),

              // Search bar — submit navigates to Explore with query
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 2,
                  child: Padding(
                    padding: AppSpacing.pageH,
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocusNode,
                      onSubmitted: _onSearchSubmit,
                      textInputAction: TextInputAction.search,
                      style: AppTypography.bodyMedium,
                      decoration: InputDecoration(
                        hintText: 'Cauta oferte, business-uri...',
                        hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _searchController,
                          builder: (_, value, __) => value.text.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () {
                                    _searchController.clear();
                                  },
                                )
                              : const SizedBox.shrink(),
                        ),
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
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),

              // Categorii
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: 'Categorii',
                        onViewAll: () => context.push('/categories'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      categoriesAsync.when(
                        data: (categories) => SizedBox(
                          height: 44,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                            itemCount: categories.length,
                            separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final cat = categories[index];
                              return CategoryChip(
                                category: cat,
                                onTap: () => context.go('/explore?category=${cat.id}'),
                              );
                            },
                          ),
                        ),
                        loading: () => const SizedBox(height: 44),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),

              // Orase
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: 'Descopera orase',
                        onViewAll: () => context.push('/cities'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      citiesAsync.when(
                        data: (cities) => SizedBox(
                          height: 40,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                            itemCount: cities.length,
                            separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final city = cities[index];
                              return GestureDetector(
                                onTap: () => context.push('/explore?city=${city.id}'),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.lg,
                                    vertical: AppSpacing.sm,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(Icons.location_on_outlined, size: 16, color: AppColors.accent),
                                      const SizedBox(width: AppSpacing.xs),
                                      Text(city.name, style: AppTypography.labelMedium),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        loading: () => const SizedBox(height: 40),
                        error: (_, __) => const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),

              // Deal of the Day
              SliverToBoxAdapter(
                child: dealAsync.when(
                  data: (deal) {
                    if (deal == null) return const SizedBox.shrink();
                    return FadeInItem(
                      index: 5,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SectionHeader(title: 'Oferta Zilei'),
                          const SizedBox(height: AppSpacing.md),
                          Padding(
                            padding: AppSpacing.pageH,
                            child: FeaturedOfferCard(offer: deal),
                          ),
                        ],
                      ),
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),

              // Offers section
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 6,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: isLoggedIn ? 'Pentru tine' : 'Oferte populare',
                        onViewAll: () => context.go('/explore'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      offersAsync.when(
                        data: (offers) {
                          if (offers.isEmpty) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                              child: Center(
                                child: Text('Nicio oferta disponibila', style: TextStyle(color: AppColors.textTertiary)),
                              ),
                            );
                          }
                          return SizedBox(
                            height: 300,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                              itemCount: offers.length,
                              separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.md),
                              itemBuilder: (context, index) => OfferCard(
                                offer: offers[index],
                                horizontal: true,
                              ),
                            ),
                          );
                        },
                        loading: () => const SkeletonHorizontalList(),
                        error: (err, _) => Padding(
                          padding: AppSpacing.pageH,
                          child: w.ErrorState(
                            message: 'Nu s-au putut incarca ofertele',
                            onRetry: () {
                              ref.invalidate(feedProvider);
                              ref.invalidate(popularOffersProvider);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.xxl)),

              // Marquee logos
              SliverToBoxAdapter(
                child: businessesAsync.when(
                  data: (businesses) {
                    if (businesses.isEmpty) return const SizedBox.shrink();
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: AppSpacing.pageH,
                          child: Text(
                            'Business-uri partenere',
                            style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        _MarqueeLogos(businesses: businesses),
                        const SizedBox(height: AppSpacing.xxl),
                      ],
                    );
                  },
                  loading: () => const SizedBox.shrink(),
                  error: (_, __) => const SizedBox.shrink(),
                ),
              ),

              // Businesses section header
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 7,
                  child: SectionHeader(
                    title: 'Business-uri',
                    onViewAll: () => context.go('/explore'),
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.md)),

              // Businesses vertical list
              businessesAsync.when(
                data: (businesses) {
                  if (businesses.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                        child: Center(
                          child: Text('Niciun business disponibil', style: TextStyle(color: AppColors.textTertiary)),
                        ),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                    sliver: SliverList.separated(
                      itemCount: businesses.length,
                      separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                      itemBuilder: (context, index) => FadeInItem(
                        index: index,
                        child: BusinessCard(business: businesses[index]),
                      ),
                    ),
                  );
                },
                loading: () => SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                  sliver: SliverToBoxAdapter(
                    child: SkeletonLoader(count: 4, type: SkeletonType.businessCard),
                  ),
                ),
                error: (err, _) => SliverToBoxAdapter(
                  child: Padding(
                    padding: AppSpacing.pageH,
                    child: w.ErrorState(
                      message: 'Nu s-au putut incarca business-urile',
                      onRetry: () => ref.invalidate(homeBusinessesProvider),
                    ),
                  ),
                ),
              ),

              // Bottom padding
              const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.huge)),
            ],
          ),
        ),
      ),
    );
  }
}


class _MarqueeLogos extends StatefulWidget {
  final List<Business> businesses;

  const _MarqueeLogos({required this.businesses});

  @override
  State<_MarqueeLogos> createState() => _MarqueeLogosState();
}

class _MarqueeLogosState extends State<_MarqueeLogos> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  static const double _itemWidth = 80;
  static const double _itemSpacing = 12;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(seconds: widget.businesses.length * 3),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final totalItemWidth = _itemWidth + _itemSpacing;
    final listWidth = widget.businesses.length * totalItemWidth;

    return SizedBox(
      height: _itemWidth,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final offset = _controller.value * listWidth;
          return ClipRect(
            child: OverflowBox(
              maxWidth: double.infinity,
              alignment: Alignment.centerLeft,
              child: Transform.translate(
                offset: Offset(-offset, 0),
                child: child,
              ),
            ),
          );
        },
        child: Row(
          children: [
            // Double the list for seamless looping
            ...List.generate(2, (_) => widget.businesses).expand((list) => list).map((biz) {
              final name = biz.name;
              final logoUrl = biz.logoUrl;
              return Padding(
                padding: const EdgeInsets.only(right: _itemSpacing),
                child: SizedBox(
                  width: _itemWidth,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: SizedBox(
                          width: 48,
                          height: 48,
                          child: logoUrl != null && logoUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: logoUrl,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => _MarqueeInitial(name),
                                )
                              : _MarqueeInitial(name),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        name,
                        style: AppTypography.captionMuted,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _MarqueeInitial extends StatelessWidget {
  final String name;
  const _MarqueeInitial(this.name);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.bgSecondary,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: AppTypography.labelLarge.copyWith(color: AppColors.textSecondary),
        ),
      ),
    );
  }
}

class _AnimatedStatPill extends StatefulWidget {
  final int? targetValue;
  final String label;
  final String? suffix;

  const _AnimatedStatPill({required this.targetValue, required this.label, this.suffix});

  @override
  State<_AnimatedStatPill> createState() => _AnimatedStatPillState();
}

class _AnimatedStatPillState extends State<_AnimatedStatPill>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  bool _hasAnimated = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _animation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    if (widget.targetValue != null && widget.targetValue! > 0) {
      _hasAnimated = true;
      _controller.forward();
    }
  }

  @override
  void didUpdateWidget(covariant _AnimatedStatPill oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.targetValue != null && widget.targetValue! > 0 && !_hasAnimated) {
      _hasAnimated = true;
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            if (widget.targetValue == null || widget.targetValue == 0)
              Text(
                widget.targetValue == 0 ? '0' : '...',
                style: AppTypography.headlineSmall.copyWith(color: AppColors.accent),
              )
            else
              AnimatedBuilder(
                animation: _animation,
                builder: (_, __) {
                  final value = (_animation.value * widget.targetValue!).round();
                  return Text(
                    '$value${widget.suffix ?? ''}',
                    style: AppTypography.headlineSmall.copyWith(color: AppColors.accent),
                  );
                },
              ),
            const SizedBox(height: 2),
            Text(widget.label, style: AppTypography.captionMuted),
          ],
        ),
      ),
    );
  }
}
