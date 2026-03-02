import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../core/theme/app_spacing.dart';

/// Glassmorphic card container with backdrop blur.
/// Matches web's auth-card styling: semi-transparent dark bg + blur + subtle border.
class GlassCard extends StatelessWidget {
  final Widget child;
  final double blurSigma;
  final double borderRadius;
  final EdgeInsets padding;

  const GlassCard({
    super.key,
    required this.child,
    this.blurSigma = 16,
    this.borderRadius = AppSpacing.cardRadius,
    this.padding = const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
        child: Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            color: AppColors.bgGlass,
            borderRadius: BorderRadius.circular(borderRadius),
            border: Border.all(
              color: AppColors.borderLight,
              width: 0.5,
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}
