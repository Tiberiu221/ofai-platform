import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/static_data_provider.dart';
import '../../providers/business_requests_provider.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class BusinessRequestScreen extends ConsumerStatefulWidget {
  const BusinessRequestScreen({super.key});

  @override
  ConsumerState<BusinessRequestScreen> createState() =>
      _BusinessRequestScreenState();
}

class _BusinessRequestScreenState
    extends ConsumerState<BusinessRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _websiteController = TextEditingController();
  final _descriptionController = TextEditingController();

  int? _selectedCityId;
  int? _selectedCategoryId;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _nameController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _websiteController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final success = await ref
        .read(businessRequestsProvider.notifier)
        .submitRequest(
          name: _nameController.text.trim(),
          cityId: _selectedCityId!,
          categoryId: _selectedCategoryId,
          address: _addressController.text.trim(),
          phone: _phoneController.text.trim(),
          website: _websiteController.text.trim(),
          description: _descriptionController.text.trim(),
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    final l10n = AppLocalizations.of(context)!;

    if (success) {
      showDialog(
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
            title: Text(
              l10n.bizReqSuccessTitle,
              style: AppTypography.headlineSmall,
            ),
            content: Text(
              l10n.bizReqSuccessBody,
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  context.pop();
                },
                child: Text(
                  'OK',
                  style: TextStyle(color: AppColors.accent),
                ),
              ),
            ],
          ),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.bizReqError),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final citiesAsync = ref.watch(citiesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.bizReqTitle, style: AppTypography.headlineMedium),
        backgroundColor: AppColors.bgPrimary,
        surfaceTintColor: Colors.transparent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.bizReqSubtitle,
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Name
              _buildLabel(l10n.bizReqNameLabel),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _nameController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration(l10n.bizReqNameHint),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? l10n.bizReqNameRequired : null,
                maxLength: 200,
                textInputAction: TextInputAction.next,
              ),

              const SizedBox(height: AppSpacing.lg),

              // City
              _buildLabel(l10n.bizReqCityLabel),
              const SizedBox(height: AppSpacing.xs),
              citiesAsync.when(
                data: (cities) => DropdownButtonFormField<int>(
                  value: _selectedCityId,
                  decoration: _inputDecoration(l10n.bizReqCityHint),
                  dropdownColor: AppColors.bgSecondary,
                  style: AppTypography.bodyMedium,
                  items: cities
                      .map((c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(c.name),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCityId = v),
                  validator: (v) => v == null ? l10n.bizReqCityRequired : null,
                ),
                loading: () => const LinearProgressIndicator(color: AppColors.accent),
                error: (_, __) => Text(l10n.citiesError),
              ),

              const SizedBox(height: AppSpacing.lg),

              // Category
              _buildLabel(l10n.bizReqCategoryLabel),
              const SizedBox(height: AppSpacing.xs),
              categoriesAsync.when(
                data: (categories) => DropdownButtonFormField<int>(
                  value: _selectedCategoryId,
                  decoration: _inputDecoration(l10n.bizReqCategoryHint),
                  dropdownColor: AppColors.bgSecondary,
                  style: AppTypography.bodyMedium,
                  items: categories
                      .map((c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(c.name),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCategoryId = v),
                ),
                loading: () => const LinearProgressIndicator(color: AppColors.accent),
                error: (_, __) => Text(l10n.categoriesError),
              ),

              const SizedBox(height: AppSpacing.lg),

              // Address
              _buildLabel(l10n.bizReqAddressLabel),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _addressController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration(l10n.bizReqAddressHint),
                maxLength: 500,
                textInputAction: TextInputAction.next,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Phone
              _buildLabel(l10n.bizReqPhoneLabel),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _phoneController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration(l10n.bizReqPhoneHint),
                keyboardType: TextInputType.phone,
                maxLength: 50,
                textInputAction: TextInputAction.next,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Website
              _buildLabel(l10n.bizReqWebsiteLabel),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _websiteController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration(l10n.bizReqWebsiteHint),
                keyboardType: TextInputType.url,
                maxLength: 500,
                textInputAction: TextInputAction.next,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Description
              _buildLabel(l10n.bizReqDescLabel),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _descriptionController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration(l10n.bizReqDescHint),
                maxLines: 4,
                maxLength: 2000,
              ),

              const SizedBox(height: AppSpacing.xxxl),

              // Submit
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: AppColors.bgPrimary,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(l10n.bizReqSubmit),
                ),
              ),

              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: AppTypography.labelMedium.copyWith(
        color: AppColors.textSecondary,
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
      filled: true,
      fillColor: AppColors.bgCard,
      counterStyle: TextStyle(color: AppColors.textTertiary, fontSize: 11),
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
        borderSide: BorderSide(color: AppColors.accent),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        borderSide: BorderSide(color: AppColors.danger),
      ),
    );
  }
}
