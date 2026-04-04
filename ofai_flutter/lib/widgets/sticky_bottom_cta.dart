import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

/// Full-width sticky CTA button fixed at the bottom of the screen.
/// Includes safe area padding, glassmorphic background, and slide-up animation.
class StickyBottomCta extends StatefulWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final Color? backgroundColor;
  final Color? textColor;

  const StickyBottomCta({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.backgroundColor,
    this.textColor,
  });

  @override
  State<StickyBottomCta> createState() => _StickyBottomCtaState();
}

class _StickyBottomCtaState extends State<StickyBottomCta>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    ));
    // Delay slide-up slightly for polish
    Future.delayed(const Duration(milliseconds: 300), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final bg = widget.backgroundColor ?? AppColors.accent;
    final fg = widget.textColor ?? AppColors.bgPrimary;

    return SlideTransition(
      position: _slideAnimation,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.fromLTRB(
          AppSpacing.pagePadding,
          AppSpacing.md,
          AppSpacing.pagePadding,
          AppSpacing.md + bottomPadding,
        ),
        decoration: BoxDecoration(
          color: AppColors.bgPrimary.withValues(alpha: 0.92),
          border: Border(
            top: BorderSide(color: AppColors.border, width: 0.5),
          ),
        ),
        child: GestureDetector(
          onTap: widget.onTap,
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [bg, bg.withValues(alpha: 0.9)]),
              borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
              boxShadow: [
                BoxShadow(
                  color: bg.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(widget.icon, color: fg, size: 20),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  widget.label,
                  style: AppTypography.labelLarge.copyWith(
                    color: fg,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
