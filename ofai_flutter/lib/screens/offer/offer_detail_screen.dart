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

import '../../models/offer.dart';
import '../../providers/offers_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/offer_card.dart';
import '../../widgets/subscription_badge.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../services/analytics_service.dart';
import '../../providers/offer_requests_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../providers/recently_viewed_provider.dart';
import '../../widgets/report_dialog.dart';
import '../../widgets/flash_countdown_badge.dart';
import '../../widgets/stepper_how_to.dart';
import '../../widgets/masonry_gallery.dart';
import '../../widgets/sticky_bottom_cta.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

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
      if (prev == null && next.hasValue) {
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
          // booking data used inline in "Cum să folosești" section

          return Stack(
            children: [
              RefreshIndicator(
                color: AppColors.accent,
                backgroundColor: AppColors.bgCard,
                onRefresh: () async {
                  ref.invalidate(offerDetailProvider(offerId));
                },
                child: CustomScrollView(
                slivers: [
                  // Hero image with parallax effect
                  SliverAppBar(
                    expandedHeight: 240,
                    pinned: true,
                    backgroundColor: AppColors.bgPrimary,
                    stretch: true,
                    actions: [
                      if (isLoggedIn)
                        Semantics(
                          label: isFav
                              ? AppLocalizations.of(context)!.saved
                              : AppLocalizations.of(context)!.save,
                          button: true,
                          child: IconButton(
                            icon: Icon(
                              isFav ? Icons.bookmark : Icons.bookmark_border,
                              color: isFav ? AppColors.accent : null,
                            ),
                            onPressed: () => ref
                                .read(favoritesProvider.notifier)
                                .toggleFavorite(offer.id),
                          ),
                        ),
                      Semantics(
                        label: AppLocalizations.of(context)!.shareOffer,
                        button: true,
                        child: IconButton(
                          icon: const Icon(Icons.share_outlined),
                          onPressed: () {
                            Launchers.shareOffer(offer.title, offer.id);
                            final biz = offer.business;
                            if (biz != null) {
                              AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'share');
                            }
                          },
                        ),
                      ),
                      if (isLoggedIn)
                        Semantics(
                          label: AppLocalizations.of(context)!.reportOffer,
                          button: true,
                          child: PopupMenuButton<String>(
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
                                          memCacheWidth: 800,
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
                                    child: Semantics(
                                      label: AppLocalizations.of(context)!.discountLabel(offer.discountLabel),
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
                                    AppLocalizations.of(context)!.flashOffer,
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
                          Semantics(
                            label: AppLocalizations.of(context)!.offerTitle(offer.title),
                            header: true,
                            child: Text(offer.title, style: AppTypography.headlineLarge),
                          ),

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
                                    label: AppLocalizations.of(context)!.trending,
                                    color: AppColors.accent,
                                  ),
                                if (offer.saveCount != null && offer.saveCount! >= 3)
                                  _ActivityPill(
                                    icon: Icons.bookmark,
                                    label: AppLocalizations.of(context)!.saveCount(offer.saveCount!),
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
                                          AppLocalizations.of(context)!.validPeriod(Formatters.date(startDate), Formatters.date(endDate)),
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
                                          offer.isActive ? AppLocalizations.of(context)!.active : AppLocalizations.of(context)!.expired,
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

                          // How to use — Bolt-style stepper
                          StepperHowTo(
                            title: AppLocalizations.of(context)!.howToUseOffer,
                            steps: [
                              StepData(
                                icon: Icons.assignment_outlined,
                                title: 'Alege oferta',
                                subtitle: 'Verifică detaliile și condițiile',
                              ),
                              StepData(
                                icon: offer.hasPromoCode
                                    ? Icons.content_copy
                                    : (booking != null && booking.hasBooking)
                                        ? Icons.phone_outlined
                                        : Icons.touch_app_outlined,
                                title: offer.hasPromoCode
                                    ? 'Copiază codul'
                                    : 'Contactează',
                                subtitle: offer.hasPromoCode
                                    ? 'Copiază codul promoțional'
                                    : 'Sună sau rezervă online',
                              ),
                              StepData(
                                icon: Icons.check_circle_outline,
                                title: offer.hasPromoCode
                                    ? 'Folosește codul'
                                    : 'Profită!',
                                subtitle: offer.hasPromoCode
                                    ? 'Folosește codul la plată'
                                    : 'Prezintă oferta și bucură-te de reducere',
                              ),
                            ],
                          ),

                          const SizedBox(height: AppSpacing.xxl),

                          // Booking buttons (kept after stepper)
                          if (offer.bookingMethods != null && offer.bookingMethods!.isNotEmpty) ...[
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: offer.bookingMethods!.map((bm) {
                                return _ActionChip(
                                  icon: bm.isPhone ? Icons.phone : bm.isWhatsApp ? Icons.message : Icons.language,
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
                                    final biz = offer.business;
                                    if (biz != null) {
                                      AnalyticsService.trackClick(
                                        businessId: biz.id,
                                        offerId: offer.id,
                                        actionType: bm.isPhone ? 'phone' : bm.isWhatsApp ? 'whatsapp' : 'booking_url',
                                      );
                                    }
                                  },
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ] else if (booking != null && booking.hasBooking) ...[
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: [
                                if (booking.phone != null)
                                  _ActionChip(
                                    icon: Icons.phone,
                                    label: AppLocalizations.of(context)!.callNow,
                                    color: AppColors.accent,
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
                                    color: const Color(0xFF25D366),
                                    onTap: () {
                                      Launchers.whatsApp(booking.whatsapp!);
                                      final biz = offer.business;
                                      if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'whatsapp');
                                    },
                                  ),
                                if (booking.url != null)
                                  _ActionChip(
                                    icon: Icons.language,
                                    label: AppLocalizations.of(context)!.bookOnline,
                                    color: AppColors.accent,
                                    onTap: () {
                                      Launchers.website(booking.url!);
                                      final biz = offer.business;
                                      if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'booking_url');
                                    },
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Booking instructions
                          if (booking != null && booking.instructions != null && booking.instructions!.isNotEmpty) ...[
                            Text(
                              booking.instructions!,
                              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Description
                          if (offer.description != null && offer.description!.isNotEmpty) ...[
                            _SectionCard(
                              icon: Icons.description_outlined,
                              title: 'Descriere',
                              child: Text(
                                offer.description!,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Conditions
                          if (offer.conditions != null && offer.conditions!.isNotEmpty) ...[
                            _SectionCard(
                              icon: Icons.info_outline,
                              title: AppLocalizations.of(context)!.conditions,
                              child: Text(
                                offer.conditions!,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

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
                                                ? AppLocalizations.of(context)!.codesExhausted
                                                : AppLocalizations.of(context)!.codesRemaining(remaining),
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

                          // Business info — centered card like web
                          if (offer.business != null) ...[
                            Builder(builder: (_) {
                              final biz = offer.business!;
                              return Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(AppSpacing.xl),
                                decoration: BoxDecoration(
                                  color: AppColors.bgSecondary,
                                  borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Column(
                                  children: [
                                    // Logo
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: SizedBox(
                                        width: 64,
                                        height: 64,
                                        child: biz.logoUrl != null
                                            ? CachedNetworkImage(
                                                imageUrl: biz.logoUrl!,
                                                fit: BoxFit.cover,
                                                memCacheWidth: 128,
                                                memCacheHeight: 128,
                                                errorWidget: (_, __, ___) => _BusinessInitial(biz.name),
                                              )
                                            : _BusinessInitial(biz.name),
                                      ),
                                    ),
                                    const SizedBox(height: AppSpacing.md),
                                    // Name + badge
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Flexible(
                                          child: Text(
                                            biz.name,
                                            style: AppTypography.headlineSmall,
                                            textAlign: TextAlign.center,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        if (biz.badgeType != null) ...[
                                          const SizedBox(width: 6),
                                          SubscriptionBadge(badgeType: biz.badgeType, size: 18),
                                        ],
                                      ],
                                    ),
                                    // Rating
                                    if (biz.rating != null && biz.rating! > 0) ...[
                                      const SizedBox(height: AppSpacing.xs),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          ...List.generate(5, (i) => Icon(
                                            i < biz.rating!.round() ? Icons.star : Icons.star_border,
                                            size: 16,
                                            color: i < biz.rating!.round() ? AppColors.accent : AppColors.textTertiary,
                                          )),
                                          const SizedBox(width: 6),
                                          Text(
                                            biz.ratingCount != null && biz.ratingCount! > 0
                                                ? '${biz.rating!.toStringAsFixed(1)} (${biz.ratingCount})'
                                                : biz.rating!.toStringAsFixed(1),
                                            style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ] else ...[
                                      const SizedBox(height: AppSpacing.xs),
                                      Text(
                                        'Nicio recenzie',
                                        style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                                      ),
                                    ],
                                    // Category + City chips
                                    if (biz.category != null || biz.city != null) ...[
                                      const SizedBox(height: AppSpacing.md),
                                      Wrap(
                                        spacing: AppSpacing.sm,
                                        children: [
                                          if (biz.category != null)
                                            Chip(
                                              label: Text(biz.category!, style: AppTypography.caption),
                                              backgroundColor: AppColors.bgCard,
                                              side: BorderSide(color: AppColors.border),
                                              padding: EdgeInsets.zero,
                                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              visualDensity: VisualDensity.compact,
                                            ),
                                          if (biz.city != null)
                                            Chip(
                                              avatar: Icon(Icons.location_on_outlined, size: 14, color: AppColors.textSecondary),
                                              label: Text(biz.city!, style: AppTypography.caption),
                                              backgroundColor: AppColors.bgCard,
                                              side: BorderSide(color: AppColors.border),
                                              padding: EdgeInsets.zero,
                                              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                              visualDensity: VisualDensity.compact,
                                            ),
                                        ],
                                      ),
                                    ],
                                    const SizedBox(height: AppSpacing.lg),
                                    // CTA button
                                    SizedBox(
                                      width: double.infinity,
                                      child: GestureDetector(
                                        onTap: () => context.push('/business/${biz.id}'),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
                                          decoration: BoxDecoration(
                                            color: AppColors.bgCard,
                                            borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                            border: Border.all(color: AppColors.border),
                                          ),
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Text(
                                                'Vezi business-ul',
                                                style: AppTypography.labelLarge,
                                              ),
                                              const SizedBox(width: AppSpacing.xs),
                                              Icon(Icons.arrow_forward, size: 18, color: AppColors.textPrimary),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    // Website link
                                    if (biz.website != null && biz.website!.isNotEmpty) ...[
                                      const SizedBox(height: AppSpacing.sm),
                                      GestureDetector(
                                        onTap: () => Launchers.website(biz.website!),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.language, size: 16, color: AppColors.textSecondary),
                                            const SizedBox(width: AppSpacing.xs),
                                            Text(
                                              'Vizitează website-ul',
                                              style: AppTypography.labelMedium.copyWith(color: AppColors.textSecondary),
                                            ),
                                            const SizedBox(width: 2),
                                            Icon(Icons.open_in_new, size: 14, color: AppColors.textSecondary),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ],
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
                            _SectionCard(
                              icon: Icons.location_on_outlined,
                              title: '${AppLocalizations.of(context)!.locations} (${offer.locations!.length})',
                              child: Column(
                                children: offer.locations!.map((loc) {
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Icon(Icons.place, size: 18, color: AppColors.textTertiary),
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
                                          ],
                                        ),
                                        // Phone from business if available
                                        if (offer.business?.phone != null) ...[
                                          const SizedBox(height: AppSpacing.xs),
                                          GestureDetector(
                                            onTap: () => Launchers.call(offer.business!.phone!),
                                            child: Row(
                                              children: [
                                                Icon(Icons.phone_outlined, size: 16, color: AppColors.textTertiary),
                                                const SizedBox(width: AppSpacing.sm),
                                                Text(offer.business!.phone!, style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary)),
                                              ],
                                            ),
                                          ),
                                        ],
                                        if (loc.lat != null && loc.lng != null) ...[
                                          const SizedBox(height: AppSpacing.sm),
                                          GestureDetector(
                                            onTap: () {
                                              Launchers.maps(loc.lat!, loc.lng!, address: loc.address);
                                              final biz = offer.business;
                                              if (biz != null) AnalyticsService.trackClick(businessId: biz.id, offerId: offer.id, actionType: 'navigate');
                                            },
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                                              decoration: BoxDecoration(
                                                color: AppColors.accent,
                                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                              ),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Icon(Icons.navigation_outlined, size: 16, color: AppColors.bgPrimary),
                                                  const SizedBox(width: AppSpacing.xs),
                                                  Text('Navighează', style: AppTypography.labelMedium.copyWith(color: AppColors.bgPrimary)),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // MasonryGallery — replaces horizontal strip
                          if (offer.gallery != null && offer.gallery!.isNotEmpty) ...[
                            MasonryGallery(
                              imageUrls: offer.gallery!.map((g) => g.url).toList(),
                              headerLabel: AppLocalizations.of(context)!.galleryCount(offer.gallery!.length),
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
                                      Semantics(label: AppLocalizations.of(context)!.similarOffers, header: true, child: Text(AppLocalizations.of(context)!.similarOffers, style: AppTypography.headlineSmall)),
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

                          // Bottom padding for sticky CTA
                          const SizedBox(height: 100),
                        ],
                      ),
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
                child: _buildOfferCta(context, offer),
              ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message: AppLocalizations.of(context)!.errorLoadingOffer,
            onRetry: () => ref.invalidate(offerDetailProvider(offerId)),
          ),
        ),
      ),
    );
  }

  Widget _buildOfferCta(BuildContext context, Offer offer) {
    // Promo code offer — user reveals code inline
    if (offer.hasPromoCode) {
      return StickyBottomCta(
        label: 'Profită acum',
        icon: Icons.local_offer,
        onTap: () {
          // No-op: promo reveal button is inline on the screen
        },
      );
    }

    // Multi-platform booking methods (preferred)
    final methods = offer.bookingMethods;
    if (methods != null && methods.isNotEmpty) {
      final first = methods.first;
      if (first.isPhone) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.phone,
          onTap: () => Launchers.call(first.value),
        );
      } else if (first.isWhatsApp) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.message,
          onTap: () => Launchers.whatsApp(first.value),
        );
      } else {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.open_in_new,
          onTap: () => Launchers.website(first.href),
        );
      }
    }

    // Legacy single booking object
    final booking = offer.booking;
    if (booking != null && booking.hasBooking) {
      if (booking.phone != null) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.phone,
          onTap: () => Launchers.call(booking.phone!),
        );
      } else if (booking.whatsapp != null) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.message,
          onTap: () => Launchers.whatsApp(booking.whatsapp!),
        );
      } else if (booking.url != null) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.open_in_new,
          onTap: () => Launchers.website(booking.url!),
        );
      }
    }

    // Fallback: business phone / website
    final biz = offer.business;
    if (biz != null) {
      if (biz.phone != null && biz.phone!.isNotEmpty) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.phone,
          onTap: () => Launchers.call(biz.phone!),
        );
      }
      if (biz.website != null && biz.website!.isNotEmpty) {
        return StickyBottomCta(
          label: 'Profită acum',
          icon: Icons.open_in_new,
          onTap: () => Launchers.website(biz.website!),
        );
      }
    }

    return const SizedBox.shrink();
  }
}


class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;
  const _SectionCard({required this.icon, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
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
            Icon(icon, size: 20, color: AppColors.accent),
            const SizedBox(width: AppSpacing.sm),
            Text(title, style: AppTypography.headlineSmall),
          ]),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
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
  final Color? color;

  const _ActionChip({required this.icon, required this.label, required this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.accent;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
            Text(label, style: AppTypography.labelMedium.copyWith(color: c)),
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
    if (!widget.isLoggedIn || _loading) return;

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
          _error = AppLocalizations.of(context)!.codeUnavailable;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context)!.codeLoadError;
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
                AppLocalizations.of(context)!.promoCode,
                style: AppTypography.headlineSmall.copyWith(color: AppColors.bgPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                code,
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.bgPrimary,
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
                  color: AppColors.bgPrimary,
                ),
                dataModuleStyle: const QrDataModuleStyle(
                  dataModuleShape: QrDataModuleShape.square,
                  color: AppColors.bgPrimary,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                AppLocalizations.of(context)!.showCodeAtCheckout,
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
          content: Text(AppLocalizations.of(context)!.codeCopied),
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
            AppLocalizations.of(context)!.promoCode,
            style: AppTypography.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),

          if (!widget.isLoggedIn) ...[
            // Not logged in state
            Text(
              AppLocalizations.of(context)!.loginToSeeCode,
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
                      AppLocalizations.of(context)!.tryAgain,
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
                            AppLocalizations.of(context)!.revealCode,
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
                      AppLocalizations.of(context)!.copyCode,
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
                    color: AppColors.bgPrimary,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: AppColors.bgPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              AppLocalizations.of(context)!.tapForFullscreen,
              style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
            ),
          ] else ...[
            // Fallback: revealed but no code available
            Text(
              AppLocalizations.of(context)!.codeUnavailable,
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
