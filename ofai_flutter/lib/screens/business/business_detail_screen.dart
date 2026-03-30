import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/launchers.dart';
import '../../models/business.dart' show BusinessLocation, BusinessHours;
import '../../models/catalog.dart' show CatalogCategory;
import '../../models/offer.dart' show Booking;
import '../../providers/businesses_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../providers/reviews_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/offer_requests_provider.dart';
import '../../widgets/review_card.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fullscreen_gallery.dart';
import '../../widgets/animated_toggle_fab.dart';
import '../../widgets/empty_state.dart';
import '../../widgets/subscription_badge.dart';
import '../../services/analytics_service.dart';
import '../../widgets/report_dialog.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class BusinessDetailScreen extends ConsumerWidget {
  final int businessId;

  const BusinessDetailScreen({super.key, required this.businessId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final businessAsync = ref.watch(businessDetailProvider(businessId));
    final subsState = ref.watch(followedBusinessesProvider);
    final reviewsState = ref.watch(businessReviewsProvider(businessId));
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    return Scaffold(
      body: businessAsync.when(
        data: (business) {
          final isSub = subsState.followedIds.contains(business.id);
          final coverUrl = business.coverImage ??
              (business.images != null && business.images!.isNotEmpty ? business.images!.first.url : null) ??
              business.logoUrl;

          return Stack(
            children: [
              RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgCard,
                onRefresh: () async {
                  ref.invalidate(businessDetailProvider(businessId));
                },
                child: CustomScrollView(
                slivers: [
                  // Cover with parallax
                  SliverAppBar(
                    expandedHeight: 220,
                    pinned: true,
                    stretch: true,
                    backgroundColor: AppColors.bgPrimary,
                    actions: [
                      Semantics(
                        label: AppLocalizations.of(context)!.shareBusiness,
                        button: true,
                        child: IconButton(
                          icon: const Icon(Icons.share_outlined),
                          onPressed: () {
                            Launchers.shareBusiness(business.name, business.id);
                            AnalyticsService.trackClick(businessId: business.id, actionType: 'share');
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
                                  SnackBar(content: Text(AppLocalizations.of(context)!.reportSent)),
                                );
                              }
                            }
                          },
                          itemBuilder: (ctx) => [
                            PopupMenuItem(
                              value: 'report',
                              child: Row(
                                children: [
                                  const Icon(Icons.flag_outlined, size: 20, color: AppColors.textSecondary),
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
                        final expandedHeight = 220 + MediaQuery.of(context).padding.top;
                        final collapsedHeight = kToolbarHeight + MediaQuery.of(context).padding.top;
                        final scrollFraction = ((expandedHeight - top) / (expandedHeight - collapsedHeight)).clamp(0.0, 1.0);
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
                                        placeholder: (_, __) => Container(color: AppColors.bgSecondary),
                                        errorWidget: (_, __, ___) => Container(color: AppColors.bgSecondary),
                                      )
                                    : Container(color: AppColors.bgSecondary),
                              ),
                              const DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [Colors.transparent, Color(0xCC080808)],
                                  ),
                                ),
                              ),
                              // Logo overlay
                              Positioned(
                                bottom: 16,
                                left: 20,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: SizedBox(
                                    width: 56,
                                    height: 56,
                                    child: business.logoUrl != null
                                        ? CachedNetworkImage(
                                            imageUrl: business.logoUrl!,
                                            fit: BoxFit.cover,
                                            errorWidget: (_, __, ___) => _Initial(business.name),
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

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.pagePadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // "Manage on Web" banner for business owners
                          if (business.isOwner) ...[
                            GestureDetector(
                              onTap: () => Launchers.website('https://ofai.ro/portal/${business.id}'),
                              child: Container(
                                width: double.infinity,
                                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 12),
                                decoration: BoxDecoration(
                                  color: AppColors.accent.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
                                ),
                                child: Row(
                                  children: [
                                    Icon(Icons.edit_outlined, size: 20, color: AppColors.accent),
                                    const SizedBox(width: AppSpacing.sm),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            AppLocalizations.of(context)!.thisIsYourBusiness,
                                            style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            AppLocalizations.of(context)!.manageOnWeb,
                                            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.open_in_new, size: 18, color: AppColors.accent),
                                  ],
                                ),
                              ),
                            ),
                          ],
                          // Name
                          Row(
                            children: [
                              Expanded(
                                child: Semantics(
                                  label: 'Business: ${business.name}',
                                  header: true,
                                  child: Text(business.name, style: AppTypography.headlineLarge),
                                ),
                              ),
                              if (business.hasBadge)
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: GestureDetector(
                                    onTap: () => _showBadgeInfo(context, business.badgeType!),
                                    child: SubscriptionBadge(badgeType: business.badgeType, size: 24),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Semantics(
                            label: '${business.categoryName}, ${business.cityName}',
                            child: Text(
                              [business.categoryName, business.cityName]
                                  .where((s) => s.isNotEmpty)
                                  .join(' \u2022 '),
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                            ),
                          ),

                          // Follower count
                          if (business.followerCount != null && business.followerCount! >= 3) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                Icon(Icons.people_outline, size: 14, color: AppColors.textTertiary),
                                const SizedBox(width: 4),
                                Text(
                                  AppLocalizations.of(context)!.followersCount(business.followerCount!),
                                  style: AppTypography.caption,
                                ),
                              ],
                            ),
                          ],

                          const SizedBox(height: AppSpacing.lg),

                          // Rating row
                          if (business.rating != null && business.rating! > 0) ...[
                            Semantics(
                              label: AppLocalizations.of(context)!.ratingLabel(business.rating!.toStringAsFixed(1), business.ratingCount ?? 0),
                              child: Row(
                              children: [
                                ...List.generate(5, (i) => Icon(
                                  i < business.rating!.round() ? Icons.star : Icons.star_border,
                                  size: 20,
                                  color: i < business.rating!.round() ? AppColors.accent : AppColors.textTertiary,
                                )),
                                const SizedBox(width: AppSpacing.sm),
                                Text(
                                  business.rating!.toStringAsFixed(1),
                                  style: AppTypography.labelLarge.copyWith(color: AppColors.accent),
                                ),
                                if (business.ratingCount != null)
                                  Text(
                                    ' ${AppLocalizations.of(context)!.reviewsCount(business.ratingCount!)}',
                                    style: AppTypography.caption,
                                  ),
                                const Spacer(),
                                if (isLoggedIn)
                                  GestureDetector(
                                    onTap: () => _showReviewSheet(context, ref),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        border: Border.all(color: AppColors.accent),
                                        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                                      ),
                                      child: Text(
                                        AppLocalizations.of(context)!.writeReview,
                                        style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                                      ),
                                    ),
                                  ),
                              ],
                            )),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Review summary
                          if (business.reviewSummary != null && business.reviewSummary!.text.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.accentMuted,
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.auto_awesome, size: 16, color: AppColors.accent),
                                      const SizedBox(width: 6),
                                      Text(AppLocalizations.of(context)!.reviewSummary, style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
                                    ],
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    business.reviewSummary!.text,
                                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 40),
                          ],

                          // Contact info
                          if (business.address != null || business.phone != null || business.website != null) ...[
                            Container(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.bgCard,
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(AppLocalizations.of(context)!.contact, style: AppTypography.headlineSmall),
                                  const SizedBox(height: AppSpacing.sm),
                                  if (business.address != null)
                                    _InfoTile(
                                      icon: Icons.location_on_outlined,
                                      label: business.address!,
                                      onTap: business.lat != null && business.lng != null
                                          ? () {
                                              Launchers.maps(business.lat!, business.lng!, address: business.address);
                                              AnalyticsService.trackClick(businessId: business.id, actionType: 'navigate');
                                            }
                                          : null,
                                    ),
                                  if (business.phone != null)
                                    _InfoTile(
                                      icon: Icons.phone_outlined,
                                      label: business.phone!,
                                      onTap: () {
                                        Launchers.call(business.phone!);
                                        AnalyticsService.trackClick(businessId: business.id, actionType: 'phone');
                                      },
                                    ),
                                  if (business.website != null)
                                    _InfoTile(
                                      icon: Icons.language,
                                      label: business.website!,
                                      onTap: () {
                                        Launchers.website(business.website!);
                                        AnalyticsService.trackClick(businessId: business.id, actionType: 'website');
                                      },
                                      accent: true,
                                    ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 40),
                          ],

                          // Locations
                          if (business.locations != null && business.locations!.length > 1) ...[
                            Text(AppLocalizations.of(context)!.locations, style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            ...business.locations!.map((loc) {
                              // Check if location has its own booking different from main
                              final hasLocBooking = _hasLocationBooking(loc, business.booking);
                              return Padding(
                                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      GestureDetector(
                                        onTap: loc.lat != null && loc.lng != null
                                            ? () => Launchers.maps(loc.lat!, loc.lng!, address: loc.address)
                                            : null,
                                        child: Row(
                                          children: [
                                            Icon(Icons.location_on_outlined, size: 18, color: AppColors.textTertiary),
                                            const SizedBox(width: AppSpacing.sm),
                                            Expanded(
                                              child: Column(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  if (loc.address != null)
                                                    Text(loc.address!, style: AppTypography.bodyMedium),
                                                  if (loc.city != null)
                                                    Text(loc.city!.name, style: AppTypography.captionMuted),
                                                ],
                                              ),
                                            ),
                                            if (loc.lat != null)
                                              Icon(Icons.map_outlined, size: 18, color: AppColors.accent),
                                          ],
                                        ),
                                      ),
                                      // Per-location booking chips
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
                                                  AnalyticsService.trackClick(businessId: business.id, actionType: 'phone');
                                                },
                                              ),
                                            if (loc.bookingWhatsapp != null)
                                              _BookingChip(
                                                icon: Icons.message,
                                                label: 'WhatsApp',
                                                onTap: () {
                                                  Launchers.whatsApp(loc.bookingWhatsapp!);
                                                  AnalyticsService.trackClick(businessId: business.id, actionType: 'whatsapp');
                                                },
                                              ),
                                            if (loc.bookingUrl != null)
                                              _BookingChip(
                                                icon: Icons.language,
                                                label: AppLocalizations.of(context)!.online,
                                                onTap: () {
                                                  Launchers.website(loc.bookingUrl!);
                                                  AnalyticsService.trackClick(businessId: business.id, actionType: 'booking_url');
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
                            const SizedBox(height: 40),
                          ],

                          // Booking
                          if (business.booking != null && business.booking!.hasBooking) ...[
                            Text(AppLocalizations.of(context)!.booking, style: AppTypography.headlineSmall),
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
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'phone');
                                    },
                                  ),
                                if (business.booking!.whatsapp != null)
                                  _BookingChip(
                                    icon: Icons.message,
                                    label: 'WhatsApp',
                                    onTap: () {
                                      Launchers.whatsApp(business.booking!.whatsapp!);
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'whatsapp');
                                    },
                                  ),
                                if (business.booking!.url != null)
                                  _BookingChip(
                                    icon: Icons.language,
                                    label: AppLocalizations.of(context)!.online,
                                    onTap: () {
                                      Launchers.website(business.booking!.url!);
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'booking_url');
                                    },
                                  ),
                              ],
                            ),
                            const SizedBox(height: 40),
                          ],

                          // Opening Hours
                          if (business.locations != null &&
                              business.locations!.any((loc) => loc.hours != null && loc.hours!.isNotEmpty)) ...[
                            _OpeningHoursSection(locations: business.locations!),
                            const SizedBox(height: 40),
                          ],

                          // Catalog (services / products / menu items)
                          if (business.catalog != null && business.catalog!.isNotEmpty) ...[
                            _CatalogSection(categories: business.catalog!),
                            const SizedBox(height: 40),
                          ],

                          // Active offers have priority over pinch card — mutually exclusive
                          if (business.activeOffers != null && business.activeOffers!.isNotEmpty) ...[
                            Text(AppLocalizations.of(context)!.activeOffers, style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            ...business.activeOffers!.map((offer) => Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: InkWell(
                                onTap: () => context.push('/offer/${offer.id}'),
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                splashColor: AppColors.accent.withValues(alpha: 0.1),
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                    border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                                  ),
                                  child: Row(
                                    children: [
                                      if (offer.discountLabel.isNotEmpty)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: AppColors.accent,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            offer.discountLabel,
                                            style: AppTypography.labelSmall.copyWith(color: AppColors.bgPrimary),
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
                                      Icon(Icons.chevron_right, size: 18, color: AppColors.textTertiary),
                                    ],
                                  ),
                                ),
                              ),
                            )),
                            const SizedBox(height: 40),
                          ] else if (business.showPinch) ...[
                            // Pinch card — "Vreau o ofertă!" (only when NO active offers)
                            _PinchRequestCard(
                              businessId: business.id,
                              isLoggedIn: isLoggedIn,
                            ),
                          ],

                          // Images gallery
                          if (business.images != null && business.images!.isNotEmpty) ...[
                            Text(
                              AppLocalizations.of(context)!.galleryCount(business.images!.length),
                              style: AppTypography.headlineSmall,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Gallery horizontal
                  if (business.images != null && business.images!.isNotEmpty)
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: 140,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                          itemCount: business.images!.length,
                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (ctx, i) => Semantics(
                            label: AppLocalizations.of(ctx)!.galleryImage,
                            image: true,
                            child: GestureDetector(
                              onTap: () {
                                FullscreenGallery.open(
                                  context,
                                  business.images!.map((img) => img.url).toList(),
                                  initialIndex: i,
                                );
                                AnalyticsService.trackClick(businessId: business.id, actionType: 'gallery');
                              },
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                child: CachedNetworkImage(
                                  imageUrl: business.images![i].url,
                                  width: 200,
                                  fit: BoxFit.cover,
                                  placeholder: (_, __) => Container(width: 200, color: AppColors.bgSecondary),
                                  errorWidget: (_, __, ___) => Container(width: 200, color: AppColors.bgSecondary),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Reviews section
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.pagePadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (business.images != null && business.images!.isNotEmpty)
                            const SizedBox(height: 40),
                          Semantics(label: AppLocalizations.of(context)!.reviews, header: true, child: Text(AppLocalizations.of(context)!.reviews, style: AppTypography.headlineSmall)),
                          if (business.ratingDistribution != null && (business.ratingCount ?? 0) >= 3) ...[
                            const SizedBox(height: AppSpacing.sm),
                            _RatingBreakdown(distribution: business.ratingDistribution!, total: business.ratingCount ?? 0),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Review cards
                  if (reviewsState.isLoading)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.xxl),
                        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
                      ),
                    )
                  else if (reviewsState.reviews.isEmpty)
                    SliverToBoxAdapter(
                      child: Builder(
                        builder: (context) => EmptyState(
                          icon: Icons.rate_review_outlined,
                          title: AppLocalizations.of(context)!.noReviewsYet,
                          subtitle: AppLocalizations.of(context)!.beFirstToReview,
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                      sliver: SliverList.separated(
                        itemCount: reviewsState.reviews.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (_, i) {
                          final review = reviewsState.reviews[i];
                          return ReviewCard(
                            review: review,
                            onDelete: review.isOwn ? () => _confirmDeleteReview(context, ref, businessId, review.id) : null,
                          );
                        },
                      ),
                    ),

                  // Load more reviews
                  if (reviewsState.hasMore && reviewsState.reviews.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.pagePadding),
                        child: Center(
                          child: TextButton(
                            onPressed: () => ref.read(businessReviewsProvider(businessId).notifier).loadMore(),
                            child: Text(
                              AppLocalizations.of(context)!.loadMoreReviews,
                              style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Bottom padding for FAB
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),
              ),

              // Subscribe FAB with bounce animation
              if (isLoggedIn)
                Positioned(
                  bottom: AppSpacing.xxl,
                  right: AppSpacing.pagePadding,
                  child: AnimatedToggleFab(
                    isActive: isSub,
                    onTap: () => ref.read(followedBusinessesProvider.notifier).toggleFollow(business.id),
                    activeIcon: Icons.notifications_active,
                    inactiveIcon: Icons.notifications_none,
                    activeLabel: AppLocalizations.of(context)!.followed,
                    inactiveLabel: AppLocalizations.of(context)!.follow,
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message: AppLocalizations.of(context)!.errorLoadingBusiness,
            onRetry: () => ref.invalidate(businessDetailProvider(businessId)),
          ),
        ),
      ),
    );
  }

  void _showBadgeInfo(BuildContext context, String badgeType) {
    final isPremium = badgeType == 'premium';
    final badgeColor = isPremium ? AppColors.premiumPurple : AppColors.accent;
    final l10n = AppLocalizations.of(context)!;
    final title = isPremium ? l10n.premiumBusiness : l10n.verifiedBusiness;
    final description = isPremium ? l10n.premiumDescription : l10n.verifiedDescription;

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
              Container(width: 32, height: 4, decoration: BoxDecoration(color: AppColors.textTertiary, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: AppSpacing.xxl),
              Icon(Icons.verified, color: badgeColor, size: 48),
              const SizedBox(height: AppSpacing.lg),
              Text(title, style: AppTypography.headlineSmall),
              const SizedBox(height: AppSpacing.sm),
              Text(
                description,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
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
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.bgGlass,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
              border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5)),
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
                width: 32, height: 4,
                decoration: BoxDecoration(
                  color: AppColors.textTertiary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(AppLocalizations.of(context)!.writeAReview, style: AppTypography.headlineSmall),
              const SizedBox(height: AppSpacing.lg),

              // Stars
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) => GestureDetector(
                  onTap: () => setState(() => selectedRating = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Icon(
                      i < selectedRating ? Icons.star : Icons.star_border,
                      size: 36,
                      color: i < selectedRating ? AppColors.accent : AppColors.textTertiary,
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
                  hintText: AppLocalizations.of(context)!.commentHint,
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                  filled: true,
                  fillColor: AppColors.bgSecondary,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSubmitting ? null : () async {
                    setState(() => isSubmitting = true);
                    final success = await ref
                        .read(businessReviewsProvider(businessId).notifier)
                        .submitReview(
                          rating: selectedRating,
                          comment: commentController.text.trim(),
                        );
                    if (context.mounted) {
                      Navigator.pop(context);
                      if (success) {
                        _showSuccessOverlay(context);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(AppLocalizations.of(context)!.submitError),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary))
                      : Text(AppLocalizations.of(context)!.submitReview),
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
          style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
        ),
      ),
    );
  }
}

void _confirmDeleteReview(BuildContext context, WidgetRef ref, int businessId, int reviewId) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.bgCard,
      title: Text(AppLocalizations.of(ctx)!.deleteReviewTitle, style: AppTypography.headlineSmall),
      content: Text(
        AppLocalizations.of(ctx)!.deleteReviewBody,
        style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text(AppLocalizations.of(ctx)!.cancel, style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary)),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(ctx);
            final success = await ref.read(businessReviewsProvider(businessId).notifier).deleteReview(reviewId);
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(success ? AppLocalizations.of(context)!.reviewDeleted : AppLocalizations.of(context)!.reviewDeleteError),
                  backgroundColor: success ? AppColors.success : AppColors.danger,
                ),
              );
            }
          },
          child: Text(AppLocalizations.of(ctx)!.delete, style: AppTypography.labelMedium.copyWith(color: AppColors.danger)),
        ),
      ],
    ),
  );
}

