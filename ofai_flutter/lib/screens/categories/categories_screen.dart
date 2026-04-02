import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/static_data_provider.dart';
import '../../widgets/skeleton_loader.dart';
import '../../widgets/empty_state.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context)!.categoriesTitle, style: AppTypography.headlineMedium),
        backgroundColor: AppColors.bgPrimary,
        surfaceTintColor: Colors.transparent,
      ),
      body: categoriesAsync.when(
        data: (categories) {
          if (categories.isEmpty) {
            return const EmptyState(
              icon: Icons.category_outlined,
              title: AppLocalizations.of(context)!.categoriesEmpty,
            );
          }
          return RefreshIndicator(
            color: AppColors.accent,
            backgroundColor: AppColors.bgCard,
            onRefresh: () async {
              ref.invalidate(categoriesProvider);
              await ref.read(categoriesProvider.future);
            },
            child: GridView.builder(
              padding: const EdgeInsets.all(AppSpacing.pagePadding),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: MediaQuery.of(context).size.width > 600 ? 3 : 2,
                crossAxisSpacing: AppSpacing.md,
                mainAxisSpacing: AppSpacing.md,
                childAspectRatio: 1.3,
              ),
              itemCount: categories.length,
              itemBuilder: (context, index) {
                final cat = categories[index];
                return GestureDetector(
                  onTap: () => context.push('/explore?category=${cat.id}'),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.bgCard,
                      borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: AppColors.accent.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(
                            cat.icon,
                            color: AppColors.accent,
                            size: 28,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                          child: Text(
                            cat.name,
                            style: AppTypography.labelLarge,
                            textAlign: TextAlign.center,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          );
        },
        loading: () => Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: SkeletonLoader(count: 6, type: SkeletonType.businessCard),
        ),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                AppLocalizations.of(context)!.categoriesError,
                style: AppTypography.bodyLarge.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: () => ref.invalidate(categoriesProvider),
                child: Text(AppLocalizations.of(context)!.categoriesRetry),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
