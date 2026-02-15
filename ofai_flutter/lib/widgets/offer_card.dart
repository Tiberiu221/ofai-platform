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
import 'tap_scale.dart';

class OfferCard extends ConsumerWidget {
  final Offer offer;
  final bool horizontal;

  const OfferCard({super.key, required this.offer, this.horizontal = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (horizontal) return _buildHorizontal(context, ref);
    return _buildVertical(context, ref);
  }

  Widget _buildVertical(BuildContext context, WidgetRef ref) {
    return TapScale(
      onTap: () => context.push('/offer/${offer.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            AspectRatio(
              aspectRatio: 16 / 10,
              child: Hero(
                tag: 'offer-image-${offer.id}',
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(),
                    // Discount badge (top right)
                    if (offer.discountValue != null)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: _buildBadge(),
                      ),
                    // Favorite bookmark (top left)
                    _buildFavoriteIcon(ref),
                    // Expiry countdown (bottom left)
                    _buildCountdown(),
                  ],
                ),
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    offer.title,
                    style: AppTypography.labelLarge,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (offer.description != null && offer.description!.isNotEmpty) ...[
                    Text(
                      offer.description!,
                      style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                  if (offer.business != null) ...[
                    Text(
                      offer.business!.name,
                      style: AppTypography.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (offer.business!.rating != null && offer.business!.rating! > 0) ...[
                          Icon(Icons.star, size: 12, color: AppColors.accent),
                          const SizedBox(width: 2),
                          Text(
                            offer.business!.rating!.toStringAsFixed(1),
                            style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                        ],
                        Expanded(
                          child: Text(
                            [offer.business!.category, offer.business!.city]
                                .where((s) => s != null && s.isNotEmpty)
                                .join(' \u2022 '),
                            style: AppTypography.captionMuted,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHorizontal(BuildContext context, WidgetRef ref) {
    return TapScale(
      onTap: () => context.push('/offer/${offer.id}'),
      child: Container(
        width: 260,
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 140,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _buildImage(),
                  if (offer.discountValue != null)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: _buildBadge(),
                    ),
                  _buildFavoriteIcon(ref),
                  _buildCountdown(),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    offer.title,
                    style: AppTypography.labelLarge,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  if (offer.business != null)
                    Text(
                      offer.business!.name,
                      style: AppTypography.caption,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage() {
    final url = offer.displayImage;
    if (url == null || url.isEmpty) {
      return Container(
        color: AppColors.bgSecondary,
        child: const Center(
          child: Icon(Icons.local_offer_outlined, size: 40, color: AppColors.textTertiary),
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
          child: Icon(Icons.broken_image_outlined, size: 40, color: AppColors.textTertiary),
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

  /// Favorite bookmark icon — only shown when logged in
  Widget _buildFavoriteIcon(WidgetRef ref) {
    final auth = ref.watch(authProvider);
    if (auth.status != AuthStatus.authenticated) return const SizedBox.shrink();

    final isFav = ref.watch(favoritesProvider.select((s) => s.favoriteIds.contains(offer.id)));

    return Positioned(
      top: 8,
      left: 8,
      child: GestureDetector(
        onTap: () {
          HapticFeedback.lightImpact();
          ref.read(favoritesProvider.notifier).toggleFavorite(offer.id);
        },
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.overlay,
            shape: BoxShape.circle,
          ),
          child: Icon(
            isFav ? Icons.bookmark : Icons.bookmark_outline,
            size: 18,
            color: isFav ? AppColors.accent : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  /// Expiry countdown pill — shows "Ultima zi!", "3 zile ramase", etc.
  Widget _buildCountdown() {
    final text = Formatters.timeLeft(offer.endDate);
    if (text == null) return const SizedBox.shrink();

    final urgency = Formatters.urgencyLevel(offer.endDate);
    final bgColor = urgency >= 2 ? AppColors.danger : AppColors.warning;
    final textColor = urgency >= 2 ? Colors.white : AppColors.bgPrimary;

    return Positioned(
      bottom: 8,
      left: 8,
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
            Text(
              text,
              style: AppTypography.labelSmall.copyWith(color: textColor),
            ),
          ],
        ),
      ),
    );
  }
}