/// Returns true if the location has its own booking info different from the main business booking
bool _hasLocationBooking(BusinessLocation loc, Booking? mainBooking) {
  final hasAny = loc.bookingPhone != null || loc.bookingWhatsapp != null || loc.bookingUrl != null;
  if (!hasAny) return false;
  if (mainBooking == null) return true;
  // Show only if different from main business booking
  return loc.bookingPhone != mainBooking.phone ||
      loc.bookingWhatsapp != mainBooking.whatsapp ||
      loc.bookingUrl != mainBooking.url;
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool accent;

  const _InfoTile({required this.icon, required this.label, this.onTap, this.accent = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.textTertiary),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyMedium.copyWith(
                  color: accent ? AppColors.accent : AppColors.textPrimary,
                ),
              ),
            ),
            if (onTap != null)
              Icon(Icons.open_in_new, size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _SuccessOverlay extends StatefulWidget {
  const _SuccessOverlay();

  @override
  State<_SuccessOverlay> createState() => _SuccessOverlayState();
}

class _SuccessOverlayState extends State<_SuccessOverlay> with SingleTickerProviderStateMixin {
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
                  const Icon(Icons.check_rounded, size: 48, color: Colors.white),
                  const SizedBox(height: 4),
                  Text(
                    'Trimis!',
                    style: AppTypography.labelMedium.copyWith(color: Colors.white),
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

class _PinchRequestCard extends ConsumerStatefulWidget {
  final int businessId;
  final bool isLoggedIn;

  const _PinchRequestCard({
    required this.businessId,
    required this.isLoggedIn,
  });

  @override
  ConsumerState<_PinchRequestCard> createState() => _PinchRequestCardState();
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
      // Auto-follow: subscribe if not already following
      final subsState = ref.read(followedBusinessesProvider);
      if (!subsState.followedIds.contains(widget.businessId)) {
        ref.read(followedBusinessesProvider.notifier).toggleFollow(widget.businessId);
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
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              // Icon + title
              Icon(
                Icons.campaign_outlined,
                size: 36,
                color: AppColors.accent,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Nicio ofertă activă',
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'Cere business-ului să publice o ofertă!',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),

              // Request count badge — emphatic when > 5
              if (pinchState.total > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: pinchState.total > 5
                          ? AppColors.accent.withValues(alpha: 0.15)
                          : AppColors.bgSecondary,
                      borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (pinchState.total > 5) ...[
                          Icon(Icons.local_fire_department, size: 14, color: AppColors.accent),
                          const SizedBox(width: 4),
                        ],
                        Text(
                          pinchState.total > 5
                              ? '${pinchState.total} persoane asteapta o oferta!'
                              : '${pinchState.total} ${pinchState.total == 1 ? 'persoana a cerut' : 'persoane au cerut'} deja',
                          style: AppTypography.caption.copyWith(
                            color: pinchState.total > 5 ? AppColors.accent : AppColors.textSecondary,
                            fontWeight: pinchState.total > 5 ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // CTA Button
              if (!widget.isLoggedIn)
                // Not logged in — show info text
                Text(
                  'Conectează-te pentru a cere o ofertă',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                )
              else if (_showSuccess)
                // Success state
                AnimatedBuilder(
                  animation: _pulseCtrl,
                  builder: (_, __) => Transform.scale(
                    scale: 1.0 + (_pulseCtrl.value * 0.05),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.check_circle, size: 20, color: Colors.white),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă!',
                            style: AppTypography.labelLarge.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else if (pinchState.userRequested && pinchState.daysRemaining != null && pinchState.daysRemaining! > 0)
                // Already requested this week
                Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSecondary,
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 20, color: AppColors.textTertiary),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă',
                            style: AppTypography.labelLarge.copyWith(color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Poți cere din nou peste ${pinchState.daysRemaining} ${pinchState.daysRemaining == 1 ? 'zi' : 'zile'}',
                      style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                    ),
                  ],
                )
              else
                // Can request
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: pinchState.isSubmitting ? null : _handleSubmit,
                    icon: pinchState.isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary),
                          )
                        : const Icon(Icons.notifications_active, size: 20),
                    label: Text(pinchState.isSubmitting ? 'Se trimite...' : 'Vreau o ofertă!'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.bgPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
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

class _BookingChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _BookingChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.accentMuted,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(color: AppColors.accent),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppColors.accent),
            const SizedBox(width: 6),
            Text(label, style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
          ],
        ),
      ),
    );
  }
}

