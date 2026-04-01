import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../widgets/particle_background.dart';
import '../../widgets/glass_card.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _pointerNotifier = ValueNotifier<Offset>(const Offset(-1000, -1000));
  bool _isLoading = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _emailController.dispose();
    _pointerNotifier.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _success = null;
    });

    try {
      await ApiClient().dio.post(ApiEndpoints.forgotPassword, data: {
        'email': _emailController.text.trim(),
      });

      if (mounted) {
        setState(() {
          _success = AppLocalizations.of(context)!.authCodeSent;
          _isLoading = false;
        });

        // Navigate to verify code screen after brief delay
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) {
            context.push('/verify-code?email=${Uri.encodeComponent(_emailController.text.trim())}');
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context)!.authSendCodeError;
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
                      onPressed: () => context.canPop() ? context.pop() : context.go('/login'),
                      icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // Title
                    Text(AppLocalizations.of(context)!.authForgotTitle, style: AppTypography.displayMedium),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AppLocalizations.of(context)!.authForgotSubtitle,
                      style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // Glass card wraps form content
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Success message
                          if (_success != null) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.success.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
                              ),
                              child: Text(
                                _success!,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.success),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Error message
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
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.done,
                                  onFieldSubmitted: (_) => _submit(),
                                  decoration: InputDecoration(
                                    labelText: AppLocalizations.of(context)!.authEmail,
                                    prefixIcon: Icon(Icons.email_outlined, size: 20),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.trim().isEmpty) return AppLocalizations.of(context)!.authEmailRequired;
                                    if (!v.contains('@')) return AppLocalizations.of(context)!.authEmailInvalid;
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
                                        : Text(AppLocalizations.of(context)!.authSendCode),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: AppSpacing.xxl),

                          // Back to login
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                AppLocalizations.of(context)!.authRememberPassword,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                              ),
                              GestureDetector(
                                onTap: () => context.go('/login'),
                                child: Text(
                                  AppLocalizations.of(context)!.authLoginButton,
                                  style: AppTypography.labelLarge.copyWith(color: AppColors.accent),
                                ),
                              ),
                            ],
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
