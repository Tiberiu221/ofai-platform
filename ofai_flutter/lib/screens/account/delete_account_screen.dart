import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../core/storage/secure_storage.dart';
import '../../core/network/api_exceptions.dart';
import '../../providers/auth_provider.dart';

class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});

  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends ConsumerState<DeleteAccountScreen> {
  final _passwordCtrl = TextEditingController();
  bool _isSubmitting = false;
  bool _obscure = true;

  @override
  void dispose() {
    _passwordCtrl.dispose();
    super.dispose();
  }

  bool get _needsPassword {
    final user = ref.read(authProvider).user;
    return user?.hasPassword ?? true;
  }

  Future<void> _deleteAccount() async {
    if (_needsPassword && _passwordCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizations.of(context)!.passwordRequiredForDelete),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      barrierColor: AppColors.overlay,
      builder: (ctx) => BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: AlertDialog(
          backgroundColor: AppColors.bgGlass,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            side: const BorderSide(color: AppColors.borderLight, width: 0.5),
          ),
          title: Text(AppLocalizations.of(context)!.confirmDeleteTitle),
          content: Text(
            AppLocalizations.of(context)!.confirmDeleteBody,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(AppLocalizations.of(context)!.cancelAction),
            ),
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(AppLocalizations.of(context)!.deleteAccountAction, style: TextStyle(color: AppColors.danger)),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;

    setState(() => _isSubmitting = true);

    try {
      await ApiClient().dio.delete(ApiEndpoints.userDelete, data: {
        'password': _needsPassword ? _passwordCtrl.text : 'google-oauth-delete',
      });
      await SecureStorage.clearAll();
      if (mounted) {
        await ref.read(authProvider.notifier).logout();
        if (mounted) context.go('/');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Eroare: ${friendlyError(e)}'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.deleteAccountTitle),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.lg),

            // Warning banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.warning_amber_rounded, color: AppColors.danger, size: 48),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    AppLocalizations.of(context)!.deleteWarning,
                    style: AppTypography.headlineSmall.copyWith(color: AppColors.danger),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    AppLocalizations.of(context)!.deleteWarningBody,
                    style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.xxl),

            // What gets deleted
            _DeleteItem(AppLocalizations.of(context)!.deleteItem1),
            _DeleteItem(AppLocalizations.of(context)!.deleteItem2),
            _DeleteItem(AppLocalizations.of(context)!.deleteItem3),
            _DeleteItem(AppLocalizations.of(context)!.deleteItem4),
            _DeleteItem(AppLocalizations.of(context)!.deleteItem5),

            const SizedBox(height: AppSpacing.xxxl),

            // Password confirmation (or Google info)
            if (_needsPassword) ...[
              Text(AppLocalizations.of(context)!.confirmWithPassword, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _passwordCtrl,
                obscureText: _obscure,
                decoration: InputDecoration(
                  hintText: AppLocalizations.of(context)!.enterAccountPassword,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_off : Icons.visibility,
                      color: AppColors.textTertiary,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
              ),
            ] else ...[
              Text(
                AppLocalizations.of(context)!.googleDeleteInfo,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              ),
            ],

            const SizedBox(height: AppSpacing.xxxl),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _deleteAccount,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.danger,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(AppLocalizations.of(context)!.deleteAccountButton),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeleteItem extends StatelessWidget {
  final String text;
  const _DeleteItem(this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        children: [
          Icon(Icons.remove_circle_outline, size: 18, color: AppColors.danger),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(text, style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary)),
          ),
        ],
      ),
    );
  }
}