class _OpeningHoursSection extends StatelessWidget {
  final List<BusinessLocation> locations;
  const _OpeningHoursSection({required this.locations});

  static const _dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

  @override
  Widget build(BuildContext context) {
    final locsWithHours = locations.where((loc) => loc.hours != null && loc.hours!.isNotEmpty).toList();
    if (locsWithHours.isEmpty) return const SizedBox.shrink();

    // Dart DateTime.now().weekday: 1=Monday … 7=Sunday → todayIdx = weekday - 1
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
              Icon(Icons.schedule, size: 20, color: AppColors.textTertiary),
              const SizedBox(width: AppSpacing.sm),
              Semantics(label: 'Program de lucru', header: true, child: Text('Program de lucru', style: AppTypography.headlineSmall)),
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
                      Icon(Icons.location_on_outlined, size: 14, color: AppColors.accent),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          loc.address ?? 'Locație ${locIdx + 1}',
                          style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
                ...List.generate(7, (d) {
                  final entry = loc.hours!.cast<BusinessHours?>().firstWhere(
                    (h) => h!.dayOfWeek == d,
                    orElse: () => null,
                  );
                  final isToday = d == todayIdx;
                  final isClosed = entry == null || entry.isClosed;

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: isToday ? AppColors.accent.withValues(alpha: 0.08) : Colors.transparent,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 80,
                          child: Text(
                            _dayNames[d],
                            style: (isToday ? AppTypography.labelMedium : AppTypography.bodySmall).copyWith(
                              color: isToday ? AppColors.textPrimary : AppColors.textSecondary,
                            ),
                          ),
                        ),
                        Expanded(
                          child: Text(
                            isClosed ? 'Închis' : '${entry.openTime} – ${entry.closeTime}',
                            style: AppTypography.bodySmall.copyWith(
                              color: isClosed
                                  ? AppColors.textTertiary
                                  : (isToday ? AppColors.textPrimary : AppColors.textSecondary),
                              fontStyle: isClosed ? FontStyle.italic : FontStyle.normal,
                            ),
                          ),
                        ),
                        if (isToday && !isClosed) _buildStatusBadge(entry),
                        if (isToday && isClosed)
                          _badge('Închis azi', AppColors.danger.withValues(alpha: 0.12), AppColors.danger),
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
    if (openParts == null || closeParts == null || openParts.length < 2 || closeParts.length < 2) {
      return const SizedBox.shrink();
    }
    final openMins = (int.tryParse(openParts[0]) ?? 0) * 60 + (int.tryParse(openParts[1]) ?? 0);
    final closeMins = (int.tryParse(closeParts[0]) ?? 0) * 60 + (int.tryParse(closeParts[1]) ?? 0);
    final isOpen = nowMins >= openMins && nowMins < closeMins;

    return isOpen
        ? _badge('Deschis', AppColors.success.withValues(alpha: 0.15), AppColors.success)
        : _badge('Închis', AppColors.danger.withValues(alpha: 0.12), AppColors.danger);
  }

  Widget _badge(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        text,
        style: AppTypography.caption.copyWith(color: fg, fontWeight: FontWeight.w600, fontSize: 11),
      ),
    );
  }
}

