import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/launchers.dart';
import '../../models/business.dart' show Business, BusinessLocation, BusinessHours;
import '../../models/catalog.dart' show CatalogCategory;
import '../../models/offer.dart' show Booking;

import '../../providers/businesses_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../providers/reviews_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/offer_requests_provider.dart';
import '../../widgets/review_card.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/empty_state.dart';
import '../../widgets/subscription_badge.dart';
import '../../widgets/masonry_gallery.dart';
import '../../widgets/sticky_bottom_cta.dart';
import '../../widgets/venue_detail_row.dart';
import '../../services/analytics_service.dart';
import '../../widgets/report_dialog.dart';
import 'package:go_router/go_router.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

class BusinessDetailScreen extends ConsumerStatefulWidget {
  final int businessId;

  const BusinessDetailScreen({super.key, required this.businessId});

  @override
  ConsumerState<BusinessDetailScreen> createState() => _BusinessDetailScreenState();
}

class _BusinessDetailScreenState extends ConsumerState<BusinessDetailScreen>
    with TickerProviderStateMixin {
  late final TabController _tabController;
  late final ScrollController _scrollController;

  // GlobalKeys for each section — used for scroll-to and scroll spy
  final _offersKey = GlobalKey();
  final _galleryKey = GlobalKey();
  final _menuKey = GlobalKey();
  final _scheduleKey = GlobalKey();
  final _reviewsKey = GlobalKey();
  final _contactKey = GlobalKey();
  final _detailsKey = GlobalKey();

  bool _isScrollingToSection = false;

  List<GlobalKey> get _sectionKeys => [
        _offersKey,
        _galleryKey,
        _menuKey,
        _scheduleKey,
        _reviewsKey,
        _contactKey,
        _detailsKey,
      ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 7, vsync: this);
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Scroll spy — update tab index as user scrolls
  // ---------------------------------------------------------------------------

  void _onScroll() {
    if (_isScrollingToSection) return;
    if (!mounted) return;

    final screenHeight = MediaQuery.of(context).size.height;
    final threshold = screenHeight * 0.4;

    for (int i = _sectionKeys.length - 1; i >= 0; i--) {
      final keyContext = _sectionKeys[i].currentContext;
      if (keyContext != null) {
        final box = keyContext.findRenderObject() as RenderBox?;
        if (box == null) continue;
        final position = box.localToGlobal(Offset.zero);
        if (position.dy < threshold) {
          if (_tabController.index != i) {
            _tabController.animateTo(i);
          }
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Tab tap — scroll to section
  // ---------------------------------------------------------------------------

  void _onTabTapped(int index) {
    final keyContext = _sectionKeys[index].currentContext;
    if (keyContext == null) return;

    _isScrollingToSection = true;
    _tabController.animateTo(index);

    Scrollable.ensureVisible(
      keyContext,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
      alignment: 0.0,
    ).then((_) {
      Future.delayed(const Duration(milliseconds: 400), () {
        if (mounted) _isScrollingToSection = false;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final businessAsync = ref.watch(businessDetailProvider(widget.businessId));
    final subsState = ref.watch(followedBusinessesProvider);
    final reviewsState = ref.watch(businessReviewsProvider(widget.businessId));
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    return Scaffold(
      body: businessAsync.when(
        data: (business) {
          final isSub = subsState.followedIds.contains(business.id);
          final coverUrl = business.coverImage ??
              (business.images != null && business.images!.isNotEmpty
                  ? business.images!.first.url
                  : null) ??
              business.logoUrl;

          return Stack(
            children: [
              RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgCard,
                onRefresh: () async {
                  ref.invalidate(businessDetailProvider(widget.businessId));
                },
                child: CustomScrollView(
                  controller: _scrollController,
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    // Cover with parallax
                    SliverAppBar(
                      expandedHeight: 220,
                      pinned: true,
                      stretch: true,
                      backgroundColor: AppColors.bgPrimary,
                      actions: [
                        // Follow / unfollow icon button in app bar
                        if (isLoggedIn)
                          Semantics(
                            label: isSub
                                ? AppLocalizations.of(context)!.followed
                                : AppLocalizations.of(context)!.follow,
                            button: true,
                            child: IconButton(
                              icon: Icon(
                                isSub
                                    ? Icons.notifications_active
                                    : Icons.notifications_none,
                                color: isSub ? AppColors.accent : null,
                              ),
                              onPressed: () => ref
                                  .read(followedBusinessesProvider.notifier)
                                  .toggleFollow(business.id),
                            ),
                          ),
                        Semantics(
                          label: AppLocalizations.of(context)!.shareBusiness,
                          button: true,
                          child: IconButton(
                            icon: const Icon(Icons.share_outlined),
                            onPressed: () {
                              Launchers.shareBusiness(business.name, business.id);
                              AnalyticsService.trackClick(
                                  businessId: business.id, actionType: 'share');
                            },
                          ),
                        ),
                        if (isLoggedIn)
                          Semantics(
                            label: AppLocalizations.of(context)!.reportBusiness,
                            button: true,
                            child: PopupMenuButton<String>(
                              icon: const Icon(Icons.more_vert),
                              onSelected: (value) async {
                                if (value == 'report') {
                                  final sent = await showReportDialog(
                                    context: context,
                                    targetType: 'business',
                                    targetId: business.id,
                                  );
                                  if (sent && context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                          content: Text(AppLocalizations.of(
                                                  context)!
                                              .reportSent)),
                                    );
                                  }
                                }
                              },
                              itemBuilder: (ctx) => [
                                PopupMenuItem(
                                  value: 'report',
                                  child: Row(
                                    children: [
                                      const Icon(Icons.flag_outlined,
                                          size: 20,
                                          color: AppColors.textSecondary),
                                      const SizedBox(width: 8),
                                      Text(AppLocalizations.of(ctx)!.report),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                      flexibleSpace: LayoutBuilder(
                        builder: (context, constraints) {
                          final top = constraints.biggest.height;
                          final expandedHeight =
                              220 + MediaQuery.of(context).padding.top;
                          final collapsedHeight =
                              kToolbarHeight + MediaQuery.of(context).padding.top;
                          final scrollFraction =
                              ((expandedHeight - top) / (expandedHeight - collapsedHeight))
                                  .clamp(0.0, 1.0);
                          final parallaxOffset = scrollFraction * 30;

                          return FlexibleSpaceBar(
                            background: Stack(
                              fit: StackFit.expand,
                              children: [
                                Transform.translate(
                                  offset: Offset(0, parallaxOffset),
                                  child: coverUrl != null && coverUrl.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: coverUrl,
                                          fit: BoxFit.cover,
                                          placeholder: (_, __) => Container(
                                              color: AppColors.bgSecondary),
                                          errorWidget: (_, __, ___) => Container(
                                              color: AppColors.bgSecondary),
                                        )
                                      : Container(color: AppColors.bgSecondary),
                                ),
                                const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [
                                        Colors.transparent,
                                        Color(0xCC080808)
                                      ],
                                    ),
                                  ),
                                ),
                                // Logo overlay — bottom left on cover
                                Positioned(
                                  bottom: 16,
                                  left: 20,
                                  child: Container(
                                    width: 56,
                                    height: 56,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                          color: AppColors.bgPrimary, width: 2),
                                      boxShadow: [
                                        BoxShadow(
                                          color:
                                              Colors.black.withValues(alpha: 0.3),
                                          blurRadius: 6,
                                          offset: const Offset(0, 2),
                                        ),
                                      ],
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(10),
                                      child: business.logoUrl != null
                                          ? CachedNetworkImage(
                                              imageUrl: business.logoUrl!,
                                              fit: BoxFit.cover,
                                              errorWidget: (_, __, ___) =>
                                                  _Initial(business.name),
                                            )
                                          : _Initial(business.name),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),

                    // Profile header
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                            AppSpacing.pagePadding,
                            AppSpacing.pagePadding,
                            AppSpacing.pagePadding,
                            0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // "Manage on Web" banner for business owners
                            if (business.isOwner) ...[
                              GestureDetector(
                                onTap: () => Launchers.website(
                                    'https://ofai.ro/portal/${business.id}'),
                                child: Container(
                                  width: double.infinity,
                                  margin: const EdgeInsets.only(
                                      bottom: AppSpacing.lg),
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.md, vertical: 12),
                                  decoration: BoxDecoration(
                                    color: AppColors.accent.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(
                                        AppSpacing.cardRadiusSm),
                                    border: Border.all(
                                        color: AppColors.accent
                                            .withValues(alpha: 0.25)),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.edit_outlined,
                                          size: 20, color: AppColors.accent),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              AppLocalizations.of(context)!
                                                  .thisIsYourBusiness,
                                              style:
                                                  AppTypography.labelMedium
                                                      .copyWith(
                                                          color: AppColors.accent),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              AppLocalizations.of(context)!
                                                  .manageOnWeb,
                                              style: AppTypography.bodySmall
                                                  .copyWith(
                                                      color: AppColors
                                                          .textSecondary),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Icon(Icons.open_in_new,
                                          size: 18, color: AppColors.accent),
                                    ],
                                  ),
                                ),
                              ),
                            ],

                            // Name with badge
                            Row(
                              children: [
                                if (business.hasBadge) ...[
                                  GestureDetector(
                                    onTap: () => _showBadgeInfo(
                                        context, business.badgeType!),
                                    child: SubscriptionBadge(
                                        badgeType: business.badgeType, size: 24),
                                  ),
                                  const SizedBox(width: 8),
                                ],
                                Expanded(
                                  child: Semantics(
                                    label: 'Business: ${business.name}',
                                    header: true,
                                    child: Text(business.name,
                                        style: AppTypography.headlineLarge),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Semantics(
                              label:
                                  '${business.categoryName}, ${business.cityName}',
                              child: Text(
                                [business.categoryName, business.cityName]
                                    .where((s) => s.isNotEmpty)
                                    .join(' \u2022 '),
                                style: AppTypography.bodyMedium
                                    .copyWith(color: AppColors.textSecondary),
                              ),
                            ),

                            // Follower count
                            if (business.followerCount != null &&
                                business.followerCount! >= 3) ...[
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(Icons.people_outline,
                                      size: 14, color: AppColors.textTertiary),
                                  const SizedBox(width: 4),
                                  Text(
                                    AppLocalizations.of(context)!.followersCount(
                                        business.followerCount!),
                                    style: AppTypography.caption,
                                  ),
                                ],
                              ),
                            ],

                            // Rating row
                            const SizedBox(height: AppSpacing.lg),
                            Builder(builder: (_) {
                              final hasRating =
                                  business.rating != null && business.rating! > 0;
                              final rating = business.rating ?? 0.0;
                              return Row(
                                children: [
                                  ...List.generate(
                                      5,
                                      (i) => Icon(
                                            i < rating.round()
                                                ? Icons.star
                                                : Icons.star_border,
                                            size: 20,
                                            color: i < rating.round()
                                                ? AppColors.accent
                                                : AppColors.textTertiary,
                                          )),
                                  const SizedBox(width: AppSpacing.sm),
                                  if (hasRating) ...[
                                    Text(
                                      rating.toStringAsFixed(1),
                                      style: AppTypography.labelLarge
                                          .copyWith(color: AppColors.accent),
                                    ),
                                    if (business.ratingCount != null)
                                      Text(
                                        ' ${AppLocalizations.of(context)!.reviewsCount(business.ratingCount!)}',
                                        style: AppTypography.caption,
                                      ),
                                  ] else ...[
                                    Text(
                                      'Nicio recenzie',
                                      style: AppTypography.caption.copyWith(
                                          color: AppColors.textTertiary),
                                    ),
                                  ],
                                ],
                              );
                            }),
                            const SizedBox(height: AppSpacing.md),
                          ],
                        ),
                      ),
                    ),

                    // Pinned tab bar
                    SliverPersistentHeader(
                      pinned: true,
                      delegate: _TabBarDelegate(
                        TabBar(
                          controller: _tabController,
                          isScrollable: true,
                          labelColor: AppColors.accent,
                          unselectedLabelColor: AppColors.textSecondary,
                          indicatorColor: AppColors.accent,
                          indicatorSize: TabBarIndicatorSize.tab,
                          indicatorWeight: 2,
                          labelStyle: AppTypography.labelMedium,
                          splashFactory: NoSplash.splashFactory,
                          dividerColor: Colors.transparent,
                          tabAlignment: TabAlignment.start,
                          onTap: _onTabTapped,
                          tabs: const [
                            Tab(text: 'Oferte'),
                            Tab(text: 'Galerie'),
                            Tab(text: 'Meniu'),
                            Tab(text: 'Program'),
                            Tab(text: 'Recenzii'),
                            Tab(text: 'Contact'),
                            Tab(text: 'Detalii'),
                          ],
                        ),
                      ),
                    ),

                    // All sections in a single scrollable column
                    SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildOffersSection(context, business, isLoggedIn),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildGallerySection(context, business),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildMenuSection(context, business),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildScheduleSection(context, business),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildReviewsSection(
                              context, ref, business, reviewsState, isLoggedIn),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildContactSection(context, business),
                          const SizedBox(height: AppSpacing.xxl),
                          _buildDetailsSection(context, business),
                          // Bottom clearance for sticky CTA
                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Sticky bottom CTA
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _buildStickyCtaIfNeeded(business),
              ),
            ],
          );
        },
        loading: () =>
            const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message:
                AppLocalizations.of(context)!.errorLoadingBusiness,
            onRetry: () =>
                ref.invalidate(businessDetailProvider(widget.businessId)),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 0 — Oferte
  // ---------------------------------------------------------------------------

  Widget _buildOffersSection(
      BuildContext context, Business business, bool isLoggedIn) {
    return Container(
      key: _offersKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (business.activeOffers != null &&
              business.activeOffers!.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                border: Border.all(color: AppColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.local_offer_outlined,
                          size: 20, color: AppColors.accent),
                      const SizedBox(width: AppSpacing.sm),
                      Text(AppLocalizations.of(context)!.activeOffers,
                          style: AppTypography.headlineSmall),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          '${business.activeOffers!.length} ${business.activeOffers!.length == 1 ? "ofertă" : "oferte"}',
                          style: AppTypography.labelSmall
                              .copyWith(color: AppColors.accent),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  ...business.activeOffers!.map((offer) => Padding(
                        padding:
                            const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: InkWell(
                          onTap: () => context.push('/offer/${offer.id}'),
                          borderRadius:
                              BorderRadius.circular(AppSpacing.cardRadiusSm),
                          splashColor:
                              AppColors.accent.withValues(alpha: 0.1),
                          child: Container(
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: AppColors.bgCard,
                              borderRadius: BorderRadius.circular(
                                  AppSpacing.cardRadiusSm),
                              border: Border.all(
                                  color: AppColors.accent
                                      .withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              children: [
                                if (offer.discountLabel.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.accent,
                                      borderRadius:
                                          BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      offer.discountLabel,
                                      style: AppTypography.labelSmall
                                          .copyWith(
                                              color: AppColors.bgPrimary),
                                    ),
                                  ),
                                if (offer.discountLabel.isNotEmpty)
                                  const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: Text(
                                    offer.title,
                                    style: AppTypography.bodyMedium,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Icon(Icons.chevron_right,
                                    size: 18,
                                    color: AppColors.textTertiary),
                              ],
                            ),
                          ),
                        ),
                      )),
                ],
              ),
            ),
          ] else if (business.showPinch) ...[
            _PinchRequestCard(
              businessId: business.id,
              isLoggedIn: isLoggedIn,
            ),
          ] else ...[
            EmptyState(
              icon: Icons.local_offer_outlined,
              title: 'Nicio ofertă activă',
              subtitle: 'Momentan nu există oferte active pentru acest business.',
            ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 1 — Galerie
  // ---------------------------------------------------------------------------

  Widget _buildGallerySection(BuildContext context, Business business) {
    final imageUrls = business.images?.map((img) => img.url).toList() ?? [];

    return Container(
      key: _galleryKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: imageUrls.isEmpty
          ? EmptyState(
              icon: Icons.photo_library_outlined,
              title: 'Nicio fotografie',
              subtitle: 'Business-ul nu a adăugat fotografii încă.',
            )
          : MasonryGallery(imageUrls: imageUrls),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 2 — Meniu
  // ---------------------------------------------------------------------------

  Widget _buildMenuSection(BuildContext context, Business business) {
    return Container(
      key: _menuKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: business.catalog == null || business.catalog!.isEmpty
          ? EmptyState(
              icon: Icons.menu_book_outlined,
              title: 'Niciun meniu',
              subtitle: 'Business-ul nu a adăugat servicii sau produse încă.',
            )
          : _CatalogSection(categories: business.catalog!),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 3 — Program
  // ---------------------------------------------------------------------------

  Widget _buildScheduleSection(BuildContext context, Business business) {
    final hasHours = business.locations != null &&
        business.locations!.any(
            (loc) => loc.hours != null && loc.hours!.isNotEmpty);

    return Container(
      key: _scheduleKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: hasHours
          ? _OpeningHoursSection(locations: business.locations!)
          : EmptyState(
              icon: Icons.schedule_outlined,
              title: 'Program nedisponibil',
              subtitle: 'Business-ul nu a adăugat programul de lucru.',
            ),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 4 — Recenzii
  // ---------------------------------------------------------------------------

  Widget _buildReviewsSection(
    BuildContext context,
    WidgetRef ref,
    Business business,
    dynamic reviewsState,
    bool isLoggedIn,
  ) {
    return Container(
      key: _reviewsKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // AI review summary
          if (business.reviewSummary != null &&
              business.reviewSummary!.text.isNotEmpty) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.accentMuted,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                border: Border.all(
                    color: AppColors.accent.withValues(alpha: 0.3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.auto_awesome, size: 16, color: AppColors.accent),
                      const SizedBox(width: 6),
                      Text(
                          AppLocalizations.of(context)!.reviewSummary,
                          style: AppTypography.labelMedium
                              .copyWith(color: AppColors.accent)),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    business.reviewSummary!.text,
                    style: AppTypography.bodySmall
                        .copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          // Rating breakdown
          Semantics(
              label: AppLocalizations.of(context)!.reviews,
              header: true,
              child: Text(AppLocalizations.of(context)!.reviews,
                  style: AppTypography.headlineSmall)),
          if (business.ratingDistribution != null &&
              (business.ratingCount ?? 0) >= 3) ...[
            const SizedBox(height: AppSpacing.sm),
            _RatingBreakdown(
                distribution: business.ratingDistribution!,
                total: business.ratingCount ?? 0),
          ],

          // Write review button
          if (isLoggedIn) ...[
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: () => _showReviewSheet(context, ref),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius:
                      BorderRadius.circular(AppSpacing.pillRadius),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.edit,
                        size: 14, color: AppColors.bgPrimary),
                    const SizedBox(width: 4),
                    Text(
                      AppLocalizations.of(context)!.writeReview,
                      style: AppTypography.labelSmall
                          .copyWith(color: AppColors.bgPrimary),
                    ),
                  ],
                ),
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          // Review list
          if (reviewsState.isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.xxl),
                child:
                    CircularProgressIndicator(color: AppColors.accent),
              ),
            )
          else if (reviewsState.reviews.isEmpty)
            EmptyState(
              icon: Icons.rate_review_outlined,
              title: AppLocalizations.of(context)!.noReviewsYet,
              subtitle: AppLocalizations.of(context)!.beFirstToReview,
              actionLabel: isLoggedIn
                  ? AppLocalizations.of(context)!.writeReview
                  : null,
              onAction: isLoggedIn ? () => _showReviewSheet(context, ref) : null,
            )
          else ...[
            ...List.generate(reviewsState.reviews.length, (i) {
              final review = reviewsState.reviews[i];
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: ReviewCard(
                  review: review,
                  onDelete: review.isOwn
                      ? () => _confirmDeleteReview(
                          context, ref, widget.businessId, review.id)
                      : null,
                ),
              );
            }),

            // Load more
            if (reviewsState.hasMore)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: Center(
                  child: TextButton(
                    onPressed: () => ref
                        .read(businessReviewsProvider(widget.businessId)
                            .notifier)
                        .loadMore(),
                    child: Text(
                      AppLocalizations.of(context)!.loadMoreReviews,
                      style: AppTypography.labelMedium
                          .copyWith(color: AppColors.accent),
                    ),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 5 — Contact
  // ---------------------------------------------------------------------------

  Widget _buildContactSection(BuildContext context, Business business) {
    final hasContact = business.phone != null ||
        business.website != null ||
        (business.lat != null && business.lng != null) ||
        (business.bookingMethods != null &&
            business.bookingMethods!.isNotEmpty) ||
        (business.booking != null && business.booking!.hasBooking) ||
        (business.locations != null && business.locations!.length > 1);

    return Container(
      key: _contactKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: hasContact
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Contact rows
                if (business.phone != null)
                  VenueDetailRow(
                    icon: Icons.phone_outlined,
                    label: 'Telefon',
                    value: business.phone,
                    onTap: () {
                      Launchers.call(business.phone!);
                      AnalyticsService.trackClick(
                          businessId: business.id, actionType: 'phone');
                    },
                  ),
                if (business.website != null)
                  VenueDetailRow(
                    icon: Icons.language_outlined,
                    label: 'Website',
                    value: business.website,
                    onTap: () {
                      Launchers.website(business.website!);
                      AnalyticsService.trackClick(
                          businessId: business.id, actionType: 'website');
                    },
                  ),
                if (business.address != null)
                  VenueDetailRow(
                    icon: Icons.location_on_outlined,
                    label: 'Adresă',
                    value: business.address,
                    onTap: business.lat != null && business.lng != null
                        ? () {
                            Launchers.maps(business.lat!, business.lng!,
                                address: business.address);
                            AnalyticsService.trackClick(
                                businessId: business.id, actionType: 'navigate');
                          }
                        : null,
                  ),

                // Navigation button
                if (business.lat != null && business.lng != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  _ActionButton(
                    icon: Icons.navigation_outlined,
                    label: 'Navighează',
                    onTap: () {
                      Launchers.maps(business.lat!, business.lng!,
                          address: business.address);
                      AnalyticsService.trackClick(
                          businessId: business.id, actionType: 'navigate');
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Booking methods (multi-platform)
                if (business.bookingMethods != null &&
                    business.bookingMethods!.isNotEmpty) ...[
                  Text(AppLocalizations.of(context)!.booking,
                      style: AppTypography.headlineSmall),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: business.bookingMethods!.map((bm) {
                      return _BookingChip(
                        icon: bm.isPhone
                            ? Icons.phone
                            : bm.isWhatsApp
                                ? Icons.message
                                : Icons.language,
                        label: bm.label,
                        color: bm.color,
                        onTap: () {
                          if (bm.isPhone) {
                            Launchers.call(bm.value);
                          } else if (bm.isWhatsApp) {
                            Launchers.whatsApp(bm.value);
                          } else {
                            Launchers.website(bm.href);
                          }
                          AnalyticsService.trackClick(
                            businessId: business.id,
                            actionType: bm.isPhone
                                ? 'phone'
                                : bm.isWhatsApp
                                    ? 'whatsapp'
                                    : 'booking_url',
                          );
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ] else if (business.booking != null &&
                    business.booking!.hasBooking) ...[
                  Text(AppLocalizations.of(context)!.booking,
                      style: AppTypography.headlineSmall),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      if (business.booking!.phone != null)
                        _BookingChip(
                          icon: Icons.phone,
                          label: AppLocalizations.of(context)!.phone,
                          onTap: () {
                            Launchers.call(business.booking!.phone!);
                            AnalyticsService.trackClick(
                                businessId: business.id, actionType: 'phone');
                          },
                        ),
                      if (business.booking!.whatsapp != null)
                        _BookingChip(
                          icon: Icons.message,
                          label: 'WhatsApp',
                          onTap: () {
                            Launchers.whatsApp(business.booking!.whatsapp!);
                            AnalyticsService.trackClick(
                                businessId: business.id, actionType: 'whatsapp');
                          },
                        ),
                      if (business.booking!.url != null)
                        _BookingChip(
                          icon: Icons.language,
                          label: AppLocalizations.of(context)!.online,
                          onTap: () {
                            Launchers.website(business.booking!.url!);
                            AnalyticsService.trackClick(
                                businessId: business.id,
                                actionType: 'booking_url');
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Multiple locations
                if (business.locations != null &&
                    business.locations!.length > 1) ...[
                  Text(AppLocalizations.of(context)!.locations,
                      style: AppTypography.headlineSmall),
                  const SizedBox(height: AppSpacing.sm),
                  ...business.locations!.map((loc) {
                    final hasLocBooking =
                        _hasLocationBooking(loc, business.booking);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.bgCard,
                          borderRadius:
                              BorderRadius.circular(AppSpacing.cardRadiusSm),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            GestureDetector(
                              onTap: loc.lat != null && loc.lng != null
                                  ? () => Launchers.maps(loc.lat!, loc.lng!,
                                      address: loc.address)
                                  : null,
                              child: Row(
                                children: [
                                  Icon(Icons.location_on_outlined,
                                      size: 18,
                                      color: AppColors.textTertiary),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        if (loc.address != null)
                                          Text(loc.address!,
                                              style: AppTypography.bodyMedium),
                                        if (loc.city != null)
                                          Text(loc.city!.name,
                                              style: AppTypography.captionMuted),
                                      ],
                                    ),
                                  ),
                                  if (loc.lat != null)
                                    Icon(Icons.map_outlined,
                                        size: 18, color: AppColors.accent),
                                ],
                              ),
                            ),
                            if (hasLocBooking) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Wrap(
                                spacing: AppSpacing.xs,
                                runSpacing: AppSpacing.xs,
                                children: [
                                  if (loc.bookingPhone != null)
                                    _BookingChip(
                                      icon: Icons.phone,
                                      label: AppLocalizations.of(context)!.phone,
                                      onTap: () {
                                        Launchers.call(loc.bookingPhone!);
                                        AnalyticsService.trackClick(
                                            businessId: business.id,
                                            actionType: 'phone');
                                      },
                                    ),
                                  if (loc.bookingWhatsapp != null)
                                    _BookingChip(
                                      icon: Icons.message,
                                      label: 'WhatsApp',
                                      onTap: () {
                                        Launchers.whatsApp(loc.bookingWhatsapp!);
                                        AnalyticsService.trackClick(
                                            businessId: business.id,
                                            actionType: 'whatsapp');
                                      },
                                    ),
                                  if (loc.bookingUrl != null)
                                    _BookingChip(
                                      icon: Icons.language,
                                      label: AppLocalizations.of(context)!.online,
                                      onTap: () {
                                        Launchers.website(loc.bookingUrl!);
                                        AnalyticsService.trackClick(
                                            businessId: business.id,
                                            actionType: 'booking_url');
                                      },
                                    ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ],
            )
          : EmptyState(
              icon: Icons.contact_page_outlined,
              title: 'Fără date de contact',
              subtitle: 'Business-ul nu a adăugat date de contact.',
            ),
    );
  }

  // ---------------------------------------------------------------------------
  // Section 6 — Detalii
  // ---------------------------------------------------------------------------

  Widget _buildDetailsSection(BuildContext context, Business business) {
    final hasDescription = business.description != null &&
        business.description!.isNotEmpty;
    final hasLegal = business.denumireLegala != null ||
        business.cui != null ||
        business.foundedYear != null;

    return Container(
      key: _detailsKey,
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: (!hasDescription && !hasLegal)
          ? EmptyState(
              icon: Icons.info_outline,
              title: 'Fără detalii',
              subtitle: 'Business-ul nu a adăugat informații suplimentare.',
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // About / Description
                if (hasDescription) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: AppColors.bgSecondary,
                      borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Icon(Icons.info_outline,
                              size: 20, color: AppColors.accent),
                          const SizedBox(width: AppSpacing.sm),
                          Text('Despre ${business.name}',
                              style: AppTypography.headlineSmall),
                        ]),
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          business.description!,
                          style: AppTypography.bodyMedium
                              .copyWith(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],

                // Legal info
                if (hasLegal) ...[
                  Text('Informații legale', style: AppTypography.headlineSmall),
                  const SizedBox(height: AppSpacing.sm),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.cardRadiusSm),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        if (business.denumireLegala != null)
                          VenueDetailRow(
                            icon: Icons.business_outlined,
                            label: 'Denumire legală',
                            value: business.denumireLegala,
                            showDivider: business.cui != null ||
                                business.foundedYear != null,
                          ),
                        if (business.cui != null)
                          VenueDetailRow(
                            icon: Icons.badge_outlined,
                            label: 'CUI / CIF',
                            value: business.cui,
                            showDivider: business.foundedYear != null,
                          ),
                        if (business.foundedYear != null)
                          VenueDetailRow(
                            icon: Icons.calendar_today_outlined,
                            label: 'An înfiintare',
                            value: '${business.foundedYear}',
                            showDivider: false,
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  // ---------------------------------------------------------------------------
  // Sticky CTA
  // ---------------------------------------------------------------------------

  Widget _buildStickyCtaIfNeeded(Business business) {
    if (business.phone != null && business.phone!.isNotEmpty) {
      return StickyBottomCta(
        label: 'Sună acum',
        icon: Icons.phone,
        onTap: () {
          Launchers.call(business.phone!);
          AnalyticsService.trackClick(
              businessId: business.id, actionType: 'phone');
        },
      );
    }
    if (business.bookingMethods != null &&
        business.bookingMethods!.isNotEmpty) {
      final bm = business.bookingMethods!.first;
      return StickyBottomCta(
        label: 'Rezervă',
        icon: Icons.calendar_today,
        onTap: () {
          if (bm.isPhone) {
            Launchers.call(bm.value);
          } else if (bm.isWhatsApp) {
            Launchers.whatsApp(bm.value);
          } else {
            Launchers.website(bm.href);
          }
          AnalyticsService.trackClick(
              businessId: business.id, actionType: 'booking');
        },
      );
    }
    if (business.lat != null && business.lng != null) {
      return StickyBottomCta(
        label: 'Navighează',
        icon: Icons.navigation,
        onTap: () {
          Launchers.maps(business.lat!, business.lng!,
              address: business.address);
          AnalyticsService.trackClick(
              businessId: business.id, actionType: 'navigate');
        },
      );
    }
    return const SizedBox.shrink();
  }

  // ---------------------------------------------------------------------------
  // Bottom sheet helpers
  // ---------------------------------------------------------------------------

  void _showBadgeInfo(BuildContext context, String badgeType) {
    final isPremium = badgeType == 'premium';
    final badgeColor =
        isPremium ? AppColors.premiumPurple : AppColors.accent;
    final l10n = AppLocalizations.of(context)!;
    final title = isPremium ? l10n.premiumBusiness : l10n.verifiedBusiness;
    final description =
        isPremium ? l10n.premiumDescription : l10n.verifiedDescription;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                  width: 32,
                  height: 4,
                  decoration: BoxDecoration(
                      color: AppColors.textTertiary,
                      borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: AppSpacing.xxl),
              Icon(Icons.verified, color: badgeColor, size: 48),
              const SizedBox(height: AppSpacing.lg),
              Text(title, style: AppTypography.headlineSmall),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTypography.bodyMedium
                    .copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }

  void _showSuccessOverlay(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: AppColors.overlay,
      builder: (_) => const _SuccessOverlay(),
    );
  }

  void _showReviewSheet(BuildContext context, WidgetRef ref) {
    int selectedRating = 5;
    final commentController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.overlay,
      builder: (_) => ClipRRect(
        borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppSpacing.cardRadius)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.bgGlass,
              borderRadius: BorderRadius.vertical(
                  top: Radius.circular(AppSpacing.cardRadius)),
              border: Border(
                  top: BorderSide(
                      color: AppColors.borderLight, width: 0.5)),
            ),
            child: StatefulBuilder(
              builder: (context, setState) => Padding(
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.pagePadding,
                  AppSpacing.lg,
                  AppSpacing.pagePadding,
                  MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 32,
                      height: 4,
                      decoration: BoxDecoration(
                        color: AppColors.textTertiary,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text(
                        AppLocalizations.of(context)!.writeAReview,
                        style: AppTypography.headlineSmall),
                    const SizedBox(height: AppSpacing.lg),

                    // Stars
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(
                          5,
                          (i) => GestureDetector(
                                onTap: () =>
                                    setState(() => selectedRating = i + 1),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 4),
                                  child: Icon(
                                    i < selectedRating
                                        ? Icons.star
                                        : Icons.star_border,
                                    size: 36,
                                    color: i < selectedRating
                                        ? AppColors.accent
                                        : AppColors.textTertiary,
                                  ),
                                ),
                              )),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    TextField(
                      controller: commentController,
                      maxLines: 4,
                      maxLength: 2000,
                      style: AppTypography.bodyMedium,
                      decoration: InputDecoration(
                        hintText:
                            AppLocalizations.of(context)!.commentHint,
                        hintStyle: AppTypography.bodyMedium
                            .copyWith(color: AppColors.textTertiary),
                        filled: true,
                        fillColor: AppColors.bgSecondary,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(
                              AppSpacing.cardRadiusSm),
                          borderSide: BorderSide.none,
                        ),
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                setState(() => isSubmitting = true);
                                final success = await ref
                                    .read(businessReviewsProvider(
                                            widget.businessId)
                                        .notifier)
                                    .submitReview(
                                      rating: selectedRating,
                                      comment: commentController.text
                                          .trim(),
                                    );
                                if (context.mounted) {
                                  Navigator.pop(context);
                                  if (success) {
                                    _showSuccessOverlay(context);
                                  } else {
                                    ScaffoldMessenger.of(context)
                                        .showSnackBar(SnackBar(
                                      content: Text(AppLocalizations.of(
                                              context)!
                                          .submitError),
                                      backgroundColor: AppColors.danger,
                                    ));
                                  }
                                }
                              },
                        child: isSubmitting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.bgPrimary))
                            : Text(AppLocalizations.of(context)!
                                .submitReview),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ).then((_) => commentController.dispose());
  }
}

// ---------------------------------------------------------------------------
// Tab bar delegate
// ---------------------------------------------------------------------------

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  _TabBarDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: AppColors.bgPrimary,
      child: tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => false;
}

// ---------------------------------------------------------------------------
// Small shared widgets (private to file)
// ---------------------------------------------------------------------------

class _Initial extends StatelessWidget {
  final String name;
  const _Initial(this.name);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.accent,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: AppTypography.headlineMedium
              .copyWith(color: AppColors.bgPrimary),
        ),
      ),
    );
  }
}

void _confirmDeleteReview(
    BuildContext context, WidgetRef ref, int businessId, int reviewId) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.bgCard,
      title: Text(AppLocalizations.of(ctx)!.deleteReviewTitle,
          style: AppTypography.headlineSmall),
      content: Text(
        AppLocalizations.of(ctx)!.deleteReviewBody,
        style: AppTypography.bodyMedium
            .copyWith(color: AppColors.textSecondary),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text(AppLocalizations.of(ctx)!.cancel,
              style: AppTypography.labelMedium
                  .copyWith(color: AppColors.textSecondary)),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(ctx);
            final success = await ref
                .read(businessReviewsProvider(businessId).notifier)
                .deleteReview(reviewId);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(success
                      ? AppLocalizations.of(context)!.reviewDeleted
                      : AppLocalizations.of(context)!.reviewDeleteError),
                  backgroundColor:
                      success ? AppColors.success : AppColors.danger,
                ),
              );
            }
          },
          child: Text(AppLocalizations.of(ctx)!.delete,
              style: AppTypography.labelMedium
                  .copyWith(color: AppColors.danger)),
        ),
      ],
    ),
  );
}

/// Returns true if the location has its own booking info different from the
/// main business booking.
bool _hasLocationBooking(BusinessLocation loc, Booking? mainBooking) {
  final hasAny = loc.bookingPhone != null ||
      loc.bookingWhatsapp != null ||
      loc.bookingUrl != null;
  if (!hasAny) return false;
  if (mainBooking == null) return true;
  return loc.bookingPhone != mainBooking.phone ||
      loc.bookingWhatsapp != mainBooking.whatsapp ||
      loc.bookingUrl != mainBooking.url;
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionButton(
      {required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: AppColors.accent),
            const SizedBox(width: AppSpacing.sm),
            Text(label, style: AppTypography.labelLarge),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Success overlay
// ---------------------------------------------------------------------------

class _SuccessOverlay extends StatefulWidget {
  const _SuccessOverlay();

  @override
  State<_SuccessOverlay> createState() => _SuccessOverlayState();
}

class _SuccessOverlayState extends State<_SuccessOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.15), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.15, end: 0.95), weight: 15),
      TweenSequenceItem(tween: Tween(begin: 0.95, end: 1.0), weight: 15),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 15),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _opacity = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 60),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 20),
    ]).animate(_controller);

    _controller.forward().then((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => Opacity(
        opacity: _opacity.value,
        child: Center(
          child: Transform.scale(
            scale: _scale.value,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.4),
                    blurRadius: 24,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_rounded,
                      size: 48, color: Colors.white),
                  const SizedBox(height: 4),
                  Text(
                    'Trimis!',
                    style: AppTypography.labelMedium
                        .copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pinch request card
// ---------------------------------------------------------------------------

class _PinchRequestCard extends ConsumerStatefulWidget {
  final int businessId;
  final bool isLoggedIn;

  const _PinchRequestCard({
    required this.businessId,
    required this.isLoggedIn,
  });

  @override
  ConsumerState<_PinchRequestCard> createState() =>
      _PinchRequestCardState();
}

class _PinchRequestCardState extends ConsumerState<_PinchRequestCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  bool _showSuccess = false;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final success = await ref
        .read(offerRequestProvider(widget.businessId).notifier)
        .submitRequest();
    if (success && mounted) {
      final subsState = ref.read(followedBusinessesProvider);
      if (!subsState.followedIds.contains(widget.businessId)) {
        ref
            .read(followedBusinessesProvider.notifier)
            .toggleFollow(widget.businessId);
      }
      setState(() => _showSuccess = true);
      _pulseCtrl.forward(from: 0).then((_) {
        if (mounted) {
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) setState(() => _showSuccess = false);
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pinchState = ref.watch(offerRequestProvider(widget.businessId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.accent.withValues(alpha: 0.12),
                AppColors.accent.withValues(alpha: 0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            border: Border.all(
                color: AppColors.accent.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Icon(Icons.campaign_outlined, size: 36, color: AppColors.accent),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Nicio ofertă activă',
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'Cere business-ului să publice o ofertă!',
                style: AppTypography.bodySmall
                    .copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),

              if (pinchState.total > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: pinchState.total > 5
                          ? AppColors.accent.withValues(alpha: 0.15)
                          : AppColors.bgSecondary,
                      borderRadius:
                          BorderRadius.circular(AppSpacing.pillRadius),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (pinchState.total > 5) ...[
                          Icon(Icons.local_fire_department,
                              size: 14, color: AppColors.accent),
                          const SizedBox(width: 4),
                        ],
                        Text(
                          pinchState.total > 5
                              ? '${pinchState.total} persoane asteapta o oferta!'
                              : '${pinchState.total} ${pinchState.total == 1 ? 'persoana a cerut' : 'persoane au cerut'} deja',
                          style: AppTypography.caption.copyWith(
                            color: pinchState.total > 5
                                ? AppColors.accent
                                : AppColors.textSecondary,
                            fontWeight: pinchState.total > 5
                                ? FontWeight.w600
                                : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              if (!widget.isLoggedIn)
                Text(
                  'Conectează-te pentru a cere o ofertă',
                  style: AppTypography.labelSmall
                      .copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                )
              else if (_showSuccess)
                AnimatedBuilder(
                  animation: _pulseCtrl,
                  builder: (_, __) => Transform.scale(
                    scale: 1.0 + (_pulseCtrl.value * 0.05),
                    child: Container(
                      width: double.infinity,
                      padding:
                          const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        borderRadius:
                            BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.check_circle,
                              size: 20, color: Colors.white),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă!',
                            style: AppTypography.labelLarge
                                .copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else if (pinchState.userRequested &&
                  pinchState.daysRemaining != null &&
                  pinchState.daysRemaining! > 0)
                Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding:
                          const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSecondary,
                        borderRadius:
                            BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline,
                              size: 20,
                              color: AppColors.textTertiary),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă',
                            style: AppTypography.labelLarge.copyWith(
                                color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Poți cere din nou peste ${pinchState.daysRemaining} ${pinchState.daysRemaining == 1 ? 'zi' : 'zile'}',
                      style: AppTypography.caption
                          .copyWith(color: AppColors.textTertiary),
                    ),
                  ],
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed:
                        pinchState.isSubmitting ? null : _handleSubmit,
                    icon: pinchState.isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.bgPrimary),
                          )
                        : const Icon(Icons.notifications_active, size: 20),
                    label: Text(pinchState.isSubmitting
                        ? 'Se trimite...'
                        : 'Vreau o ofertă!'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.bgPrimary,
                      padding:
                          const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Booking chip
// ---------------------------------------------------------------------------

class _BookingChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  const _BookingChip(
      {required this.icon,
      required this.label,
      required this.onTap,
      this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.accent;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(color: c.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: c),
            const SizedBox(width: 6),
            Text(label,
                style: AppTypography.labelMedium.copyWith(color: c)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Opening hours section
// ---------------------------------------------------------------------------

class _OpeningHoursSection extends StatelessWidget {
  final List<BusinessLocation> locations;
  const _OpeningHoursSection({required this.locations});

  static const _dayNames = [
    'Luni',
    'Marți',
    'Miercuri',
    'Joi',
    'Vineri',
    'Sâmbătă',
    'Duminică'
  ];

  @override
  Widget build(BuildContext context) {
    final locsWithHours = locations
        .where((loc) => loc.hours != null && loc.hours!.isNotEmpty)
        .toList();
    if (locsWithHours.isEmpty) return const SizedBox.shrink();

    final todayIdx = DateTime.now().weekday - 1; // 0=Mon

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.schedule,
                  size: 20, color: AppColors.textTertiary),
              const SizedBox(width: AppSpacing.sm),
              Semantics(
                  label: 'Program de lucru',
                  header: true,
                  child: Text('Program de lucru',
                      style: AppTypography.headlineSmall)),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ...locsWithHours.asMap().entries.map((entry) {
            final locIdx = entry.key;
            final loc = entry.value;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (locsWithHours.length > 1) ...[
                  if (locIdx > 0) ...[
                    const SizedBox(height: AppSpacing.md),
                    Divider(color: AppColors.border, height: 1),
                    const SizedBox(height: AppSpacing.md),
                  ],
                  Row(
                    children: [
                      Icon(Icons.location_on_outlined,
                          size: 14, color: AppColors.accent),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          loc.address ?? 'Locație ${locIdx + 1}',
                          style: AppTypography.labelSmall
                              .copyWith(color: AppColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                ...List.generate(7, (d) {
                  final entry =
                      loc.hours!.cast<BusinessHours?>().firstWhere(
                            (h) => h!.dayOfWeek == d,
                            orElse: () => null,
                          );
                  final isToday = d == todayIdx;
                  final isClosed = entry == null || entry.isClosed;

                  return Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: isToday
                          ? AppColors.accent.withValues(alpha: 0.08)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 80,
                          child: Text(
                            _dayNames[d],
                            style: (isToday
                                    ? AppTypography.labelMedium
                                    : AppTypography.bodySmall)
                                .copyWith(
                              color: isToday
                                  ? AppColors.textPrimary
                                  : AppColors.textSecondary,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            isClosed
                                ? 'Închis'
                                : '${entry.openTime} – ${entry.closeTime}',
                            style: AppTypography.bodySmall.copyWith(
                              color: isClosed
                                  ? AppColors.textTertiary
                                  : (isToday
                                      ? AppColors.textPrimary
                                      : AppColors.textSecondary),
                              fontStyle: isClosed
                                  ? FontStyle.italic
                                  : FontStyle.normal,
                            ),
                          ),
                        ),
                        if (isToday && !isClosed)
                          _buildStatusBadge(entry),
                        if (isToday && isClosed)
                          _badge(
                            'Închis azi',
                            AppColors.danger.withValues(alpha: 0.12),
                            AppColors.danger,
                          ),
                      ],
                    ),
                  );
                }),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(BusinessHours entry) {
    final now = DateTime.now();
    final nowMins = now.hour * 60 + now.minute;
    final openParts = entry.openTime?.split(':');
    final closeParts = entry.closeTime?.split(':');
    if (openParts == null ||
        closeParts == null ||
        openParts.length < 2 ||
        closeParts.length < 2) {
      return const SizedBox.shrink();
    }
    final openMins = (int.tryParse(openParts[0]) ?? 0) * 60 +
        (int.tryParse(openParts[1]) ?? 0);
    final closeMins = (int.tryParse(closeParts[0]) ?? 0) * 60 +
        (int.tryParse(closeParts[1]) ?? 0);
    final isOpen = nowMins >= openMins && nowMins < closeMins;

    return isOpen
        ? _badge('Deschis',
            AppColors.success.withValues(alpha: 0.15), AppColors.success)
        : _badge('Închis',
            AppColors.danger.withValues(alpha: 0.12), AppColors.danger);
  }

  Widget _badge(String text, Color bg, Color fg) {
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        text,
        style: AppTypography.caption.copyWith(
            color: fg, fontWeight: FontWeight.w600, fontSize: 11),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Catalog section
// ---------------------------------------------------------------------------

class _CatalogSection extends StatefulWidget {
  final List<CatalogCategory> categories;
  const _CatalogSection({required this.categories});

  @override
  State<_CatalogSection> createState() => _CatalogSectionState();
}

class _CatalogSectionState extends State<_CatalogSection>
    with AutomaticKeepAliveClientMixin {
  int _selectedIdx = 0;

  static const _typeColors = <String, Color>{
    'service': AppColors.catalogService,
    'product': AppColors.catalogProduct,
    'menu_item': AppColors.catalogMenuItem,
  };

  static const _typeBgColors = <String, Color>{
    'service': AppColors.catalogServiceBg,
    'product': AppColors.catalogProductBg,
    'menu_item': AppColors.catalogMenuItemBg,
  };

  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context); // required by AutomaticKeepAliveClientMixin
    final cats = widget.categories;
    final totalItems = cats.fold<int>(0, (sum, c) => sum + c.items.length);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(Icons.menu_book_outlined,
                  size: 20, color: AppColors.textTertiary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Semantics(
                    label: 'Servicii si Produse',
                    header: true,
                    child: Text('Servicii & Produse',
                        style: AppTypography.headlineSmall)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  '$totalItems ${totalItems == 1 ? 'articol' : 'articole'}',
                  style: AppTypography.caption.copyWith(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),

          // Category tabs (if more than one)
          if (cats.length > 1) ...[
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: cats.length,
                separatorBuilder: (_, __) => const SizedBox(width: 6),
                itemBuilder: (context, i) {
                  final isActive = i == _selectedIdx;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedIdx = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isActive
                            ? AppColors.accent.withValues(alpha: 0.12)
                            : Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: isActive
                              ? AppColors.accent
                              : Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            cats[i].name,
                            style: AppTypography.labelSmall.copyWith(
                              color: isActive
                                  ? AppColors.accent
                                  : AppColors.textSecondary,
                              fontWeight: isActive
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${cats[i].items.length}',
                            style: AppTypography.caption.copyWith(
                              color: isActive
                                  ? AppColors.accent.withValues(alpha: 0.7)
                                  : AppColors.textTertiary,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.md),
          ],

          // Items list
          ...cats[_selectedIdx].items.asMap().entries.map((entry) {
            final idx = entry.key;
            final item = entry.value;
            final isLast = idx == cats[_selectedIdx].items.length - 1;

            return Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                border: isLast
                    ? null
                    : Border(
                        bottom: BorderSide(
                            color: Colors.white.withValues(alpha: 0.04))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _typeBgColors[item.type] ??
                              _typeBgColors['service']!,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          item.typeLabel,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: _typeColors[item.type] ??
                                _typeColors['service']!,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item.name,
                          style: AppTypography.bodyMedium
                              .copyWith(fontWeight: FontWeight.w500),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      if (item.durationMinutes != null) ...[
                        Icon(Icons.schedule,
                            size: 12,
                            color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(
                          '${item.durationMinutes} min',
                          style: AppTypography.caption
                              .copyWith(color: AppColors.textTertiary),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Text(
                        item.priceDisplay ?? 'La cerere',
                        style: item.priceDisplay != null
                            ? AppTypography.bodySmall.copyWith(
                                color: AppColors.accent,
                                fontWeight: FontWeight.w600,
                              )
                            : AppTypography.bodySmall.copyWith(
                                color: AppColors.textTertiary,
                                fontStyle: FontStyle.italic,
                              ),
                      ),
                    ],
                  ),
                  if (item.description != null &&
                      item.description!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      item.description!,
                      style: AppTypography.bodySmall
                          .copyWith(color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Rating breakdown
// ---------------------------------------------------------------------------

class _RatingBreakdown extends StatelessWidget {
  final Map<int, int> distribution;
  final int total;
  const _RatingBreakdown(
      {required this.distribution, required this.total});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (index) {
        final star = 5 - index;
        final count = distribution[star] ?? 0;
        final fraction = total > 0 ? count / total : 0.0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                child: Text('$star',
                    style: AppTypography.labelSmall
                        .copyWith(color: AppColors.textSecondary)),
              ),
              Icon(Icons.star, size: 12, color: AppColors.accent),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: fraction,
                    backgroundColor: AppColors.bgSecondary,
                    valueColor: const AlwaysStoppedAnimation<Color>(
                        AppColors.accent),
                    minHeight: 6,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 28,
                child: Text(
                  '$count',
                  style: AppTypography.captionMuted,
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}
