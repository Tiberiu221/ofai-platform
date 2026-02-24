import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../core/utils/formatters.dart';
import '../models/offer.dart';

class FeaturedOfferCard extends StatelessWidget {
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

  @override
  Widget build(BuildContext context) {
    final heroImage = offer.displayImage;
    final timeLeft = Formatters.timeLeft(offer.endDate);
    final urgency = Formatters.urgencyLevel(offer.endDate);
    final urgencyColor = _urgencyColor(urgency);

    return GestureDetector(
      onTap: () => context.push('/offer/${offer.id}'),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.bgCard,
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
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          clipBehavior: Clip.hardEdge,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image section with gradient overlay
              SizedBox(
                height: 200,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Background image
                    heroImage != null && heroImage.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: heroImage,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(color: AppColors.bgSecondary),
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

                    // Gradient overlay — bottom fade for text legibility
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [Colors.transparent, Color(0xDD060608)],
                          stops: [0.3, 1.0],
                        ),
                      ),
                    ),

                    // "Oferta Zilei" badge — top left
                    Positioned(
                      top: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
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
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.star, size: 12, color: AppColors.bgPrimary),
                            const SizedBox(width: 4),
                            Text(
                              'Oferta Zilei',
                              style: AppTypography.labelSmall.copyWith(
                                color: AppColors.bgPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Discount badge — top right
                    if (offer.discountValue != null)
                      Positioned(
                        top: 12,
                        right: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: AppColors.bgPrimary,
                            borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                            border: Border.all(
                              color: AppColors.accent.withValues(alpha: 0.5),
                            ),
                          ),
                          child: Text(
                            offer.discountLabel,
                            style: AppTypography.labelMedium.copyWith(
                              color: AppColors.accent,
                            ),
                          ),
                        ),
                      ),

                    // Title + business name — bottom of image over gradient
                    Positioned(
                      bottom: 12,
                      left: 12,
                      right: 12,
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
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                if (offer.business!.isVerified) ...[
                                  Icon(Icons.verified, size: 13, color: AppColors.accent),
                                  const SizedBox(width: 3),
                                ],
                                Flexible(
                                  child: Text(
                                    offer.business!.name,
                                    style: AppTypography.caption,
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

              // Below image: description + countdown
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Description preview
                    if (offer.description != null && offer.description!.isNotEmpty) ...[
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

                    // Countdown row — only show within 7 days (urgency > 0)
                    if (timeLeft != null && urgency > 0)
                      Row(
                        children: [
                          Icon(
                            urgency >= 2 ? Icons.timer : Icons.calendar_today,
                            size: 14,
                            color: urgencyColor,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            timeLeft,
                            style: AppTypography.labelSmall.copyWith(
                              color: urgencyColor,
                            ),
                          ),
                          const Spacer(),
                          // "Vezi oferta" hint
                          Text(
                            'Vezi oferta',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.accent,
                            ),
                          ),
                          const SizedBox(width: 2),
                          const Icon(
                            Icons.arrow_forward,
                            size: 12,
                            color: AppColors.accent,
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
