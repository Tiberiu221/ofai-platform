import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_exceptions.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/orange_glow_wave.dart';
import '../../widgets/glass_card.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  final String? referralCode;
  const RegisterScreen({super.key, this.referralCode});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _acceptAll = false;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  String? _error;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_acceptAll) {
      setState(() => _error = AppLocalizations.of(context)!.authAcceptTermsError);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ref.read(authProvider.notifier).register(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        referralCode: widget.referralCode,
        acceptTerms: _acceptAll,
        acceptPrivacy: _acceptAll,
      );
      if (mounted) context.go('/');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = AppLocalizations.of(context)!.authRegisterError);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _googleSignIn() async {
    setState(() {
      _isGoogleLoading = true;
      _error = null;
    });

    try {
      await ref.read(authProvider.notifier).loginWithGoogle();
      if (mounted) context.go('/');
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) setState(() => _error = AppLocalizations.of(context)!.authGoogleError);
    } finally {
      if (mounted) setState(() => _isGoogleLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Orange glow wave background (matches web auth-shader.js)
          const Positioned.fill(
            child: ExcludeSemantics(child: OrangeGlowWave()),
          ),
          SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.xxl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.xxxl),

                    // Back button
                    IconButton(
                      onPressed: () => context.canPop() ? context.pop() : context.go('/'),
                      icon: const Icon(Icons.arrow_back, color: AppColors.textPrimary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),

                    const SizedBox(height: AppSpacing.xxl),

                    // Title
                    Text(
                      AppLocalizations.of(context)!.authCreateAccount,
                      style: AppTypography.displayMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AppLocalizations.of(context)!.authRegisterSubtitle,
                      style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.textSecondary,
                      ),
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
                                Row(
                                  children: [
                                    Expanded(
                                      child: TextFormField(
                                        controller: _firstNameController,
                                        textInputAction: TextInputAction.next,
                                        decoration: InputDecoration(labelText: AppLocalizations.of(context)!.authFirstName),
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.authRequired : null,
                                      ),
                                    ),
                                    const SizedBox(width: AppSpacing.md),
                                    Expanded(
                                      child: TextFormField(
                                        controller: _lastNameController,
                                        textInputAction: TextInputAction.next,
                                        decoration: InputDecoration(labelText: AppLocalizations.of(context)!.authLastName),
                                        validator: (v) =>
                                            v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.authRequired : null,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                TextFormField(
                                  controller: _emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  decoration: InputDecoration(
                                    labelText: AppLocalizations.of(context)!.authEmail,
                                    prefixIcon: const Icon(Icons.email_outlined, size: 20),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.trim().isEmpty) return AppLocalizations.of(context)!.authEmailRequired;
                                    if (!RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(v.trim())) return AppLocalizations.of(context)!.authEmailInvalid;
                                    return null;
                                  },
                                ),
                                const SizedBox(height: AppSpacing.lg),
                                TextFormField(
                                  controller: _passwordController,
                                  obscureText: _obscurePassword,
                                  textInputAction: TextInputAction.done,
                                  decoration: InputDecoration(
                                    labelText: AppLocalizations.of(context)!.authPassword,
                                    prefixIcon: const Icon(Icons.lock_outlined, size: 20),
                                    suffixIcon: IconButton(
                                      icon: Icon(
                                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                                        size: 20,
                                      ),
                                      onPressed: () =>
                                          setState(() => _obscurePassword = !_obscurePassword),
                                    ),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty) return AppLocalizations.of(context)!.authPasswordRequired;
                                    if (v.length < 8) return AppLocalizations.of(context)!.authPasswordMin8;
                                    if (!RegExp(r'\d').hasMatch(v)) return AppLocalizations.of(context)!.authPasswordNeedsDigit;
                                    return null;
                                  },
                                ),

                                const SizedBox(height: AppSpacing.xxl),

                                // GDPR checkbox
                                GestureDetector(
                                  onTap: () => setState(() => _acceptAll = !_acceptAll),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: Checkbox(
                                          value: _acceptAll,
                                          onChanged: (v) => setState(() => _acceptAll = v ?? false),
                                          activeColor: AppColors.accent,
                                          side: const BorderSide(color: AppColors.textTertiary),
                                          shape: RoundedRectangleBorder(
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: RichText(
                                          text: TextSpan(
                                            style: AppTypography.bodySmall.copyWith(
                                              color: AppColors.textSecondary,
                                            ),
                                            children: [
                                              TextSpan(text: AppLocalizations.of(context)!.authAccept),
                                              TextSpan(
                                                text: AppLocalizations.of(context)!.authTerms,
                                                style: AppTypography.bodySmall.copyWith(
                                                  color: AppColors.accent,
                                                  decoration: TextDecoration.underline,
                                                  decorationColor: AppColors.accent,
                                                ),
                                                recognizer: TapGestureRecognizer()
                                                  ..onTap = () => context.push('/terms'),
                                              ),
                                              TextSpan(text: AppLocalizations.of(context)!.authAnd),
                                              TextSpan(
                                                text: AppLocalizations.of(context)!.authPrivacyPolicy,
                                                style: AppTypography.bodySmall.copyWith(
                                                  color: AppColors.accent,
                                                  decoration: TextDecoration.underline,
                                                  decorationColor: AppColors.accent,
                                                ),
                                                recognizer: TapGestureRecognizer()
                                                  ..onTap = () => context.push('/privacy'),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                const SizedBox(height: AppSpacing.xxl),

                                // Submit
                                SizedBox(
                                  width: double.infinity,
                                  height: 50,
                                  child: ElevatedButton(
                                    onPressed: _isLoading ? null : _submit,
                                    child: _isLoading
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: AppColors.bgPrimary,
                                            ),
                                          )
                                        : Text(AppLocalizations.of(context)!.authRegisterButton),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: AppSpacing.xl),

                          // Divider
                          Row(
                            children: [
                              const Expanded(child: Divider(color: AppColors.border)),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                                child: Text(
                                  AppLocalizations.of(context)!.authOr,
                                  style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary),
                                ),
                              ),
                              const Expanded(child: Divider(color: AppColors.border)),
                            ],
                          ),

                          const SizedBox(height: AppSpacing.xl),

                          // Google Sign-In
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: OutlinedButton.icon(
                              onPressed: (_isLoading || _isGoogleLoading) ? null : _googleSignIn,
                              icon: _isGoogleLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.textPrimary),
                                    )
                                  : const Icon(Icons.g_mobiledata, size: 24),
                              label: Text(AppLocalizations.of(context)!.authContinueGoogle),
                            ),
                          ),

                          const SizedBox(height: AppSpacing.xxl),

                          // Login link
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                AppLocalizations.of(context)!.authHasAccount,
                                style: AppTypography.bodyMedium.copyWith(
                                  color: AppColors.textSecondary,
                                ),
                              ),
                              GestureDetector(
                                onTap: () => context.push('/login'),
                                child: Text(
                                  AppLocalizations.of(context)!.authLoginButton,
                                  style: AppTypography.labelLarge.copyWith(
                                    color: AppColors.accent,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: AppSpacing.xxl),
                  ],
                ),
              ),
            ),
          ],
        ),
    );
  }
}

