import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

/// Data for a single step in the stepper.
class StepData {
  final IconData icon;
  final String title;
  final String subtitle;

  const StepData({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
}

/// Bolt-style vertical stepper with numbered circles, connecting lines,
/// and icon + text per step. Used in "How to use" sections.
class StepperHowTo extends StatelessWidget {
  final List<StepData> steps;
  final String? title;

  const StepperHowTo({
    super.key,
    required this.steps,
    this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null) ...[
          Text(title!, style: AppTypography.headlineSmall),
          const SizedBox(height: AppSpacing.lg),
        ],
        ...List.generate(steps.length, (i) => _buildStep(i)),
      ],
    );
  }

  Widget _buildStep(int index) {
    final step = steps[index];
    final isLast = index == steps.length - 1;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: numbered circle + connecting line
          SizedBox(
            width: 36,
            child: Column(
              children: [
                // Numbered circle
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${index + 1}',
                    style: AppTypography.labelMedium.copyWith(
                      color: AppColors.bgPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                // Connecting line (except for last step)
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accent.withValues(alpha: 0.3),
                        borderRadius: BorderRadius.circular(1),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          // Right: icon + title + subtitle
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : AppSpacing.lg),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppSpacing.sm),
                    ),
                    child: Icon(step.icon, color: AppColors.accent, size: 20),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          step.title,
                          style: AppTypography.labelMedium.copyWith(
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          step.subtitle,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textTertiary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
