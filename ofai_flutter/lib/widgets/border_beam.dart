import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

/// Animated beam that travels along the border of a card.
/// Uses CustomPainter + PathMetric for 60fps GPU-accelerated rendering.
///
/// Wrap any card widget to add a subtle animated highlight:
/// ```dart
/// BorderBeam(child: FeaturedOfferCard(...))
/// ```
class BorderBeam extends StatefulWidget {
  final Widget child;
  final double borderRadius;
  final Duration duration;
  final double beamWidthFraction;
  final Color beamColor;
  final double beamThickness;

  const BorderBeam({
    super.key,
    required this.child,
    this.borderRadius = 16,
    this.duration = const Duration(seconds: 3),
    this.beamWidthFraction = 0.25,
    this.beamColor = AppColors.accent,
    this.beamThickness = 2.5,
  });

  @override
  State<BorderBeam> createState() => _BorderBeamState();
}

class _BorderBeamState extends State<BorderBeam>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: Stack(
        children: [
          widget.child,
          Positioned.fill(
            child: IgnorePointer(
              child: CustomPaint(
                painter: _BorderBeamPainter(
                  animation: _controller,
                  borderRadius: widget.borderRadius,
                  beamWidthFraction: widget.beamWidthFraction,
                  beamColor: widget.beamColor,
                  beamThickness: widget.beamThickness,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BorderBeamPainter extends CustomPainter {
  final Animation<double> animation;
  final double borderRadius;
  final double beamWidthFraction;
  final Color beamColor;
  final double beamThickness;

  _BorderBeamPainter({
    required this.animation,
    required this.borderRadius,
    required this.beamWidthFraction,
    required this.beamColor,
    required this.beamThickness,
  }) : super(repaint: animation);

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromLTRBR(
      0, 0, size.width, size.height,
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return;

    final pathMetric = metrics.first;
    final totalLength = pathMetric.length;
    final beamLength = totalLength * beamWidthFraction;

    final progress = animation.value;
    final startDist = progress * totalLength;
    final endDist = startDist + beamLength;

    // Extract beam segment (handle wrapping around path end)
    Path beamPath;
    if (endDist <= totalLength) {
      beamPath = pathMetric.extractPath(startDist, endDist);
    } else {
      // Beam wraps around — combine end segment + beginning segment
      beamPath = pathMetric.extractPath(startDist, totalLength);
      beamPath.addPath(
        pathMetric.extractPath(0, endDist - totalLength),
        Offset.zero,
      );
    }

    // Get start and end tangent positions for gradient direction
    final startTangent = pathMetric.getTangentForOffset(startDist);
    final endTangent = pathMetric.getTangentForOffset(endDist % totalLength);

    if (startTangent == null || endTangent == null) return;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = beamThickness
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..shader = ui.Gradient.linear(
        startTangent.position,
        endTangent.position,
        [
          beamColor.withValues(alpha: 0),
          beamColor.withValues(alpha: 0.8),
          beamColor.withValues(alpha: 0),
        ],
        [0.0, 0.5, 1.0],
      );

    canvas.drawPath(beamPath, paint);
  }

  @override
  bool shouldRepaint(_BorderBeamPainter oldDelegate) => true;
}
