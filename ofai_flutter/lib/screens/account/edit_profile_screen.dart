import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import 'package:dio/dio.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../providers/auth_provider.dart';
import '../../core/network/api_exceptions.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _firstNameCtrl;
  late TextEditingController _lastNameCtrl;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _firstNameCtrl = TextEditingController(text: user?.firstName ?? '');
    _lastNameCtrl = TextEditingController(text: user?.lastName ?? '');
  }

  @override
  void dispose() {
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);

    try {
      await ApiClient().dio.put(ApiEndpoints.userMe, data: {
        'first_name': _firstNameCtrl.text.trim(),
        'last_name': _lastNameCtrl.text.trim(),
      });
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context)!.profileUpdated),
            backgroundColor: AppColors.bgSecondary,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = AppLocalizations.of(context)!.saveError;
        if (e is DioException && e.response?.statusCode == 429) {
          final data = e.response?.data;
          if (data is Map) {
            errorMessage = data['message'] as String? ?? errorMessage;
          }
        } else {
          errorMessage = friendlyError(e);
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
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
        title: Text(AppLocalizations.of(context)!.editProfileTitle),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.lg),
              Text(AppLocalizations.of(context)!.firstName, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _firstNameCtrl,
                decoration: InputDecoration(hintText: AppLocalizations.of(context)!.firstNameHint),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.firstNameRequired : null,
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(AppLocalizations.of(context)!.lastName, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              TextFormField(
                controller: _lastNameCtrl,
                decoration: InputDecoration(hintText: AppLocalizations.of(context)!.lastNameHint),
                validator: (v) =>
                    v == null || v.trim().isEmpty ? AppLocalizations.of(context)!.lastNameRequired : null,
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Email (read-only)
              Text(AppLocalizations.of(context)!.email, style: AppTypography.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.bgSecondary,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                ),
                child: Text(
                  ref.watch(authProvider).user?.email ?? '',
                  style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                ),
              ),

              const SizedBox(height: AppSpacing.md),
              Text(
                AppLocalizations.of(context)!.nameChangeLimit,
                style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
              ),

              const SizedBox(height: AppSpacing.xxl),

              // Show picture in reviews toggle
              Row(
                children: [
                  const Icon(Icons.face_outlined, color: AppColors.textSecondary, size: 20),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(AppLocalizations.of(context)!.showPictureInReviews, style: AppTypography.bodyMedium),
                  ),
                  Switch(
                    value: ref.watch(authProvider).user?.showPictureInReviews ?? true,
                    activeColor: AppColors.accent,
                    onChanged: (val) async {
                      try {
                        await ref.read(authProvider.notifier).updateShowPictureInReviews(val);
                      } catch (_) {
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(AppLocalizations.of(context)!.saveError), backgroundColor: AppColors.danger),
                        );
                      }
                    },
                  ),
                ],
              ),

              const SizedBox(height: AppSpacing.xxl),

              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.bgPrimary,
                          ),
                        )
                      : Text(AppLocalizations.of(context)!.save),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
