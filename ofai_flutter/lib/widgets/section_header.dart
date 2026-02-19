import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final VoidCallback? onViewAll;

  const SectionHeader({super.key, required this.title, this.onViewAll});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: AppTypography.headlineMedium),
          if (onViewAll != null)
            GestureDetector(
              onTap: onViewAll,
              child: Text(
                'Vezi toate',
                style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
              ),
            ),
        ],
      ),
    );
  }
}
