import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../core/utils/formatters.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/review.dart';
import 'initial_avatar.dart';

class ReviewCard extends StatelessWidget {
  final Review review;
  final VoidCallback? onDelete;

  const ReviewCard({
    super.key,
    required this.review,
    this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final date = review.createdAt != null ? DateTime.tryParse(review.createdAt!) : null;

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
          // Header: avatar + name + date + delete
          Row(
            children: [
              if (review.reviewerProfilePictureUrl != null && review.reviewerShowPicture)
                CircleAvatar(
                  radius: 18,
                  backgroundImage: CachedNetworkImageProvider(review.reviewerProfilePictureUrl!),
                  backgroundColor: AppColors.bgSecondary,
                )
              else
                InitialAvatar(initials: review.reviewerInitials),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(child: Text(review.reviewerName, style: AppTypography.labelMedium)),
                        if (review.displayBadgeColor != null) ...[
                          const SizedBox(width: 4),
                          Tooltip(
                            message: review.displayBadgeName ?? '',
                            child: Icon(Icons.star, size: 14, color: _parseHexColor(review.displayBadgeColor!)),
                          ),
                        ],
                      ],
                    ),
                    if (date != null)
                      Text(
                        Formatters.timeAgo(date),
                        style: AppTypography.captionMuted,
                      ),
                  ],
                ),
              ),
              // Delete button — visible only for own reviews
              if (review.isOwn && onDelete != null)
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18),
                  color: AppColors.danger,
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                  tooltip: AppLocalizations.of(context)!.delete,
                  onPressed: onDelete,
                ),
            ],
          ),

          const SizedBox(height: AppSpacing.sm),

          // Stars
          Row(
            children: List.generate(5, (i) => Icon(
              i < review.rating ? Icons.star : Icons.star_border,
              size: 16,
              color: i < review.rating ? AppColors.accent : AppColors.textTertiary,
            )),
          ),

          // Comment
          if (review.comment != null && review.comment!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              review.comment!,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
          ],

          // Business response
          if (review.response != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: AppColors.bgSecondary,
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(AppLocalizations.of(context)!.businessResponse, style: AppTypography.labelSmall.copyWith(color: AppColors.accent)),
                  const SizedBox(height: 4),
                  Text(
                    review.response!.text,
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _parseHexColor(String hex) {
    final clean = hex.replaceAll('#', '');
    if (clean.length == 6) return Color(int.parse('FF$clean', radix: 16));
    return AppColors.accent;
  }
}
