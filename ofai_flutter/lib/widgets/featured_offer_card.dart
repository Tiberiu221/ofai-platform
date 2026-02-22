import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/offer.dart';
import '../core/theme/app_colors.dart';

class FeaturedOfferCard extends StatelessWidget {
  final Offer offer;
  final VoidCallback? onTap;

  const FeaturedOfferCard({super.key, required this.offer, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 280,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.25)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background image
            if (offer.imageUrl != null)
              CachedNetworkImage(
                imageUrl: offer.imageUrl!,
                fit: BoxFit.cover,
                errorWidget: (_, __, ___) => Container(color: AppColors.bgSecondary),
              )
            else
              Container(
                color: AppColors.bgSecondary,
                child: Center(
                  child: Text(
                    offer.business?.name.isNotEmpty == true
                        ? offer.business!.name.substring(0, 1).toUpperCase()
                        : 'O',
                    style: TextStyle(
                      fontSize: 64,
                      color: AppColors.accent.withValues(alpha: 0.3),
                    ),
                  ),
                ),
              ),

            // Gradient overlay
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.85),
                  ],
                  stops: const [0.3, 1.0],
                ),
              ),
            ),

            // "OFERTA ZILEI" label — top left
            Positioned(
              top: 12,
              left: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFF97316), Color(0xFFFB923C)],
                  ),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'OFERTA ZILEI',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),

            // Discount badge — top right
            if (offer.discountValue != null)
              Positioned(
                top: 12,
                right: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(6),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accent.withValues(alpha: 0.3),
                        blurRadius: 12,
                      ),
                    ],
                  ),
                  child: Text(
                    offer.discountType == 'percentage' || offer.discountType == 'percent'
                        ? '-${offer.discountValue!.toInt()}%'
                        : '-${offer.discountValue!.toInt()} lei',
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),

            // Content overlay — bottom
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (offer.business != null)
                    Text(
                      offer.business!.name,
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                  const SizedBox(height: 4),
                  Text(
                    offer.title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (offer.saveCount >= 5) ...[
                        const Icon(Icons.bookmark, size: 14, color: AppColors.accent),
                        const SizedBox(width: 4),
                        Text(
                          '${offer.saveCount} salvari',
                          style: const TextStyle(color: AppColors.accent, fontSize: 12),
                        ),
                        const SizedBox(width: 12),
                      ],
                      if (offer.business?.city != null) ...[
                        const Icon(
                          Icons.location_on_outlined,
                          size: 14,
                          color: AppColors.textTertiary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          offer.business!.city!,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
