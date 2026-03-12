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
import '../../widgets/empty_state.dart';
import '../../widgets/location_banner.dart';
import '../../providers/recently_viewed_provider.dart';
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


    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.accent,
          backgroundColor: AppColors.bgCard,
          onRefresh: () async {
            ref.invalidate(feedProvider);
            ref.invalidate(popularOffersProvider);
            ref.invalidate(promotedOffersProvider);
            ref.invalidate(homeBusinessesProvider);
            ref.invalidate(categoriesProvider);
            ref.invalidate(citiesProvider);
            ref.invalidate(dealOfDayProvider);
            ref.invalidate(recentlyViewedOffersProvider);
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
                          'Cele mai bune oferte din orașul tău',
                          style: AppTypography.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                          ),
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
                  index: 1,
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

              // Recently Viewed (hidden when empty)
              SliverToBoxAdapter(
                child: Consumer(
                  builder: (context, ref, _) {
                    final recentAsync = ref.watch(recentlyViewedOffersProvider);
                    return recentAsync.when(
                      data: (offers) {
                        if (offers.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SectionHeader(title: 'Vazute recent'),
                            const SizedBox(height: AppSpacing.md),
                            SizedBox(
                              height: 288,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.pagePadding,
                                ),
                                itemCount: offers.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: AppSpacing.md),
                                itemBuilder: (context, index) => OfferCard(
                                  offer: offers[index],
                                  horizontal: true,
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],
                        );
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    );
                  },
                ),
              ),

              // Location banner (hidden when location granted or dismissed)
              SliverToBoxAdapter(child: LocationBanner()),

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
                            return const EmptyState(
                              icon: Icons.local_offer_outlined,
                              title: 'Nicio oferta disponibila',
                              subtitle: 'Revino mai tarziu pentru oferte noi',
                            );
                          }
                          return SizedBox(
                            height: 288,
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

              // Promoted Offers (Premium businesses)
              SliverToBoxAdapter(
                child: Consumer(
                  builder: (context, ref, _) {
                    final promotedAsync = ref.watch(promotedOffersProvider);
                    return promotedAsync.when(
                      data: (promoted) {
                        if (promoted.isEmpty) return const SizedBox.shrink();
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SectionHeader(title: 'Oferte Promovate'),
                            const SizedBox(height: AppSpacing.md),
                            SizedBox(
                              height: 288,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                                itemCount: promoted.length,
                                separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.md),
                                itemBuilder: (_, i) => SizedBox(
                                  width: 280,
                                  child: OfferCard(offer: promoted[i], horizontal: true),
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],
                        );
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    );
                  },
                ),
              ),

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
                      child: EmptyState(
                        icon: Icons.store_outlined,
                        title: 'Niciun business disponibil',
                        subtitle: 'Revino mai tarziu',
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

