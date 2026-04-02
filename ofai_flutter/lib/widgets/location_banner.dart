import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../core/storage/preferences.dart';
import '../providers/location_provider.dart';

/// Banner that prompts the user to enable location.
/// Hides automatically when permission is granted or the user dismisses it.
/// Dismiss state is persisted globally via [AppPreferences].
/// After granting permission, invalidates [userLocationProvider] so all
/// cards re-fetch distance automatically.
class LocationBanner extends ConsumerStatefulWidget {
  /// Called after the user grants location permission.
  final VoidCallback? onLocationGranted;

  const LocationBanner({super.key, this.onLocationGranted});

  @override
  ConsumerState<LocationBanner> createState() => _LocationBannerState();
}

class _LocationBannerState extends ConsumerState<LocationBanner> {
  bool _locationGranted = false;
  bool _dismissed = false;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final results = await Future.wait([
      _checkPermission(),
      AppPreferences.isLocationBannerDismissed(),
    ]);
    if (!mounted) return;
    setState(() {
      _locationGranted = results[0];
      _dismissed = results[1];
      _initialized = true;
    });
  }

  Future<bool> _checkPermission() async {
    try {
      final permission = await Geolocator.checkPermission();
      return permission == LocationPermission.always ||
          permission == LocationPermission.whileInUse;
    } catch (_) {
      return false;
    }
  }

  Future<void> _onActivate() async {
    try {
      final permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.deniedForever) {
        await Geolocator.openLocationSettings();
      }
    } catch (_) {
      // May throw if Info.plist keys are missing or on some devices
    }
    final granted = await _checkPermission();
    if (!mounted) return;
    if (granted) {
      setState(() => _locationGranted = true);
      // Invalidate location provider so all cards re-fetch distance
      ref.invalidate(userLocationProvider);
      widget.onLocationGranted?.call();
    }
  }

  void _onDismiss() {
    setState(() => _dismissed = true);
    AppPreferences.setLocationBannerDismissed();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized || _locationGranted || _dismissed) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.pagePadding, 0, AppSpacing.pagePadding, AppSpacing.sm,
      ),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.accent.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
          border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on_outlined, size: 20, color: AppColors.accent),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'Activeaza locatia pentru oferte din zona ta',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
            ),
            GestureDetector(
              onTap: _onActivate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                ),
                child: Text(
                  'Activeaza',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.bgPrimary),
                ),
              ),
            ),
            const SizedBox(width: 4),
            GestureDetector(
              onTap: _onDismiss,
              child: const Icon(Icons.close, size: 16, color: AppColors.textTertiary),
            ),
          ],
        ),
      ),
    );
  }
}
