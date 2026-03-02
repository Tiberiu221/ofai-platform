import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// Animated particle background matching web's canvas particle system.
/// Uses [CustomPainter] with [RepaintBoundary] for GPU-isolated rendering.
///
/// Touch/pointer interaction is handled via [pointerPosition] ValueNotifier
/// passed from the parent — this avoids gesture arena conflicts with form inputs.
class ParticleBackground extends StatefulWidget {
  final int particleCount;
  final Color color;
  final ValueNotifier<Offset>? pointerPosition;

  const ParticleBackground({
    super.key,
    this.particleCount = 40,
    this.color = AppColors.accent,
    this.pointerPosition,
  });

  @override
  State<ParticleBackground> createState() => _ParticleBackgroundState();
}

class _ParticleBackgroundState extends State<ParticleBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  final List<_Particle> _particles = [];
  Size _canvasSize = Size.zero;
  final math.Random _rng = math.Random();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..addListener(_tick);
    _controller.repeat();
  }

  void _initParticles(Size size) {
    if (size == _canvasSize && _particles.isNotEmpty) return;
    _canvasSize = size;
    _particles.clear();
    for (int i = 0; i < widget.particleCount; i++) {
      _particles.add(_Particle(
        x: _rng.nextDouble() * size.width,
        y: _rng.nextDouble() * size.height,
        vx: (_rng.nextDouble() - 0.5) * 0.3,
        vy: (_rng.nextDouble() - 0.5) * 0.3,
        radius: 1.0 + _rng.nextDouble() * 1.5,
        opacity: 0.15 + _rng.nextDouble() * 0.2,
      ));
    }
  }

  void _tick() {
    final pointer = widget.pointerPosition?.value ?? const Offset(-1000, -1000);
    final w = _canvasSize.width;
    final h = _canvasSize.height;

    for (final p in _particles) {
      // Touch/pointer attraction (matches web: 200px radius)
      final dx = pointer.dx - p.x;
      final dy = pointer.dy - p.y;
      final dist = math.sqrt(dx * dx + dy * dy);
      if (dist < 200 && dist > 1) {
        final force = 0.3 / dist;
        p.vx += dx * force * 0.01;
        p.vy += dy * force * 0.01;
      }

      // Damping (matches web: 0.99)
      p.vx *= 0.99;
      p.vy *= 0.99;

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // Edge wrapping (matches web: -10 to size+10)
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _initParticles(Size(constraints.maxWidth, constraints.maxHeight));
        return RepaintBoundary(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                size: Size(constraints.maxWidth, constraints.maxHeight),
                painter: _ParticlePainter(
                  particles: _particles,
                  color: widget.color,
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _Particle {
  double x, y;
  double vx, vy;
  double radius;
  double opacity;

  _Particle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.radius,
    required this.opacity,
  });
}

class _ParticlePainter extends CustomPainter {
  final List<_Particle> particles;
  final Color color;

  _ParticlePainter({required this.particles, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in particles) {
      paint.color = color.withValues(alpha: p.opacity);
      canvas.drawCircle(Offset(p.x, p.y), p.radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ParticlePainter oldDelegate) => true;
}
