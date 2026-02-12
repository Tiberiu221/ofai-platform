import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTypography {
  AppTypography._();

  // Heading font — DM Serif Display (no fontWeight!)
  static TextStyle heading({
    double fontSize = 24,
    Color color = AppColors.textPrimary,
    double? height,
  }) {
    return GoogleFonts.dmSerifDisplay(
      fontSize: fontSize,
      color: color,
      height: height,
    );
  }

  // Display — large hero text
  static TextStyle get displayLarge => heading(fontSize: 36, height: 1.1);
  static TextStyle get displayMedium => heading(fontSize: 28, height: 1.2);
  static TextStyle get displaySmall => heading(fontSize: 24, height: 1.2);

  // Headings
  static TextStyle get headlineLarge => heading(fontSize: 22, height: 1.3);
  static TextStyle get headlineMedium => heading(fontSize: 20, height: 1.3);
  static TextStyle get headlineSmall => heading(fontSize: 18, height: 1.3);

  // Body — Inter
  static TextStyle body({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color color = AppColors.textPrimary,
    double? height,
  }) {
    return GoogleFonts.inter(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height ?? 1.5,
    );
  }

  static TextStyle get bodyLarge => body(fontSize: 16);
  static TextStyle get bodyMedium => body(fontSize: 14);
  static TextStyle get bodySmall => body(fontSize: 12);

  // Labels
  static TextStyle get labelLarge => body(
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );
  static TextStyle get labelMedium => body(
    fontSize: 12,
    fontWeight: FontWeight.w600,
  );
  static TextStyle get labelSmall => body(
    fontSize: 10,
    fontWeight: FontWeight.w600,
  );

  // Caption / muted
  static TextStyle get caption => body(
    fontSize: 12,
    color: AppColors.textSecondary,
  );
  static TextStyle get captionMuted => body(
    fontSize: 12,
    color: AppColors.textTertiary,
  );
}
