import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/offers_provider.dart';
import '../../providers/businesses_provider.dart';
import '../../providers/static_data_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/offer_card.dart';
import '../../widgets/business_card.dart';
import '../../widgets/category_chip.dart';
import '../../widgets/skeleton_loader.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fade_in_item.dart';
import '../../widgets/section_header.dart';

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
                        _StatPill(
                          value: categoriesAsync.when(
                            data: (cats) {
                              final total = cats.fold<int>(0, (sum, c) => sum + (c.count ?? 0));
                              return total > 0 ? '$total+' : '-';
                            },
                            loading: () => '...',
                            error: (_, __) => '-',
                          ),
                          label: 'Business-uri',
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _StatPill(
                          value: offersAsync.when(
                            data: (offers) => offers.isNotEmpty ? '${offers.length}+' : '-',
                            loading: () => '...',
                            error: (_, __) => '-',
                          ),
                          label: 'Oferte active',
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        _StatPill(
                          value: categoriesAsync.when(
                            data: (cats) => '${cats.length}',
                            loading: () => '...',
                            error: (_, __) => '-',
                          ),
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

              // Offers section
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 5,
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
                            height: 280,
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

              // Businesses section header
              SliverToBoxAdapter(
                child: FadeInItem(
                  index: 6,
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


class _StatPill extends StatelessWidget {
  final String value;
  final String label;

  const _StatPill({required this.value, required this.label});

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
            Text(
              value,
              style: AppTypography.headlineSmall.copyWith(color: AppColors.accent),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: AppTypography.captionMuted,
            ),
          ],
        ),
      ),
    );
  }
}
