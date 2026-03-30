import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../widgets/particle_background.dart';
import '../../widgets/glass_card.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';

class ResetPasswordScreen extends StatefulWidget {
  final String email;
  final String code;

  const ResetPasswordScreen({super.key, required this.email, required this.code});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  final _pointerNotifier = ValueNotifier<Offset>(const Offset(-1000, -1000));
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    _pointerNotifier.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ApiClient().dio.post(ApiEndpoints.resetPassword, data: {
        'email': widget.email,
        'code': widget.code,
        'newPassword': _passwordController.text,
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.authResetSuccess),
            backgroundColor: AppColors.success,
          ),
        );
        context.go('/login');
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context)!.authResetError;
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Listener(
        onPointerMove: (e) => _pointerNotifier.value = e.localPosition,
        onPointerDown: (e) => _pointerNotifier.value = e.localPosition,
        onPointerUp: (_) => _pointerNotifier.value = const Offset(-1000, -1000),
        behavior: HitTestBehavior.translucent,
        child: Stack(
          children: [
            Positioned.fill(
              child: ExcludeSemantics(
                child: ParticleBackground(pointerPosition: _pointerNotifier),
              ),
            ),
            SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.huge),

                    // Back button
                    IconButton(
                      onPressed: () => context.pop(),
                      icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // Title
                    Text(AppLocalizations.of(context)!.authNewPassword, style: AppTypography.displayMedium),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AppLocalizations.of(context)!.authNewPasswordSubtitle,
                      style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // Glass card wraps form content
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Error
                          if (_error != null) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                _error!,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.danger),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Form
                          Form(
                            key: _formKey,
                            child: Column(
                              children: [
                                TextFormField(
                                  controller: _passwordController,
                                  obscureText: _obscurePassword,
                                  textInputAction: TextInputAction.next,
                                  decoration: InputDecoration(
                                    labelText: AppLocalizations.of(context)!.authNewPasswordLabel,
                                    prefixIcon: const Icon(Icons.lock_outlined, size: 20),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                        size: 20,
                                      ),
                                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                    ),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty) return AppLocalizations.of(context)!.authPasswordIsRequired;
                                    if (v.length < 8) return AppLocalizations.of(context)!.authPasswordMin8;
                                    if (!RegExp(r'\d').hasMatch(v)) return AppLocalizations.of(context)!.authPasswordNeedsDigit;
                                    return null;
                                  },
                                ),

                                const SizedBox(height: AppSpacing.lg),

                                TextFormField(
                                  controller: _confirmController,
                                  obscureText: _obscureConfirm,
                                  textInputAction: TextInputAction.done,
                                  onFieldSubmitted: (_) => _submit(),
                                  decoration: InputDecoration(
                                    labelText: AppLocalizations.of(context)!.authConfirmPassword,
                                    prefixIcon: const Icon(Icons.lock_outlined, size: 20),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _obscureConfirm ? Icons.visibility_off : Icons.visibility,
                                        size: 20,
                                      ),
                                      onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                                    ),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty) return AppLocalizations.of(context)!.authConfirmRequired;
                                    if (v != _passwordController.text) return AppLocalizations.of(context)!.authPasswordsMismatch;
                                    return null;
                                  },
                                ),

                                const SizedBox(height: AppSpacing.xxl),

                                SizedBox(
                                  width: double.infinity,
                                  height: 50,
                                  child: ElevatedButton(
                                    onPressed: _isLoading ? null : _submit,
                                    child: _isLoading
                                        ? const SizedBox(
                                            width: 20, height: 20,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary),
                                          )
                                        : Text(AppLocalizations.of(context)!.authResetButton),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
