import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../core/utils/formatters.dart';
import '../core/utils/distance.dart';
import '../models/offer.dart';
import 'subscription_badge.dart';
import 'flash_countdown_badge.dart';
import '../providers/location_provider.dart';

class FeaturedOfferCard extends ConsumerWidget {
  final Offer offer;

  const FeaturedOfferCard({super.key, required this.offer});

  Color _urgencyColor(int level) {
    switch (level) {
      case 3:
        return AppColors.danger;
      case 2:
        return AppColors.warning;
      case 1:
        return AppColors.warning;
      default:
        return AppColors.textSecondary;
    }
  }

  String? _distanceText(WidgetRef ref) {
    final pos = ref.watch(userLocationProvider).valueOrNull;
    if (pos == null) return null;

    double? bLat = offer.business?.lat;
    double? bLng = offer.business?.lng;

    if (bLat == null || bLng == null) {
      final locs = offer.locations;
      if (locs != null) {
        for (final loc in locs) {
          if (loc.lat != null && loc.lng != null) {
            bLat = loc.lat;
            bLng = loc.lng;
            break;
          }
        }
      }
    }

    if (bLat == null || bLng == null) return null;
    final km =
        DistanceUtils.haversine(pos.latitude, pos.longitude, bLat, bLng);
    return DistanceUtils.format(km);
  }

