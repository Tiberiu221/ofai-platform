import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../core/utils/formatters.dart';
import '../models/offer.dart';
import '../providers/auth_provider.dart';
import '../providers/favorites_provider.dart';
import '../providers/location_provider.dart';
import '../core/utils/distance.dart';
import 'subscription_badge.dart';
import 'tap_scale.dart';

class OfferCard extends ConsumerWidget {
  final Offer offer;
  final bool horizontal;

  const OfferCard({super.key, required this.offer, this.horizontal = false});

  /// Returns formatted distance string or null if unavailable.
  /// Tries business.lat/lng first, then falls back to first location with coords.
  String? _distanceText(WidgetRef ref) {
    final locAsync = ref.watch(userLocationProvider);
    final pos = locAsync.valueOrNull;
    if (pos == null) return null;

    double? bLat = offer.business?.lat;
    double? bLng = offer.business?.lng;

    // Fallback: use first location with coordinates
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
    final km = DistanceUtils.haversine(pos.latitude, pos.longitude, bLat, bLng);
    return DistanceUtils.format(km);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (horizontal) return _buildHorizontal(context, ref);
    return _buildVertical(context, ref);
  }

  // ── Vertical layout ──────────────────────────────────────────

  Widget _buildVertical(BuildContext context, WidgetRef ref) {
    return Semantics(
      label: 'Oferta: ${offer.title}${offer.business != null ? ', ${offer.business!.name}' : ''}',
      button: true,
      child: TapScale(
        onTap: () => context.push('/offer/${offer.id}'),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.bgSecondary,
            borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1A000000),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.hardEdge,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Image section ──
              AspectRatio(
                aspectRatio: 16 / 10,
                child: Hero(
                  tag: 'offer-image-${offer.id}',
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _buildImage(),
                      // Gradient overlay — smooth fade into bgSecondary
                      const Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                Color(0x00111111),
                                Color(0x66111111),
                                Color(0xCC111111),
                              ],
                              stops: [0.0, 0.4, 0.75, 1.0],
                            ),
                          ),
                        ),
                      ),
                      // Discount badge (top right)
                      if (offer.discountValue != null)
                        Positioned(
                          top: 12,
                          right: 12,
                          child: _buildBadge(),
                        ),
                      // Favorite bookmark (top left)
                      _buildFavoriteIcon(context, ref),
                      // Promoted badge (top left, next to fav)
                      _buildPromotedBadge(),
                      // Expiry countdown (bottom left)
                      _buildCountdown(),
                      // Rating badge (bottom right) — only when not trending
                      _buildRatingBadge(),
                      // Trending badge (bottom right) — overrides rating position
                      _buildTrendingBadge(),
                    ],
                  ),
                ),
              ),

              // ── Content section ──
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Text(
                      offer.title,
                      style: AppTypography.labelLarge,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    // Description
                    if (offer.description != null &&
                        offer.description!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        offer.description!,
                        style: AppTypography.bodySmall
                            .copyWith(color: AppColors.textSecondary),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],

                    // Metadata (business info)
                    if (offer.business != null) ...[
                      const SizedBox(height: AppSpacing.md),

                      // Subtle divider
                      Container(height: 1, color: AppColors.border),
                      const SizedBox(height: AppSpacing.md),

                      // Business name row — verified (left) + full-width name
                      _buildBusinessRow(),
                      const SizedBox(height: AppSpacing.xs),

                      // Location + category row
                      _buildLocationRow(ref),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Horizontal layout ────────────────────────────────────────

  Widget _buildHorizontal(BuildContext context, WidgetRef ref) {
    return TapScale(
      onTap: () => context.push('/offer/${offer.id}'),
      child: Container(
        width: 260,
        decoration: BoxDecoration(
          color: AppColors.bgSecondary,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
          boxShadow: const [
            BoxShadow(
              color: Color(0x1A000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Image section ──
            SizedBox(
              height: 150,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _buildImage(),
                  // Gradient overlay
                  const Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Color(0x00111111),
                            Color(0x66111111),
                            Color(0xCC111111),
                          ],
                          stops: [0.0, 0.4, 0.75, 1.0],
                        ),
                      ),
                    ),
                  ),
                  if (offer.discountValue != null)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: _buildBadge(),
                    ),
                  _buildFavoriteIcon(context, ref),
                  _buildPromotedBadge(),
                  _buildCountdown(),
                  _buildRatingBadge(),
                  _buildTrendingBadge(),
                ],
              ),
            ),

            // ── Content section ──
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  Text(
                    offer.title,
                    style: AppTypography.labelLarge,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),

                  if (offer.business != null) ...[
                    const SizedBox(height: AppSpacing.md),

                    // Subtle divider
                    Container(height: 1, color: AppColors.border),
                    const SizedBox(height: AppSpacing.md),

                    // Business name row
                    _buildBusinessRow(),
                    const SizedBox(height: AppSpacing.xs),

                    // Location + category row
                    _buildLocationRow(ref),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Shared metadata rows ─────────────────────────────────────

  /// Business name row: [badge] full-width name
  Widget _buildBusinessRow() {
    final biz = offer.business;
    if (biz == null) return const SizedBox.shrink();
    return Row(
      children: [
        if (biz.badgeType != null) ...[
          SubscriptionBadge(badgeType: biz.badgeType, size: 14),
          const SizedBox(width: 4),
        ],
        Expanded(
          child: Text(
            biz.name,
            style: AppTypography.caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  /// Location + category row: [icon] distance/city . category ... [bookmark] saves
  Widget _buildLocationRow(WidgetRef ref) {
    final biz = offer.business;
    if (biz == null) return const SizedBox.shrink();
    final dist = _distanceText(ref);
    final hasDistance = dist != null;
    final locationLabel = hasDistance ? '$dist distanță' : biz.city;
    final hasLocation = locationLabel != null && locationLabel.isNotEmpty;
    final hasCategory = biz.category != null && biz.category!.isNotEmpty;
    final hasSaves = offer.saveCount != null && offer.saveCount! >= 3;

    if (!hasLocation && !hasCategory && !hasSaves) {
      return const SizedBox.shrink();
    }

    return Row(
      children: [
        if (hasLocation) ...[
          Icon(
            Icons.location_on_outlined,
            size: 12,
            color: hasDistance ? AppColors.accent : AppColors.textTertiary,
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              locationLabel,
              style: AppTypography.captionMuted.copyWith(
                color: hasDistance ? AppColors.accent : null,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (hasCategory)
            Text(' \u2022 ', style: AppTypography.captionMuted),
        ],
        if (hasCategory)
          Flexible(
            child: Text(
              biz.category!,
              style: AppTypography.captionMuted,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        if (hasSaves) ...[
          const Spacer(),
          Icon(Icons.bookmark, size: 12, color: AppColors.textTertiary),
          const SizedBox(width: 2),
          Text(
            '${offer.saveCount} salvari',
            style: AppTypography.captionMuted,
          ),
        ],
      ],
    );
  }

  // ── Shared image builder ─────────────────────────────────────

  Widget _buildImage() {
    final url = offer.displayImage;
    if (url == null || url.isEmpty) {
      return Container(
        color: AppColors.bgSecondary,
        child: const Center(
          child: Icon(Icons.local_offer_outlined,
              size: 40, color: AppColors.textTertiary),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, __) => Container(color: AppColors.bgSecondary),
      errorWidget: (_, __, ___) => Container(
        color: AppColors.bgSecondary,
        child: const Center(
          child: Icon(Icons.broken_image_outlined,
              size: 40, color: AppColors.textTertiary),
        ),
      ),
    );
  }

  /// Enhanced discount badge — larger, with glow for big discounts
  Widget _buildBadge() {
    final isBigDiscount = offer.discountValue != null &&
        offer.discountType == 'percentage' &&
        offer.discountValue! >= 30;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        gradient: isBigDiscount
            ? const LinearGradient(colors: AppColors.accentGradient)
            : null,
        color: isBigDiscount ? null : AppColors.accent,
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
        style: AppTypography.labelLarge.copyWith(
          color: AppColors.bgPrimary,
        ),
      ),
    );
  }

  /// Favorite heart icon — shown for all users, redirects to login if not authenticated
  Widget _buildFavoriteIcon(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;
    final isFav = isLoggedIn
        ? ref.watch(
            favoritesProvider.select((s) => s.favoriteIds.contains(offer.id)))
        : false;

    return Positioned(
      top: 12,
      left: 12,
      child: Semantics(
        label: isFav ? 'Elimina din favorite' : 'Adauga la favorite',
        button: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.lightImpact();
            if (!isLoggedIn) {
              GoRouter.of(context).push('/login');
              return;
            }
            ref.read(favoritesProvider.notifier).toggleFavorite(offer.id);
          },
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xB3111111),
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.border, width: 0.5),
            ),
            child: Icon(
              isFav ? Icons.favorite : Icons.favorite_border,
              size: 18,
              color: isFav ? const Color(0xFFEF4444) : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  /// Rating badge — bottom right on image, glassy dark pill with ★ rating.
  /// Only shown when business has a rating AND offer is NOT trending
  /// (trending badge takes priority at bottom-right).
  Widget _buildRatingBadge() {
    if (offer.isTrending) return const SizedBox.shrink();
    final rating = offer.business?.rating;
    if (rating == null || rating <= 0) return const SizedBox.shrink();

    return Positioned(
      bottom: 12,
      right: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: const Color(0xB3111111),
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(color: AppColors.border, width: 0.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.star_rounded, size: 12, color: AppColors.accent),
            const SizedBox(width: 3),
            Text(
              rating.toStringAsFixed(1),
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Expiry countdown pill — only visible when offer expires within 7 days.
  /// Colors: warning (3-7d), danger (<3d / <24h).
  /// Critical level (<24h) uses bold text for extra emphasis.
  Widget _buildCountdown() {
    final text = Formatters.timeLeft(offer.endDate);
    if (text == null) return const SizedBox.shrink();

    final urgency = Formatters.urgencyLevel(offer.endDate);
    // Only show countdown when ≤7 days remaining (urgency > 0)
    if (urgency == 0) return const SizedBox.shrink();

    final Color bgColor;
    final Color textColor;
    switch (urgency) {
      case 1:
        bgColor = AppColors.warning;
        textColor = AppColors.bgPrimary;
      case 2:
        bgColor = AppColors.danger;
        textColor = Colors.white;
      case 3:
      default:
        bgColor = AppColors.danger;
        textColor = Colors.white;
    }

    // Critical urgency uses bold weight for extra emphasis
    final labelStyle = urgency == 3
        ? AppTypography.labelSmall.copyWith(
            color: textColor,
            fontWeight: FontWeight.w700,
          )
        : AppTypography.labelSmall.copyWith(color: textColor);

    return Positioned(
      bottom: 12,
      left: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.schedule, size: 12, color: textColor),
            const SizedBox(width: 4),
            Text(text, style: labelStyle),
          ],
        ),
      ),
    );
  }

  /// Promoted badge — shown at top left (next to fav icon) when offer is promoted.
  Widget _buildPromotedBadge() {
    if (!offer.isPromoted) return const SizedBox.shrink();

    return Positioned(
      top: 12,
      left: 56,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: AppColors.accent.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
        ),
        child: Text(
          'PROMOVAT',
          style: TextStyle(
            color: AppColors.accent,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  /// Trending badge — shown at bottom right when offer.isTrending is true.
  Widget _buildTrendingBadge() {
    if (!offer.isTrending) return const SizedBox.shrink();

    return Positioned(
      bottom: 12,
      right: 12,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.accent,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('\u{1F525}', style: TextStyle(fontSize: 10)),
            const SizedBox(width: 3),
            Text(
              'Trending',
              style:
                  AppTypography.labelSmall.copyWith(color: AppColors.bgPrimary),
            ),
          ],
        ),
      ),
    );
  }
}
