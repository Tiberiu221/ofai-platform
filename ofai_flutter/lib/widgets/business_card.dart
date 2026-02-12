import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../models/business.dart';

class BusinessCard extends StatelessWidget {
  final Business business;

  const BusinessCard({super.key, required this.business});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/business/${business.id}'),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            // Logo
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              child: SizedBox(
                width: 56,
                height: 56,
                child: _buildLogo(),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    business.name,
                    style: AppTypography.labelLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [business.categoryName, business.cityName]
                        .where((s) => s.isNotEmpty)
                        .join(' \u2022 '),
                    style: AppTypography.captionMuted,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Row(
                    children: [
                      // Rating
                      if (business.rating != null && business.rating! > 0) ...[
                        Icon(Icons.star, size: 14, color: AppColors.accent),
                        const SizedBox(width: 2),
                        Text(
                          business.rating!.toStringAsFixed(1),
                          style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                        ),
                        if (business.ratingCount != null)
                          Text(
                            ' (${business.ratingCount})',
                            style: AppTypography.captionMuted,
                          ),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      // Offers count
                      if (business.activeOffersCount != null && business.activeOffersCount! > 0) ...[
                        Icon(Icons.local_offer_outlined, size: 12, color: AppColors.textTertiary),
                        const SizedBox(width: 2),
                        Text(
                          '${business.activeOffersCount} oferte',
                          style: AppTypography.captionMuted,
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildLogo() {
    final url = business.logoUrl;
    if (url == null || url.isEmpty) {
      return Container(
        color: AppColors.accent,
        child: Center(
          child: Text(
            business.name.isNotEmpty ? business.name[0].toUpperCase() : 'B',
            style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
          ),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, __) => Container(color: AppColors.bgSecondary),
      errorWidget: (_, __, ___) => Container(
        color: AppColors.accent,
        child: Center(
          child: Text(
            business.name.isNotEmpty ? business.name[0].toUpperCase() : 'B',
            style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
          ),
        ),
      ),
    );
  }
}
