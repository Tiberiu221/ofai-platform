import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';

/// Animated orange glow wave background matching the web auth-shader.js.
///
/// Uses [CustomPainter] to draw a sinusoidal glow line with the OFAI brand
/// orange (#FB923C). The wave approximates the GLSL 1/abs(distance) falloff
/// by drawing multiple blurred strokes at decreasing opacity.
///
/// Wrap in [Positioned.fill] inside a [Stack] for full-screen background.
class OrangeGlowWave extends StatefulWidget {
  const OrangeGlowWave({super.key});

  @override
  State<OrangeGlowWave> createState() => _OrangeGlowWaveState();
}

class _OrangeGlowWaveState extends State<OrangeGlowWave>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  double _time = 0.0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )
      ..addListener(_onTick)
      ..repeat();
  }

  void _onTick() {
    // Match web speed: 0.0025 per frame at ~60fps
    _time += 0.0025;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return CustomPaint(
            size: Size.infinite,
            painter: _GlowWavePainter(time: _time),
          );
        },
      ),
    );
  }
}

/// Glow layers: each defines a stroke width, opacity, and blur sigma.
/// Drawn from widest (outermost glow) to narrowest (bright core).
class _GlowLayer {
  final double strokeWidth;
  final double opacity;
  final double blurSigma;

  const _GlowLayer(this.strokeWidth, this.opacity, this.blurSigma);
}

class _GlowWavePainter extends CustomPainter {
  final double time;

  _GlowWavePainter({required this.time});

  // Glow layers from wide/faint to narrow/bright (approximates 1/distance)
  static const _layers = [
    _GlowLayer(80, 0.03, 30),
    _GlowLayer(50, 0.06, 20),
    _GlowLayer(28, 0.10, 12),
    _GlowLayer(14, 0.18, 6),
    _GlowLayer(6, 0.35, 3),
    _GlowLayer(2, 0.60, 1),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final minDim = math.min(w, h);

    // Shader parameters (match web auth-shader.js)
    const xScale = 1.0;
    const yScale = 0.35;

    // Build the wave path — sample every 3px for smoothness
    final path = Path();
    bool first = true;

    for (double px = 0; px <= w; px += 3) {
      // Normalized x coordinate (same as GLSL)
      final pX = (px * 2.0 - w) / minDim;

      // Wave center y in normalized coords
      final waveNorm = math.sin((pX + time) * xScale) * yScale;

      // Convert back to screen coords (y=0 in GLSL is center of screen)
      final screenY = h / 2 - waveNorm * minDim / 2;

      if (first) {
        path.moveTo(px, screenY);
        first = false;
      } else {
        path.lineTo(px, screenY);
      }
    }

    // Draw each glow layer (wide/faint first, narrow/bright last)
    for (final layer in _layers) {
      final paint = Paint()
        ..color = AppColors.accent.withValues(alpha: layer.opacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = layer.strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, layer.blurSigma);

      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _GlowWavePainter oldDelegate) => true;
}
