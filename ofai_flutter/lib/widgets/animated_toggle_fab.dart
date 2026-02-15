import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

/// A floating action button with bounce animation on toggle.
/// Used for favorite (offers) and subscribe (businesses) actions.
class AnimatedToggleFab extends StatefulWidget {
  final bool isActive;
  final VoidCallback onTap;
  final IconData activeIcon;
  final IconData inactiveIcon;
  final String? activeLabel;
  final String? inactiveLabel;

  const AnimatedToggleFab({
    super.key,
    required this.isActive,
    required this.onTap,
    required this.activeIcon,
    required this.inactiveIcon,
    this.activeLabel,
    this.inactiveLabel,
  });

  @override
  State<AnimatedToggleFab> createState() => _AnimatedToggleFabState();
}

class _AnimatedToggleFabState extends State<AnimatedToggleFab>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 350),
      vsync: this,
    );
    _scaleAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.25), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.25, end: 0.9), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 0.9, end: 1.0), weight: 40),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
  }

  @override
  void didUpdateWidget(AnimatedToggleFab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isActive != widget.isActive) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final icon = widget.isActive ? widget.activeIcon : widget.inactiveIcon;
    final label = widget.isActive
        ? (widget.activeLabel ?? '')
        : (widget.inactiveLabel ?? '');

    return ScaleTransition(
      scale: _scaleAnimation,
      child: FloatingActionButton.extended(
        onPressed: () {
          HapticFeedback.mediumImpact();
          widget.onTap();
        },
        backgroundColor: widget.isActive ? AppColors.accent : AppColors.bgCard,
        foregroundColor: widget.isActive ? AppColors.bgPrimary : AppColors.textPrimary,
        icon: Icon(icon, size: 20),
        label: Text(
          label,
          style: AppTypography.labelMedium.copyWith(
            color: widget.isActive ? AppColors.bgPrimary : AppColors.textPrimary,
          ),
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          side: widget.isActive
              ? BorderSide.none
              : const BorderSide(color: AppColors.border),
        ),
      ),
    );
  }
}
