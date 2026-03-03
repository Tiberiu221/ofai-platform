import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

/// Renders the correct badge icon based on badge_type.
///
/// Usage: `SubscriptionBadge(badgeType: business.badgeType, size: 16)`
///
/// Badge types:
/// - `null` → no badge (returns SizedBox.shrink)
/// - `'verified'` → orange checkmark (Standard tier or admin-verified)
/// - `'premium'` → purple checkmark with glow (Premium tier)
class SubscriptionBadge extends StatelessWidget {
  final String? badgeType;
  final double size;

  const SubscriptionBadge({super.key, required this.badgeType, this.size = 16});

  @override
  Widget build(BuildContext context) {
    if (badgeType == null) return const SizedBox.shrink();

    if (badgeType == 'premium') {
      return Container(
        decoration: const BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: AppColors.premiumPurpleGlow,
              blurRadius: 8,
              spreadRadius: 1,
            ),
          ],
        ),
        child: Icon(
          Icons.verified,
          color: AppColors.premiumPurple,
          size: size,
        ),
      );
    }

    // 'verified' (standard tier or admin-set)
    return Icon(
      Icons.verified,
      color: AppColors.accent,
      size: size,
    );
  }
}
