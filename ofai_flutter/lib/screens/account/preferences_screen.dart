import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../providers/auth_provider.dart';
import '../../providers/static_data_provider.dart';
import '../../core/network/api_exceptions.dart';

class PreferencesScreen extends ConsumerStatefulWidget {
  const PreferencesScreen({super.key});

  @override
  ConsumerState<PreferencesScreen> createState() => _PreferencesScreenState();
}

class _PreferencesScreenState extends ConsumerState<PreferencesScreen> {
  Set<int> _selectedCityIds = {};
  Set<int> _selectedCategoryIds = {};
  bool _isSubmitting = false;
  bool _didInit = false;

  void _initFromUser() {
    if (_didInit) return;
    _didInit = true;
    final user = ref.read(authProvider).user;
    _selectedCityIds = Set<int>.from(user?.preferredCityIds ?? []);
    _selectedCategoryIds = Set<int>.from(user?.preferredCategoryIds ?? []);
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await ApiClient().dio.put(ApiEndpoints.userPreferences, data: {
        'preferred_city_ids': _selectedCityIds.toList(),
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
        Navigator.of(context).pop(true);
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

            // City selector (multi-select)
            Text('Orașele preferate', style: AppTypography.headlineSmall),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Poți selecta mai multe orașe',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.md),

            citiesAsync.when(
              data: (cities) => Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: cities.map((city) {
                  final selected = _selectedCityIds.contains(city.id);
                  return FilterChip(
                    selected: selected,
                    label: Text(city.name),
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
                          _selectedCityIds.add(city.id);
                        } else {
                          _selectedCityIds.remove(city.id);
                        }
                      });
                    },
                  );
                }).toList(),
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
