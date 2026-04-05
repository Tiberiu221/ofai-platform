import 'dart:ui';
import 'package:flutter/material.dart';

/// Modern 2026 entrance animation: content transitions from blurry to sharp
/// with simultaneous opacity fade and subtle slide-up.
///
/// Drop-in replacement for FadeInItem with blur enhancement.
/// Uses [ImageFiltered] (not BackdropFilter) for Impeller-safe performance.
class BlurFade extends StatefulWidget {
  final Widget child;
  final Duration duration;
  final Curve curve;
  final Offset slideOffset;
  final double maxBlurSigma;
  final int delayMs;

  const BlurFade({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 400),
    this.curve = Curves.easeOut,
    this.slideOffset = const Offset(0, 0.04),
    this.maxBlurSigma = 10.0,
    this.delayMs = 0,
  });

  @override
  State<BlurFade> createState() => _BlurFadeState();
}

class _BlurFadeState extends State<BlurFade>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;
  late final Animation<double> _blur;
  late final Animation<Offset> _slide;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );

    final curved = CurvedAnimation(parent: _controller, curve: widget.curve);

    _opacity = Tween<double>(begin: 0, end: 1).animate(curved);
    _blur = Tween<double>(begin: widget.maxBlurSigma, end: 0).animate(curved);
    _slide = Tween<Offset>(
      begin: widget.slideOffset,
      end: Offset.zero,
    ).animate(curved);

    if (widget.delayMs > 0) {
      Future.delayed(Duration(milliseconds: widget.delayMs), () {
        if (mounted) {
          _started = true;
          _controller.forward();
        }
      });
    } else {
      _started = true;
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Before animation starts, render invisible to reserve space
    if (!_started && widget.delayMs > 0) {
      return Opacity(opacity: 0, child: widget.child);
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final sigma = _blur.value;
        return FadeTransition(
          opacity: _opacity,
          child: SlideTransition(
            position: _slide,
            // Skip ImageFiltered when blur is 0 (animation complete) for performance
            child: sigma < 0.5
                ? child!
                : ImageFiltered(
                    imageFilter: ImageFilter.blur(
                      sigmaX: sigma,
                      sigmaY: sigma,
                      tileMode: TileMode.decal,
                    ),
                    child: child,
                  ),
          ),
        );
      },
      child: widget.child,
    );
  }
}
