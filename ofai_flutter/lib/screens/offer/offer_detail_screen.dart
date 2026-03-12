import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/launchers.dart';
import '../../models/offer.dart' show Booking;
import '../../providers/offers_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fullscreen_gallery.dart';
import '../../widgets/offer_card.dart';
import '../../widgets/animated_toggle_fab.dart';
import '../../widgets/subscription_badge.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../services/analytics_service.dart';
import '../../providers/offer_requests_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../providers/recently_viewed_provider.dart';
import '../../widgets/report_dialog.dart';
import '../../widgets/flash_countdown_badge.dart';
import 'package:qr_flutter/qr_flutter.dart';

class OfferDetailScreen extends ConsumerWidget {
  final int offerId;

  const OfferDetailScreen({super.key, required this.offerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(offerDetailProvider(offerId));
    final favState = ref.watch(favoritesProvider);
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    // Record as recently viewed when offer first loads
    ref.listen(offerDetailProvider(offerId), (prev, next) {
      if (prev?.hasValue != true && next.hasValue) {
        recordRecentlyViewed(offerId, ref);
      }
    });

    return Scaffold(
      body: offerAsync.when(
        data: (offer) {
          final isFav = favState.favoriteIds.contains(offer.id);
          final heroImage = offer.displayImage;
          final startDate = offer.startDate != null ? DateTime.tryParse(offer.startDate!) : null;
          final endDate = offer.endDate != null ? DateTime.tryParse(offer.endDate!) : null;
          final booking = offer.booking;

          return Stack(
            children: [
              CustomScrollView(
                slivers: [
                  // Hero image with parallax effect
                  SliverAppBar(
                    expandedHeight: 240,
                    pinned: true,
                    backgroundColor: AppColors.bgPrimary,
                    stretch: true,
                    actions: [
                      IconButton(
                        icon: const Icon(Icons.share_outlined),
                        onPressed: () {
                          Launchers.shareOffer(offer.title, offer.id);
                          final biz = offer.business;
                          if (biz != null) {
                            AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'share');
                          }
                        },
                      ),
                      if (isLoggedIn)
                        PopupMenuButton<String>(
                          icon: const Icon(Icons.more_vert),
                          onSelected: (value) async {
                            if (value == 'report') {
                              final sent = await showReportDialog(
                                context: context,
                                targetType: 'offer',
                                targetId: offer.id,
                              );
                              if (sent && context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Raportul a fost trimis. Multumim!')),
                                );
                              }
                            }
                          },
                          itemBuilder: (ctx) => [
                            const PopupMenuItem(
                              value: 'report',
                              child: Row(
                                children: [
                                  Icon(Icons.flag_outlined, size: 20, color: AppColors.textSecondary),
                                  SizedBox(width: 8),
                                  Text('Raporteaza'),
                                ],
                              ),
                            ),
                          ],
                        ),
                    ],
                    flexibleSpace: LayoutBuilder(
                      builder: (context, constraints) {
                        final top = constraints.biggest.height;
                        final expandedHeight = 240 + MediaQuery.of(context).padding.top;
                        final collapsedHeight = kToolbarHeight + MediaQuery.of(context).padding.top;
                        final scrollFraction = ((expandedHeight - top) / (expandedHeight - collapsedHeight)).clamp(0.0, 1.0);
                        final parallaxOffset = scrollFraction * 30;

                        return FlexibleSpaceBar(
                          background: Hero(
                            tag: 'offer-image-$offerId',
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                Transform.translate(
                                  offset: Offset(0, parallaxOffset),
                                  child: heroImage != null && heroImage.isNotEmpty
                                      ? CachedNetworkImage(
                                          imageUrl: heroImage,
                                          fit: BoxFit.cover,
                                          placeholder: (_, __) => Container(color: AppColors.bgSecondary),
                                          errorWidget: (_, __, ___) => Container(
                                            color: AppColors.bgSecondary,
                                            child: const Icon(Icons.local_offer_outlined, size: 48, color: AppColors.textTertiary),
                                          ),
                                        )
                                      : Container(
                                          color: AppColors.bgSecondary,
                                          child: const Icon(Icons.local_offer_outlined, size: 48, color: AppColors.textTertiary),
                                        ),
                                ),
                                // Gradient overlay (fixed, above parallax)
                                const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                      colors: [Colors.transparent, Color(0xBB080808)],
                                    ),
                                  ),
                                ),
                                // Discount badge
                                if (offer.discountValue != null)
                                  Positioned(
                                    top: 80,
                                    right: 16,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: AppColors.accent,
                                        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                                        boxShadow: [
                                          BoxShadow(
                                            color: AppColors.accent.withValues(alpha: 0.4),
                                            blurRadius: 8,
                                            offset: const Offset(0, 2),
                                          ),
                                        ],
                                      ),
                                      child: Text(
                                        offer.discountLabel,
                                        style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
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
                          // Flash deal banner
                          if (offer.isFlashDeal) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    AppColors.accent.withValues(alpha: 0.15),
                                    AppColors.danger.withValues(alpha: 0.1),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  Icon(Icons.bolt, size: 18, color: AppColors.accent),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Oferta flash',
                                    style: AppTypography.labelMedium.copyWith(
                                      color: AppColors.accent,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const Spacer(),
                                  FlashCountdownBadge(expiresAt: offer.flashExpiresAt!, compact: true),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                          ],

                          // Title
                          Text(offer.title, style: AppTypography.headlineLarge),

                          const SizedBox(height: AppSpacing.md),

                          // Activity pills
                          if (offer.isTrending || (offer.saveCount != null && offer.saveCount! >= 3)) ...[
                            Wrap(
                              spacing: 8,
                              runSpacing: 4,
                              children: [
                                if (offer.isTrending)
                                  _ActivityPill(
                                    icon: Icons.local_fire_department,
                                    label: 'Trending',
                                    color: AppColors.accent,
                                  ),
                                if (offer.saveCount != null && offer.saveCount! >= 3)
                                  _ActivityPill(
                                    icon: Icons.bookmark,
                                    label: '${offer.saveCount} salvari',
                                    color: AppColors.textTertiary,
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.md),
                          ],

                          // Date range + progress bar
                          if (startDate != null || endDate != null) ...[
                            Container(
                              width: double.infinity,
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
                                      Icon(Icons.calendar_today, size: 16, color: AppColors.textTertiary),
                                      const SizedBox(width: AppSpacing.xs),
                                      Expanded(
                                        child: Text(
                                          'Valabila: ${Formatters.date(startDate)} - ${Formatters.date(endDate)}',
                                          style: AppTypography.caption,
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.sm),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: offer.isActive
                                              ? AppColors.success.withValues(alpha: 0.15)
                                              : AppColors.danger.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          offer.isActive ? 'Activa' : 'Expirata',
                                          style: AppTypography.labelSmall.copyWith(
                                            color: offer.isActive ? AppColors.success : AppColors.danger,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  // Expiry progress bar
                                  if (offer.isActive && startDate != null && endDate != null) ...[
                                    const SizedBox(height: AppSpacing.sm),
                                    _ExpiryProgressBar(startDate: startDate, endDate: endDate),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Description
                          if (offer.description != null && offer.description!.isNotEmpty) ...[
                            Text(
                              offer.description!,
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 40),
                          ],

                          // Conditions
                          if (offer.conditions != null && offer.conditions!.isNotEmpty) ...[
                            _SectionTitle('Condiții'),
                            const SizedBox(height: AppSpacing.sm),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.bgSecondary,
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.border),
                              ),
                              child: Text(
                                offer.conditions!,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                            const SizedBox(height: 40),
                          ],

                          // How to use the offer
                          Builder(builder: (_) {
                            String tipText;
                            IconData tipIcon;
                            if (booking != null && booking.hasBooking) {
                              switch (booking.type) {
                                case 'phone':
                                  tipText = 'Sună și menționează OFAI la rezervare';
                                  tipIcon = Icons.phone_in_talk;
                                  break;
                                case 'whatsapp':
                                  tipText = 'Scrie pe WhatsApp și menționează OFAI';
                                  tipIcon = Icons.message_outlined;
                                  break;
                                case 'url':
                                  tipText = 'Rezervă online prin link-ul de rezervare';
                                  tipIcon = Icons.language;
                                  break;
                                default:
                                  tipText = 'Arată această pagină la casă';
                                  tipIcon = Icons.smartphone;
                              }
                            } else {
                              tipText = 'Arată această pagină la casă';
                              tipIcon = Icons.smartphone;
                            }
                            return Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.accent.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
                              ),
                              child: Row(
                                children: [
                                  Icon(tipIcon, size: 22, color: AppColors.accent),
                                  const SizedBox(width: AppSpacing.md),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text('Cum să folosești oferta', style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
                                        const SizedBox(height: 2),
                                        Text(tipText, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                          const SizedBox(height: 40),

                          // Promo Code
                          if (offer.hasPromoCode) ...[
                            // Limited codes indicator
                            if (offer.maxReveals != null)
                              Builder(
                                builder: (_) {
                                  final remaining = offer.remainingCodes ?? 0;
                                  final pctUsed = (offer.revealCount ?? 0) / offer.maxReveals!;
                                  final isLow = pctUsed > 0.8;
                                  final isExhausted = remaining == 0;

                                  return Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                                    decoration: BoxDecoration(
                                      color: isExhausted
                                          ? AppColors.danger.withValues(alpha: 0.1)
                                          : isLow
                                              ? AppColors.warning.withValues(alpha: 0.1)
                                              : AppColors.bgCard,
                                      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                      border: Border.all(
                                        color: isExhausted
                                            ? AppColors.danger.withValues(alpha: 0.3)
                                            : isLow
                                                ? AppColors.warning.withValues(alpha: 0.3)
                                                : AppColors.border,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Icon(
                                          isExhausted ? Icons.block : Icons.confirmation_number_outlined,
                                          size: 16,
                                          color: isExhausted
                                              ? AppColors.danger
                                              : isLow
                                                  ? AppColors.warning
                                                  : AppColors.textSecondary,
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Text(
                                            isExhausted
                                                ? 'Codurile s-au epuizat'
                                                : 'Doar $remaining coduri ramase!',
                                            style: AppTypography.labelSmall.copyWith(
                                              color: isExhausted
                                                  ? AppColors.danger
                                                  : isLow
                                                      ? AppColors.warning
                                                      : AppColors.textSecondary,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            _PromoCodeCard(offerId: offer.id, isLoggedIn: isLoggedIn),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Business info
                          if (offer.business != null) ...[
                            _SectionTitle('Business'),
                            const SizedBox(height: AppSpacing.sm),
                            Builder(builder: (_) {
                              final biz = offer.business!;
                              return GestureDetector(
                                onTap: () => context.push('/business/${biz.id}'),
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(8),
                                        child: SizedBox(
                                          width: 44,
                                          height: 44,
                                          child: biz.logoUrl != null
                                              ? CachedNetworkImage(
                                                  imageUrl: biz.logoUrl!,
                                                  fit: BoxFit.cover,
                                                  errorWidget: (_, __, ___) => _BusinessInitial(biz.name),
                                                )
                                              : _BusinessInitial(biz.name),
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.md),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Flexible(
                                                  child: Text(
                                                    biz.name,
                                                    style: AppTypography.labelLarge,
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                if (biz.badgeType != null) ...[
                                                  const SizedBox(width: 4),
                                                  SubscriptionBadge(
                                                    badgeType: biz.badgeType,
                                                    size: 16,
                                                  ),
                                                ],
                                              ],
                                            ),
                                            if (biz.city != null || biz.category != null)
                                              Text(
                                                [biz.category, biz.city]
                                                    .where((s) => s != null && s.isNotEmpty)
                                                    .join(' \u2022 '),
                                                style: AppTypography.captionMuted,
                                              ),
                                          ],
                                        ),
                                      ),
                                      if (biz.rating != null && biz.rating! > 0) ...[
                                        Icon(Icons.star, size: 16, color: AppColors.accent),
                                        const SizedBox(width: 2),
                                        Text(
                                          biz.rating!.toStringAsFixed(1),
                                          style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
                                        ),
                                      ],
                                      const SizedBox(width: 4),
                                      Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                                    ],
                                  ),
                                ),
                              );
                            }),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Pinch card — show when offer is expired
                          if (!offer.isActive && offer.business != null)
                            _OfferDetailPinchCard(
                              businessId: offer.business!.id, // safe: guarded by != null above
                              isLoggedIn: isLoggedIn,
                            ),

                          // Locations
                          if (offer.locations != null && offer.locations!.isNotEmpty) ...[
                            _SectionTitle('Locații'),
                            const SizedBox(height: AppSpacing.sm),
                            ...offer.locations!.map((loc) => Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: GestureDetector(
                                onTap: loc.lat != null && loc.lng != null
                                    ? () {
                                        Launchers.maps(loc.lat!, loc.lng!, address: loc.address);
                                        final biz = offer.business;
                                        if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'navigate');
                                      }
                                    : null,
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.location_on_outlined, size: 20, color: AppColors.textTertiary),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            if (loc.address != null)
                                              Text(loc.address!, style: AppTypography.bodyMedium),
                                            if (loc.cityName != null)
                                              Text(loc.cityName!, style: AppTypography.captionMuted),
                                          ],
                                        ),
                                      ),
                                      if (loc.lat != null)
                                        Icon(Icons.map_outlined, size: 18, color: AppColors.accent),
                                    ],
                                  ),
                                ),
                              ),
                            )),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Booking
                          if (booking != null && booking.hasBooking) ...[
                            _SectionTitle('Rezervare'),
                            const SizedBox(height: AppSpacing.sm),
                            if (booking.instructions != null && booking.instructions!.isNotEmpty) ...[
                              Text(
                                booking.instructions!,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: [
                                if (booking.phone != null)
                                  _ActionChip(
                                    icon: Icons.phone,
                                    label: 'Telefon',
                                    onTap: () {
                                      Launchers.call(booking.phone!);
                                      final biz = offer.business;
                                      if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'phone');
                                    },
                                  ),
                                if (booking.whatsapp != null)
                                  _ActionChip(
                                    icon: Icons.message,
                                    label: 'WhatsApp',
                                    onTap: () {
                                      Launchers.whatsApp(booking.whatsapp!);
                                      final biz = offer.business;
                                      if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'whatsapp');
                                    },
                                  ),
                                if (booking.url != null)
                                  _ActionChip(
                                    icon: Icons.language,
                                    label: 'Online',
                                    onTap: () {
                                      Launchers.website(booking.url!);
                                      final biz = offer.business;
                                      if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'booking_url');
                                    },
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Similar offers
                          Builder(
                            builder: (_) {
                              final similarAsync = ref.watch(similarOffersProvider((offerId: offer.id, categoryId: offer.business?.categoryId, businessId: offer.business?.id)));
                              return similarAsync.when(
                                data: (similar) {
                                  if (similar.isEmpty) return const SizedBox.shrink();
                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('Oferte similare', style: AppTypography.headlineSmall),
                                      const SizedBox(height: AppSpacing.sm),
                                      SizedBox(
                                        height: 288,
                                        child: ListView.separated(
                                          scrollDirection: Axis.horizontal,
                                          itemCount: similar.length,
                                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                                          itemBuilder: (_, i) => SizedBox(
                                            width: 260,
                                            child: OfferCard(offer: similar[i], horizontal: true),
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

                          // Gallery
                          if (offer.gallery != null && offer.gallery!.isNotEmpty) ...[
                            Text(
                              'Galerie (${offer.gallery!.length})',
                              style: AppTypography.headlineSmall,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Gallery horizontal
                  if (offer.gallery != null && offer.gallery!.isNotEmpty)
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: 160,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                          itemCount: offer.gallery!.length,
                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (_, i) => GestureDetector(
                            onTap: () {
                              FullscreenGallery.open(
                                context,
                                offer.gallery!.map((g) => g.url).toList(),
                                initialIndex: i,
                              );
                              final biz = offer.business;
                              if (biz != null) {
                                AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'gallery');
                              }
                            },
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                              child: CachedNetworkImage(
                                imageUrl: offer.gallery![i].url,
                                width: 220,
                                fit: BoxFit.cover,
                                placeholder: (_, __) => Container(width: 220, color: AppColors.bgSecondary),
                                errorWidget: (_, __, ___) => Container(
                                  width: 220,
                                  color: AppColors.bgSecondary,
                                  child: const Icon(Icons.broken_image_outlined, color: AppColors.textTertiary),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Bottom padding for FAB + booking bar
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: booking != null && booking.hasBooking ? 160 : 100,
                    ),
                  ),
                ],
              ),

              // Sticky booking CTA bar
              if (booking != null && booking.hasBooking)
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: ClipRRect(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                      child: Container(
                        padding: EdgeInsets.fromLTRB(
                          AppSpacing.pagePadding,
                          AppSpacing.md,
                          isLoggedIn ? 80 : AppSpacing.pagePadding,
                          MediaQuery.of(context).padding.bottom + AppSpacing.md,
                        ),
                        decoration: const BoxDecoration(
                          color: AppColors.bgGlass,
                          border: Border(
                            top: BorderSide(color: AppColors.borderLight, width: 0.5),
                          ),
                        ),
                        child: _BookingCTA(booking: booking, offerId: offer.id, businessId: offer.business?.id),
                      ),
                    ),
                  ),
                ),

              // Favorite FAB with bounce animation
              if (isLoggedIn)
                Positioned(
                  bottom: booking != null && booking.hasBooking
                      ? MediaQuery.of(context).padding.bottom + AppSpacing.md + 6
                      : AppSpacing.xxl,
                  right: AppSpacing.pagePadding,
                  child: AnimatedToggleFab(
                    isActive: isFav,
                    onTap: () => ref.read(favoritesProvider.notifier).toggleFavorite(offer.id),
                    activeIcon: Icons.bookmark,
                    inactiveIcon: Icons.bookmark_border,
                    activeLabel: 'Salvata',
                    inactiveLabel: 'Salveaza',
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message: 'Nu s-a putut încărca oferta',
            onRetry: () => ref.invalidate(offerDetailProvider(offerId)),
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(title, style: AppTypography.headlineSmall);
  }
}

class _BusinessInitial extends StatelessWidget {
  final String name;
  const _BusinessInitial(this.name);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.accent,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionChip({required this.icon, required this.label, required this.onTap});

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

class _BookingCTA extends StatelessWidget {
  final Booking booking;
  final int offerId;
  final int? businessId;

  const _BookingCTA({required this.booking, required this.offerId, this.businessId});

  @override
  Widget build(BuildContext context) {
    // Pick the primary booking action (first available)
    IconData icon;
    String label;
    VoidCallback onTap;

    if (booking.phone != null) {
      icon = Icons.phone;
      label = 'Suna acum';
      onTap = () {
        Launchers.call(booking.phone!);
        if (businessId != null) AnalyticsService.trackClick(businessId: businessId!, offerId: offerId, actionType: 'phone');
      };
    } else if (booking.whatsapp != null) {
      icon = Icons.message;
      label = 'WhatsApp';
      onTap = () {
        Launchers.whatsApp(booking.whatsapp!);
        if (businessId != null) AnalyticsService.trackClick(businessId: businessId!, offerId: offerId, actionType: 'whatsapp');
      };
    } else if (booking.url != null) {
      icon = Icons.language;
      label = 'Rezerva online';
      onTap = () {
        Launchers.website(booking.url!);
        if (businessId != null) AnalyticsService.trackClick(businessId: businessId!, offerId: offerId, actionType: 'booking_url');
      };
    } else {
      return const SizedBox.shrink();
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.accent,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
          boxShadow: [
            BoxShadow(
              color: AppColors.accent.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 20, color: AppColors.bgPrimary),
            const SizedBox(width: AppSpacing.sm),
            Text(
              label,
              style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpiryProgressBar extends StatelessWidget {
  final DateTime startDate;
  final DateTime endDate;

  const _ExpiryProgressBar({required this.startDate, required this.endDate});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final totalDuration = endDate.difference(startDate).inHours.toDouble();
    final elapsed = now.difference(startDate).inHours.toDouble();
    final progress = totalDuration > 0 ? (elapsed / totalDuration).clamp(0.0, 1.0) : 0.0;

    // Color from green -> warning -> danger
    Color barColor;
    if (progress < 0.5) {
      barColor = AppColors.success;
    } else if (progress < 0.8) {
      barColor = AppColors.warning;
    } else {
      barColor = AppColors.danger;
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: SizedBox(
        height: 4,
        child: LinearProgressIndicator(
          value: progress,
          backgroundColor: AppColors.bgSecondary,
          valueColor: AlwaysStoppedAnimation<Color>(barColor),
        ),
      ),
    );
  }
}

class _PromoCodeCard extends ConsumerStatefulWidget {
  final int offerId;
  final bool isLoggedIn;

  const _PromoCodeCard({
    required this.offerId,
    required this.isLoggedIn,
  });

  @override
  ConsumerState<_PromoCodeCard> createState() => _PromoCodeCardState();
}

class _PromoCodeCardState extends ConsumerState<_PromoCodeCard> {
  bool _revealed = false;
  bool _loading = false;
  String? _code;
  String? _error;

  Future<void> _revealCode() async {
    if (!widget.isLoggedIn) return;

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await ApiClient().dio.post(
        ApiEndpoints.revealCode(widget.offerId),
      );
      final code = response.data['promo_code'] as String?;

      if (code != null && mounted) {
        setState(() {
          _code = code;
          _revealed = true;
          _loading = false;
        });
      } else if (mounted) {
        setState(() {
          _error = 'Codul nu este disponibil';
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Nu s-a putut încărca codul';
          _loading = false;
        });
      }
    }
  }

  void _showFullscreenQR(BuildContext context, String code) {
    showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Cod Promoțional',
                style: AppTypography.headlineSmall.copyWith(color: const Color(0xFF06060A)),
              ),
              const SizedBox(height: 8),
              Text(
                code,
                style: AppTypography.labelLarge.copyWith(
                  color: const Color(0xFF06060A),
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 24),
              QrImageView(
                data: code,
                version: QrVersions.auto,
                size: 280,
                backgroundColor: Colors.white,
                eyeStyle: const QrEyeStyle(
                  eyeShape: QrEyeShape.square,
                  color: Color(0xFF06060A),
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: Color(0xFF06060A),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Arată acest cod la casă',
                style: AppTypography.bodySmall.copyWith(color: Colors.grey[600]),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _copyCode() async {
    if (_code == null) return;

    await Clipboard.setData(ClipboardData(text: _code!));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Cod copiat în clipboard'),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
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
            Icons.confirmation_number_outlined,
            size: 36,
            color: AppColors.accent,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Cod Promoțional',
            style: AppTypography.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),

          if (!widget.isLoggedIn) ...[
            // Not logged in state
            Text(
              'Conectează-te pentru a vedea codul',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ] else if (_error != null) ...[
            // Error state
            Text(
              _error!,
              style: AppTypography.bodySmall.copyWith(color: AppColors.danger),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: _revealCode,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.refresh, size: 20, color: AppColors.bgPrimary),
                    const SizedBox(width: 8),
                    Text(
                      'Încearcă din nou',
                      style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
                    ),
                  ],
                ),
              ),
            ),
          ] else if (!_revealed) ...[
            // Not revealed state (blurred placeholder)
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              ),
              child: Text(
                '* * * * * *',
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.textTertiary,
                  letterSpacing: 4,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: _loading ? null : _revealCode,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: _loading ? AppColors.accent.withValues(alpha: 0.5) : AppColors.accent,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: _loading
                    ? const Center(
                        child: SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(AppColors.bgPrimary),
                          ),
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.visibility, size: 20, color: AppColors.bgPrimary),
                          const SizedBox(width: 8),
                          Text(
                            'Dezvăluie codul',
                            style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
                          ),
                        ],
                      ),
              ),
            ),
          ] else if (_code != null) ...[
            // Revealed state
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              ),
              child: Text(
                _code!,
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.accent,
                  fontFamily: 'monospace',
                  letterSpacing: 2,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            GestureDetector(
              onTap: _copyCode,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.copy, size: 20, color: AppColors.bgPrimary),
                    const SizedBox(width: 8),
                    Text(
                      'Copiază codul',
                      style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
                    ),
                  ],
                ),
              ),
            ),
            // QR Code
            const SizedBox(height: AppSpacing.lg),
            GestureDetector(
              onTap: () => _showFullscreenQR(context, _code!),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: QrImageView(
                  data: _code!,
                  version: QrVersions.auto,
                  size: 160,
                  backgroundColor: Colors.white,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: Color(0xFF06060A),
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Color(0xFF06060A),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Apasă pentru ecran complet',
              style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
            ),
          ] else ...[
            // Fallback: revealed but no code available
            Text(
              'Codul nu este disponibil',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}

class _ActivityPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _ActivityPill({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(label, style: AppTypography.labelSmall.copyWith(color: color)),
        ],
      ),
    );
  }
}

class _OfferDetailPinchCard extends ConsumerStatefulWidget {
  final int businessId;
  final bool isLoggedIn;

  const _OfferDetailPinchCard({
    required this.businessId,
    required this.isLoggedIn,
  });

  @override
  ConsumerState<_OfferDetailPinchCard> createState() => _OfferDetailPinchCardState();
}

class _OfferDetailPinchCardState extends ConsumerState<_OfferDetailPinchCard>
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
      // Auto-follow the business
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

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      child: Container(
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
            Icon(Icons.campaign_outlined, size: 36, color: AppColors.accent),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Oferta a expirat',
              style: AppTypography.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              'Cere business-ului o oferta noua!',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),

            // Request count badge
            if (pinchState.total > 0)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.md),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.bgSecondary,
                    borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                  ),
                  child: Text(
                    '${pinchState.total} ${pinchState.total == 1 ? 'persoana a cerut' : 'persoane au cerut'} deja',
                    style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                  ),
                ),
              ),

            // CTA
            if (!widget.isLoggedIn)
              Text(
                'Conecteaza-te pentru a cere o oferta',
                style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                textAlign: TextAlign.center,
              )
            else if (_showSuccess)
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
                          'Cerere trimisa!',
                          style: AppTypography.labelLarge.copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else if (pinchState.userRequested && pinchState.daysRemaining != null && pinchState.daysRemaining! > 0)
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
                          'Cerere trimisa',
                          style: AppTypography.labelLarge.copyWith(color: AppColors.textTertiary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Poti cere din nou peste ${pinchState.daysRemaining} ${pinchState.daysRemaining == 1 ? 'zi' : 'zile'}',
                    style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                  ),
                ],
              )
            else
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
                  label: Text(pinchState.isSubmitting ? 'Se trimite...' : 'Vreau o oferta noua!'),
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
    );
  }
}
