import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import 'fullscreen_gallery.dart';

/// Bolt-style masonry gallery: 1 large image left + 2 small stacked right.
/// Shows "Foto (N) — Toate >" header with tap to open fullscreen gallery.
class MasonryGallery extends StatelessWidget {
  final List<String> imageUrls;
  final String? headerLabel;
  final VoidCallback? onSeeAll;

  const MasonryGallery({
    super.key,
    required this.imageUrls,
    this.headerLabel,
    this.onSeeAll,
  });

  @override
  Widget build(BuildContext context) {
    if (imageUrls.isEmpty) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header: "Foto (N) — Toate >"
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Row(
            children: [
              Text(
                headerLabel ?? 'Foto (${imageUrls.length})',
                style: AppTypography.labelMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const Spacer(),
              if (imageUrls.length > 3)
                GestureDetector(
                  onTap: onSeeAll ?? () => _openGallery(context, 0),
                  child: Text(
                    'Toate >',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.accent,
                    ),
                  ),
                ),
            ],
          ),
        ),
        // Masonry layout
        SizedBox(
          height: 220,
          child: _buildMasonry(context),
        ),
      ],
    );
  }

  Widget _buildMasonry(BuildContext context) {
    if (imageUrls.length == 1) {
      return _buildImage(context, 0, borderRadius: AppSpacing.cardRadiusSm);
    }

    if (imageUrls.length == 2) {
      return Row(
        children: [
          Expanded(child: _buildImage(context, 0, borderRadius: AppSpacing.cardRadiusSm)),
          const SizedBox(width: AppSpacing.sm),
          Expanded(child: _buildImage(context, 1, borderRadius: AppSpacing.cardRadiusSm)),
        ],
      );
    }

    // 3+ images: 1 large left (60%) + 2 small right (40%)
    return Row(
      children: [
        Expanded(
          flex: 6,
          child: _buildImage(
            context,
            0,
            borderRadius: AppSpacing.cardRadiusSm,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          flex: 4,
          child: Column(
            children: [
              Expanded(
                child: _buildImage(
                  context,
                  1,
                  borderRadius: AppSpacing.cardRadiusSm,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildImage(
                      context,
                      2,
                      borderRadius: AppSpacing.cardRadiusSm,
                    ),
                    // Overlay "+N" if more than 3 images
                    if (imageUrls.length > 3)
                      GestureDetector(
                        onTap: () => _openGallery(context, 2),
                        child: Container(
                          decoration: BoxDecoration(
                            color: AppColors.overlay,
                            borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '+${imageUrls.length - 3}',
                            style: AppTypography.headlineSmall.copyWith(
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildImage(BuildContext context, int index, {double borderRadius = 12}) {
    return GestureDetector(
      onTap: () => _openGallery(context, index),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: CachedNetworkImage(
          imageUrl: imageUrls[index],
          fit: BoxFit.cover,
          memCacheWidth: 600,
          width: double.infinity,
          height: double.infinity,
          placeholder: (_, __) => Container(
            color: AppColors.bgSecondary,
            child: const Center(
              child: Icon(Icons.image_outlined, color: AppColors.textTertiary, size: 32),
            ),
          ),
          errorWidget: (_, __, ___) => Container(
            color: AppColors.bgSecondary,
            child: const Center(
              child: Icon(Icons.broken_image_outlined, color: AppColors.textTertiary, size: 32),
            ),
          ),
        ),
      ),
    );
  }

  void _openGallery(BuildContext context, int index) {
    FullscreenGallery.open(context, imageUrls, initialIndex: index);
  }
}
