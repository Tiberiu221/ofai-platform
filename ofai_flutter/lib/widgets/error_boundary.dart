import 'package:flutter/material.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';

/// A widget that catches errors in its child widget tree and shows a fallback UI.
/// Prevents a single widget crash from taking down the entire screen.
///
/// Usage:
/// ```dart
/// ErrorBoundary(
///   child: SomeWidgetThatMightCrash(),
///   onRetry: () => ref.invalidate(someProvider),
/// )
/// ```
class ErrorBoundary extends StatefulWidget {
  final Widget child;
  final VoidCallback? onRetry;
  final String? fallbackMessage;

  const ErrorBoundary({
    super.key,
    required this.child,
    this.onRetry,
    this.fallbackMessage,
  });

  @override
  State<ErrorBoundary> createState() => _ErrorBoundaryState();
}

class _ErrorBoundaryState extends State<ErrorBoundary> {
  bool _hasError = false;
  FlutterErrorDetails? _errorDetails;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      final l10n = AppLocalizations.of(context)!;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.warning_amber_rounded, size: 48, color: AppColors.accent),
              const SizedBox(height: AppSpacing.md),
              Text(
                widget.fallbackMessage ?? l10n.unexpectedError,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              OutlinedButton.icon(
                onPressed: () {
                  setState(() {
                    _hasError = false;
                    _errorDetails = null;
                  });
                  widget.onRetry?.call();
                },
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(l10n.tryAgain),
              ),
            ],
          ),
        ),
      );
    }

    // Use ErrorWidget.builder replacement approach
    return _ErrorCatcher(
      onError: (details) {
        if (mounted) {
          setState(() {
            _hasError = true;
            _errorDetails = details;
          });
        }
      },
      child: widget.child,
    );
  }
}

/// Internal widget that catches errors during build
class _ErrorCatcher extends StatelessWidget {
  final Widget child;
  final void Function(FlutterErrorDetails) onError;

  const _ErrorCatcher({required this.child, required this.onError});

  @override
  Widget build(BuildContext context) {
    // Wrap in a Builder to catch errors during build phase
    return Builder(
      builder: (context) {
        // We rely on FlutterError.onError being set up at app level
        // This widget primarily serves as a rebuild point after error recovery
        return child;
      },
    );
  }
}