  static Widget _logoFallback(String name) {
    return Container(
      color: AppColors.accent,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: const TextStyle(
            color: AppColors.bgPrimary,
            fontSize: 11,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final heroImage = offer.displayImage;
    final timeLeft = Formatters.timeLeft(offer.endDate);
    final urgency = Formatters.urgencyLevel(offer.endDate);
    final urgencyColor = _urgencyColor(urgency);
    final dist = _distanceText(ref);

    final isBigDiscount = offer.discountValue != null &&
        offer.discountType == 'percentage' &&
        offer.discountValue! >= 30;

    return GestureDetector(
      onTap: () => context.push('/offer/${offer.id}'),
      child: Container(
        width: double.infinity,
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(
            color: AppColors.accent.withValues(alpha: 0.4),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.accent.withValues(alpha: 0.15),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Image section with gradient overlay ──
              SizedBox(
                height: 220,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Background image
                    heroImage != null && heroImage.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: heroImage,
                            fit: BoxFit.cover,
                            memCacheWidth: 600,
                            placeholder: (_, __) =>
                                Container(color: AppColors.bgSecondary),
                            errorWidget: (_, __, ___) => Container(
                              color: AppColors.bgSecondary,
                              child: const Icon(
                                Icons.local_offer_outlined,
                                size: 48,
                                color: AppColors.textTertiary,
                              ),
                            ),
                          )
                        : Container(
                            color: AppColors.bgSecondary,
                            child: const Icon(
                              Icons.local_offer_outlined,
                              size: 48,
                              color: AppColors.textTertiary,
                            ),
                          ),

                    // Gradient overlay — seamless fade into bgSecondary
                    const Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              Color(0x00111111),
                              Color(0x99111111),
                              Color(0xFF111111),
                            ],
                            stops: [0.0, 0.35, 0.7, 1.0],
                          ),
                        ),
                      ),
                    ),

                    // "Oferta Zilei" badge — top left
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius:
                              BorderRadius.circular(AppSpacing.pillRadius),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.accent.withValues(alpha: 0.4),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star_rounded,
                                size: 14, color: AppColors.bgPrimary),
                            const SizedBox(width: 4),
                            Text(
                              'Oferta Zilei',
                              style: AppTypography.labelSmall.copyWith(
                                color: AppColors.bgPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Discount badge — top right (gradient for ≥30%)
                    if (offer.discountValue != null)
                      Positioned(
                        top: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            gradient: isBigDiscount
                                ? const LinearGradient(
                                    colors: AppColors.accentGradient)
                                : null,
                            color: isBigDiscount ? null : AppColors.accent,
                            borderRadius:
                                BorderRadius.circular(AppSpacing.pillRadius),
                            boxShadow: [
                              BoxShadow(
                                color:
                                    AppColors.accent.withValues(alpha: 0.4),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Text(
                            offer.discountLabel,
                            style: AppTypography.labelLarge.copyWith(
                              color: AppColors.bgPrimary,
                            ),
                          ),
                        ),
                      ),

                    // Title + business — bottom of image over gradient
                    Positioned(
                      bottom: 14,
                      left: 14,
                      right: 14,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            offer.title,
                            style: AppTypography.headlineMedium,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (offer.business != null) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                // Business logo avatar with border for gradient visibility
                                Container(
                                  width: 26,
                                  height: 26,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white24, width: 1),
                                  ),
                                  child: ClipOval(
                                    child: SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: offer.business!.logoUrl != null && offer.business!.logoUrl!.isNotEmpty
                                          ? CachedNetworkImage(
                                              imageUrl: offer.business!.logoUrl!,
                                              fit: BoxFit.cover,
                                              memCacheWidth: 48,
                                              memCacheHeight: 48,
                                              placeholder: (_, __) => _logoFallback(offer.business!.name),
                                              errorWidget: (_, __, ___) => _logoFallback(offer.business!.name),
                                            )
                                          : _logoFallback(offer.business!.name),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                if (offer.business!.badgeType != null) ...[
                                  SubscriptionBadge(
                                      badgeType: offer.business!.badgeType,
                                      size: 14),
                                  const SizedBox(width: 4),
                                ],
                                Flexible(
                                  child: Text(
                                    offer.business!.name,
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                // Rating
                                if (offer.business!.rating != null &&
                                    offer.business!.rating! > 0) ...[
                                  const SizedBox(width: 8),
                                  Icon(Icons.star_rounded,
                                      size: 13,
                                      color: AppColors.accent),
                                  const SizedBox(width: 2),
                                  Text(
                                    offer.business!.rating!
                                        .toStringAsFixed(1),
                                    style: AppTypography.caption.copyWith(
                                      color: AppColors.textSecondary,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // ── Content section below image ──
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Description preview
                    if (offer.description != null &&
                        offer.description!.isNotEmpty) ...[
                      Text(
                        offer.description!,
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                    ],

                    // Subtle divider
                    Container(
                      height: 1,
                      color: AppColors.border,
                    ),
                    const SizedBox(height: AppSpacing.sm),

                    // Metadata row: distance left, social proof center, countdown/CTA right
                    Builder(builder: (context) {
                      final startParsed = offer.startDate != null ? DateTime.tryParse(offer.startDate!) : null;
                      final isNew = startParsed != null && DateTime.now().difference(startParsed).inDays <= 3;
                      final hasLeftContent = dist != null || offer.business?.city != null;

                      return Row(
                      children: [
                        // Left side: distance or city
                        if (dist != null) ...[
                          Icon(Icons.location_on_outlined,
                              size: 14, color: AppColors.accent),
                          const SizedBox(width: 4),
                          Text(
                            '$dist distanta',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.accent,
                            ),
                          ),
                        ] else if (offer.business?.city != null) ...[
                          Icon(Icons.location_on_outlined,
                              size: 14, color: AppColors.textTertiary),
                          const SizedBox(width: 4),
                          Text(
                            offer.business!.city ?? '',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.textTertiary,
                            ),
                          ),
                        ],

                        // "Nou" indicator
                        if (isNew) ...[
                          if (hasLeftContent)
                            Text(' \u2022 ', style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary)),
                          Text(
                            'Nou',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.accent,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],


                        const Spacer(),

                        // Right side: flash countdown, end-date countdown, or "Vezi oferta"
                        if (offer.isFlashDeal) ...[
                          FlashCountdownBadge(expiresAt: offer.flashExpiresAt!, compact: true),
                        ] else if (timeLeft != null && urgency > 0) ...[
                          Icon(
                            urgency >= 2
                                ? Icons.timer_outlined
                                : Icons.schedule_outlined,
                            size: 14,
                            color: urgencyColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            timeLeft,
                            style: AppTypography.labelSmall.copyWith(
                              color: urgencyColor,
                              fontWeight: urgency >= 2
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                            ),
                          ),
                        ] else ...[
                          Text(
                            'Vezi oferta',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.accent,
                            ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward_rounded,
                            size: 13,
                            color: AppColors.accent,
                          ),
                        ],
                      ],
                    );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
    );
  }
}


