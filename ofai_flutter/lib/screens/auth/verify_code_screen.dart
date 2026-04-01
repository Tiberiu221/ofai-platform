import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../widgets/particle_background.dart';
import '../../widgets/glass_card.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class VerifyCodeScreen extends StatefulWidget {
  final String email;

  const VerifyCodeScreen({super.key, required this.email});

  @override
  State<VerifyCodeScreen> createState() => _VerifyCodeScreenState();
}

class _VerifyCodeScreenState extends State<VerifyCodeScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  final _pointerNotifier = ValueNotifier<Offset>(const Offset(-1000, -1000));
  bool _isLoading = false;
  bool _isResending = false;
  String? _error;
  Timer? _timer;
  int _secondsLeft = 900; // 15 minutes

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    _pointerNotifier.dispose();
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _secondsLeft = 900;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft > 0) {
        setState(() => _secondsLeft--);
      } else {
        t.cancel();
      }
    });
  }

  String get _timerText {
    final min = _secondsLeft ~/ 60;
    final sec = _secondsLeft % 60;
    return '${min.toString().padLeft(2, '0')}:${sec.toString().padLeft(2, '0')}';
  }

  String get _code => _controllers.map((c) => c.text).join();

  void _onDigitChanged(int index, String value) {
    if (value.length == 1 && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }

    // Handle paste (if all 6 digits pasted into first field)
    if (value.length == 6 && index == 0) {
      for (int i = 0; i < 6; i++) {
        _controllers[i].text = value[i];
      }
      _focusNodes[5].requestFocus();
      return;
    }

    // Auto-submit when all filled
    if (_code.length == 6) {
      _verify();
    }
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _controllers[index - 1].clear();
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _verify() async {
    final code = _code;
    if (code.length != 6) {
      setState(() => _error = AppLocalizations.of(context)!.authEnterAllDigits);
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      await ApiClient().dio.post(ApiEndpoints.verifyResetCode, data: {
        'email': widget.email,
        'code': code,
      });

      if (mounted) {
        context.push('/reset-password?email=${Uri.encodeComponent(widget.email)}&code=$code');
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context)!.authInvalidCode;
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _resend() async {
    setState(() {
      _isResending = true;
      _error = null;
    });

    try {
      await ApiClient().dio.post(ApiEndpoints.forgotPassword, data: {
        'email': widget.email,
      });

      if (mounted) {
        _startTimer();
        for (final c in _controllers) {
          c.clear();
        }
        _focusNodes[0].requestFocus();
        setState(() => _isResending = false);

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.authNewCodeSent),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = AppLocalizations.of(context)!.authResendError;
          _isResending = false;
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
                    Text(AppLocalizations.of(context)!.authVerifyTitle, style: AppTypography.displayMedium),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AppLocalizations.of(context)!.authCodeSentTo(widget.email),
                      style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary),
                    ),

                    const SizedBox(height: AppSpacing.xxxl),

                    // Glass card wraps form content
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Timer
                          Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: _secondsLeft > 0
                                    ? AppColors.bgSecondary
                                    : AppColors.danger.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.timer_outlined,
                                    size: 16,
                                    color: _secondsLeft > 0 ? AppColors.textSecondary : AppColors.danger,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    _secondsLeft > 0 ? AppLocalizations.of(context)!.authExpiresIn(_timerText) : AppLocalizations.of(context)!.authCodeExpired,
                                    style: AppTypography.labelMedium.copyWith(
                                      color: _secondsLeft > 0 ? AppColors.textSecondary : AppColors.danger,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: AppSpacing.xxl),

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

                          // 6 digit inputs
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: List.generate(6, (i) => SizedBox(
                              width: 48,
                              height: 56,
                              child: KeyboardListener(
                                focusNode: FocusNode(),
                                onKeyEvent: (event) => _onKeyEvent(i, event),
                                child: TextField(
                                  controller: _controllers[i],
                                  focusNode: _focusNodes[i],
                                  textAlign: TextAlign.center,
                                  keyboardType: TextInputType.number,
                                  maxLength: i == 0 ? 6 : 1,
                                  style: AppTypography.headlineMedium,
                                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                                  decoration: InputDecoration(
                                    counterText: '',
                                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                                    filled: true,
                                    fillColor: AppColors.bgCard,
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                      borderSide: BorderSide(color: AppColors.border),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                      borderSide: BorderSide(color: AppColors.border),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                      borderSide: BorderSide(color: AppColors.accent, width: 2),
                                    ),
                                  ),
                                  onChanged: (v) => _onDigitChanged(i, v),
                                ),
                              ),
                            )),
                          ),

                          const SizedBox(height: AppSpacing.xxl),

                          // Verify button
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _verify,
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 20, height: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary),
                                    )
                                  : Text(AppLocalizations.of(context)!.authVerifyButton),
                            ),
                          ),

                          const SizedBox(height: AppSpacing.xxl),

                          // Resend
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                AppLocalizations.of(context)!.authNoCode,
                                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                              ),
                              GestureDetector(
                                onTap: _isResending ? null : _resend,
                                child: Text(
                                  _isResending ? AppLocalizations.of(context)!.authResending : AppLocalizations.of(context)!.authResend,
                                  style: AppTypography.labelLarge.copyWith(
                                    color: _isResending ? AppColors.textTertiary : AppColors.accent,
                                  ),
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
