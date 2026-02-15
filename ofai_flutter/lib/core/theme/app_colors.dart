import 'dart:ui';

class AppColors {
  AppColors._();

  // Backgrounds
  static const bgPrimary = Color(0xFF06060A);
  static const bgSecondary = Color(0xFF0C0C12);
  static const bgCard = Color(0x0AFFFFFF); // rgba(255,255,255,0.04)
  static const bgCardHover = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const bgInput = Color(0x0AFFFFFF);

  // Accent
  static const accent = Color(0xFFFB923C);
  static const accentHover = Color(0xFFF97316);
  static const accentMuted = Color(0x33FB923C); // rgba(251,146,60,0.2)

  // Text
  static const textPrimary = Color(0xFFF4F4F5);
  static const textSecondary = Color(0xFFA1A1AA);
  static const textTertiary = Color(0xFF71717A);
  static const textMuted = Color(0xFF52525B);

  // Borders
  static const border = Color(0x14FFFFFF); // rgba(255,255,255,0.08)
  static const borderLight = Color(0x1FFFFFFF); // rgba(255,255,255,0.12)

  // Status
  static const danger = Color(0xFFEF4444);
  static const success = Color(0xFF22C55E);
  static const warning = Color(0xFFFBBF24);
  static const info = Color(0xFF3B82F6);

  // Gradients
  static const accentGradient = [Color(0xFFFB923C), Color(0xFFF97316)];

  // Glass
  static const bgGlass = Color(0xCC0C0C12); // bgSecondary ~80% alpha

  // Overlays
  static const overlay = Color(0x80000000); // rgba(0,0,0,0.5)
  static const overlayLight = Color(0x33000000); // rgba(0,0,0,0.2)
}
