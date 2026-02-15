import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/static_data_provider.dart';
import '../../providers/business_requests_provider.dart';

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
              'Cerere trimisa!',
              style: AppTypography.headlineSmall,
            ),
            content: Text(
              'Cererea ta a fost inregistrata. O vom analiza si te vom notifica cand va fi aprobata.',
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
        const SnackBar(
          content: Text('Eroare la trimiterea cererii. Mai ai deja o cerere in asteptare?'),
          backgroundColor: AppColors.danger,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final citiesAsync = ref.watch(citiesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Adauga un business', style: AppTypography.headlineMedium),
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
                'Propune un business care nu se afla inca pe platforma.',
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Name
              _buildLabel('Numele business-ului *'),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _nameController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration('Ex: Salon Elite'),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Numele este obligatoriu' : null,
                maxLength: 200,
              ),

              const SizedBox(height: AppSpacing.lg),

              // City
              _buildLabel('Oras *'),
              const SizedBox(height: AppSpacing.xs),
              citiesAsync.when(
                data: (cities) => DropdownButtonFormField<int>(
                  value: _selectedCityId,
                  decoration: _inputDecoration('Alege orasul'),
                  dropdownColor: AppColors.bgSecondary,
                  style: AppTypography.bodyMedium,
                  items: cities
                      .map((c) => DropdownMenuItem(
                            value: c.id,
                            child: Text(c.name),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedCityId = v),
                  validator: (v) => v == null ? 'Orasul este obligatoriu' : null,
                ),
                loading: () => const LinearProgressIndicator(color: AppColors.accent),
                error: (_, __) => const Text('Eroare la incarcarea oraselor'),
              ),

              const SizedBox(height: AppSpacing.lg),

              // Category
              _buildLabel('Categorie'),
              const SizedBox(height: AppSpacing.xs),
              categoriesAsync.when(
                data: (categories) => DropdownButtonFormField<int>(
                  value: _selectedCategoryId,
                  decoration: _inputDecoration('Alege categoria'),
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
                error: (_, __) => const Text('Eroare la incarcarea categoriilor'),
              ),

              const SizedBox(height: AppSpacing.lg),

              // Address
              _buildLabel('Adresa'),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _addressController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration('Ex: Str. Victoriei 10, Cluj-Napoca'),
                maxLength: 500,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Phone
              _buildLabel('Telefon'),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _phoneController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration('Ex: 0712 345 678'),
                keyboardType: TextInputType.phone,
                maxLength: 50,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Website
              _buildLabel('Website'),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _websiteController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration('Ex: www.salonelite.ro'),
                keyboardType: TextInputType.url,
                maxLength: 500,
              ),

              const SizedBox(height: AppSpacing.lg),

              // Description
              _buildLabel('Descriere'),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                controller: _descriptionController,
                style: AppTypography.bodyMedium,
                decoration: _inputDecoration('Descrie pe scurt business-ul...'),
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
                      : const Text('Trimite cererea'),
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
