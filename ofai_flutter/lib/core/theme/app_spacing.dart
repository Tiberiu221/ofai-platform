import 'package:flutter/material.dart';

class AppSpacing {
  AppSpacing._();

  // Base spacing scale
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 20;
  static const double xxl = 24;
  static const double xxxl = 32;
  static const double huge = 48;

  // Page padding
  static const double pagePadding = 16;

  // Card
  static const double cardPadding = 16;
  static const double cardRadius = 16;
  static const double cardRadiusSm = 12;

  // Pill / chip radius
  static const double pillRadius = 100;

  // Bottom nav height
  static const double bottomNavHeight = 72;

  // Common EdgeInsets
  static const EdgeInsets pageH = EdgeInsets.symmetric(horizontal: pagePadding);
  static const EdgeInsets pageAll = EdgeInsets.all(pagePadding);
  static const EdgeInsets cardAll = EdgeInsets.all(cardPadding);

  static EdgeInsets only({
    double left = 0,
    double top = 0,
    double right = 0,
    double bottom = 0,
  }) => EdgeInsets.only(left: left, top: top, right: right, bottom: bottom);
}
