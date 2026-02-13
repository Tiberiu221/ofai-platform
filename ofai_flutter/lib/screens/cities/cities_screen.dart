import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/static_data_provider.dart';
import '../../widgets/skeleton_loader.dart';

class CitiesScreen extends ConsumerWidget {
  const CitiesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final citiesAsync = ref.watch(citiesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text('Orase', style: AppTypography.headlineMedium),
        backgroundColor: AppColors.bgPrimary,
        surfaceTintColor: Colors.transparent,
      ),
      body: citiesAsync.when(
        data: (cities) {
          if (cities.isEmpty) {
            return const Center(
              child: Text(
                'Niciun oras disponibil',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.pagePadding),
            itemCount: cities.length,
            separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
            itemBuilder: (context, index) {
              final city = cities[index];
              return InkWell(
                onTap: () => context.push('/explore?city=${city.id}'),
                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: AppSpacing.lg,
                    horizontal: AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.location_city,
                        color: AppColors.accent,
                        size: 22,
                      ),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: Text(
                          city.name,
                          style: AppTypography.bodyLarge,
                        ),
                      ),
                      Icon(
                        Icons.chevron_right,
                        color: AppColors.textTertiary,
                        size: 20,
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: SkeletonLoader(count: 8, type: SkeletonType.businessCard),
        ),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Eroare la incarcarea oraselor',
                style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: () => ref.invalidate(citiesProvider),
                child: const Text('Reincearca'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