class _CatalogSection extends StatefulWidget {
  final List<CatalogCategory> categories;
  const _CatalogSection({required this.categories});

  @override
  State<_CatalogSection> createState() => _CatalogSectionState();
}

class _CatalogSectionState extends State<_CatalogSection> {
  int _selectedIdx = 0;

  static const _typeColors = <String, Color>{
    'service': Color(0xFF60A5FA),
    'product': Color(0xFF4ADE80),
    'menu_item': Color(0xFFFB923C),
  };

  static const _typeBgColors = <String, Color>{
    'service': Color(0x263B82F6),
    'product': Color(0x2622C55E),
    'menu_item': Color(0x26FB923C),
  };

  @override
  Widget build(BuildContext context) {
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
              Icon(Icons.menu_book_outlined, size: 20, color: AppColors.textTertiary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Semantics(label: 'Servicii si Produse', header: true, child: Text('Servicii & Produse', style: AppTypography.headlineSmall)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  '$totalItems ${totalItems == 1 ? 'articol' : 'articole'}',
                  style: AppTypography.caption.copyWith(color: AppColors.accent, fontWeight: FontWeight.w600),
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
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: isActive ? AppColors.accent.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: isActive ? AppColors.accent : Colors.white.withValues(alpha: 0.08),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            cats[i].name,
                            style: AppTypography.labelSmall.copyWith(
                              color: isActive ? AppColors.accent : AppColors.textSecondary,
                              fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '${cats[i].items.length}',
                            style: AppTypography.caption.copyWith(
                              color: isActive ? AppColors.accent.withValues(alpha: 0.7) : AppColors.textTertiary,
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
                    : Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.04))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Type badge + name
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: _typeBgColors[item.type] ?? _typeBgColors['service']!,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          item.typeLabel,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: _typeColors[item.type] ?? _typeColors['service']!,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          item.name,
                          style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w500),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  // Duration + Price
                  Row(
                    children: [
                      if (item.durationMinutes != null) ...[
                        Icon(Icons.schedule, size: 12, color: AppColors.textTertiary),
                        const SizedBox(width: 4),
                        Text(
                          '${item.durationMinutes} min',
                          style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
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
                  // Description
                  if (item.description != null && item.description!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      item.description!,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
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

class _RatingBreakdown extends StatelessWidget {
  final Map<int, int> distribution;
  final int total;
  const _RatingBreakdown({required this.distribution, required this.total});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (index) {
        final star = 5 - index; // 5, 4, 3, 2, 1
        final count = distribution[star] ?? 0;
        final fraction = total > 0 ? count / total : 0.0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Row(
            children: [
              SizedBox(
                width: 20,
                child: Text('$star', style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary)),
              ),
              Icon(Icons.star, size: 12, color: AppColors.accent),
              const SizedBox(width: 8),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(2),
                  child: LinearProgressIndicator(
                    value: fraction,
                    backgroundColor: AppColors.bgSecondary,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accent),
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
