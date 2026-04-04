import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

/// Clean icon + label + value row for venue/business details.
/// Used in Contact and Details tabs (Bolt-style venue info rows).
class VenueDetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final Widget? trailing;
  final Color? iconColor;
  final bool showDivider;

  const VenueDetailRow({
    super.key,
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.trailing,
    this.iconColor,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: (iconColor ?? AppColors.accent).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppSpacing.sm),
            ),
            child: Icon(
              icon,
              size: 18,
              color: iconColor ?? AppColors.accent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTypography.bodySmall.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
                if (value != null && value!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    value!,
                    style: AppTypography.bodyMedium.copyWith(
                      color: onTap != null ? AppColors.accent : AppColors.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
          if (onTap != null && trailing == null)
            Icon(
              Icons.chevron_right,
              size: 20,
              color: AppColors.textTertiary,
            ),
        ],
      ),
    );

    final widget = onTap != null
        ? GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque, child: content)
        : content;

    if (!showDivider) return widget;

    return Column(
      children: [
        widget,
        Divider(height: 1, color: AppColors.border),
      ],
    );
  }
}
