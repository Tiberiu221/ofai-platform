import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';

class InitialAvatar extends StatelessWidget {
  final String initials;
  final double radius;
  final Color? backgroundColor;
  final TextStyle? textStyle;

  const InitialAvatar({
    super.key,
    required this.initials,
    this.radius = 18,
    this.backgroundColor,
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radius,
      backgroundColor: backgroundColor ?? AppColors.bgSecondary,
      child: Text(
        initials,
        style: textStyle ?? AppTypography.labelMedium.copyWith(
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}
