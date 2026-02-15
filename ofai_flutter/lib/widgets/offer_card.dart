import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../models/offer.dart';
import 'tap_scale.dart';

class OfferCard extends StatelessWidget {
  final Offer offer;
  final bool horizontal;

  const OfferCard({super.key, required this.offer, this.horizontal = false});

  @override
  Widget build(BuildContext context) {
    if (horizontal) return _buildHorizontal(context);
    return _buildVertical(context);
  }

  Widget _buildVertical(BuildContext context) {
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
                    if (offer.discountValue != null)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: _buildBadge(),
                      ),
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

  Widget _buildHorizontal(BuildContext context) {
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

  Widget _buildBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
      ),
      child: Text(
        offer.discountLabel,
        style: AppTypography.labelMedium.copyWith(
          color: AppColors.bgPrimary,
        ),
      ),
    );
  }
}
