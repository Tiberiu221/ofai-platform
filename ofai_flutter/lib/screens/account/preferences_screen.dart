import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../providers/auth_provider.dart';
import '../../providers/static_data_provider.dart';

class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  int? _selectedCityId;
  Set<int> _selectedCategoryIds = {};
  bool _isSubmitting = false;
  bool _didInit = false;

  void _initFromUser() {
    if (_didInit) return;
    _didInit = true;
    final user = ref.read(authProvider).user;
    _selectedCityId = user?.preferredCityId;
    _selectedCategoryIds = Set<int>.from(user?.preferredCategoryIds ?? []);
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await ApiClient().dio.put(ApiEndpoints.userPreferences, data: {
        'preferred_city_id': _selectedCityId,
        'preferred_category_ids': _selectedCategoryIds.toList(),
      });
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Preferințe actualizate'),
            backgroundColor: AppColors.bgSecondary,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Eroare: ${e.toString().split(':').last.trim()}'),
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
    _initFromUser();
    final citiesAsync = ref.watch(citiesProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Preferințe'),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: AppSpacing.lg),

            // City selector
            Text('Orașul preferat', style: AppTypography.headlineSmall),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Vom prioritiza ofertele din acest oraș',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),

            citiesAsync.when(
              data: (cities) => Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.bgSecondary,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<int?>(
                    value: _selectedCityId,
                    isExpanded: true,
                    dropdownColor: AppColors.bgSecondary,
                    hint: Text('Selectează un oraș', style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary)),
                    items: [
                      const DropdownMenuItem<int?>(
                        value: null,
                        child: Text('Fără preferință'),
                      ),
                      ...cities.map((c) => DropdownMenuItem<int?>(
                        value: c.id,
                        child: Text(c.name),
                      )),
                    ],
                    onChanged: (v) => setState(() => _selectedCityId = v),
                  ),
                ),
              ),
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
              error: (_, __) => Text('Nu s-au putut încărca orașele', style: AppTypography.bodySmall.copyWith(color: AppColors.danger)),
            ),

            const SizedBox(height: AppSpacing.xxxl),

            // Categories multi-select
            Text('Categorii preferate', style: AppTypography.headlineSmall),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Selectează categoriile care te interesează',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),

            categoriesAsync.when(
              data: (categories) => Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: categories.map((cat) {
                  final selected = _selectedCategoryIds.contains(cat.id);
                  return FilterChip(
                    selected: selected,
                    label: Text(cat.name),
                    labelStyle: AppTypography.labelMedium.copyWith(
                      color: selected ? AppColors.bgPrimary : AppColors.textSecondary,
                    ),
                    backgroundColor: AppColors.bgSecondary,
                    selectedColor: AppColors.accent,
                    checkmarkColor: AppColors.bgPrimary,
                    side: BorderSide(
                      color: selected ? AppColors.accent : AppColors.border,
                    ),
                    onSelected: (v) {
                      setState(() {
                        if (v) {
                          _selectedCategoryIds.add(cat.id);
                        } else {
                          _selectedCategoryIds.remove(cat.id);
                        }
                      });
                    },
                  );
                }).toList(),
              ),
              loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
              error: (_, __) => Text('Nu s-au putut încărca categoriile', style: AppTypography.bodySmall.copyWith(color: AppColors.danger)),
            ),

            const SizedBox(height: AppSpacing.xxxl),

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
                    : const Text('Salvează preferințele'),
              ),
            ),

            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }
}
