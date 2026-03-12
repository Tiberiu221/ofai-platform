import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/saved_searches_provider.dart';
import '../../models/saved_search.dart';

class SavedSearchesScreen extends ConsumerStatefulWidget {
  const SavedSearchesScreen({super.key});

  @override
  ConsumerState<SavedSearchesScreen> createState() => _SavedSearchesScreenState();
}

class _SavedSearchesScreenState extends ConsumerState<SavedSearchesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(savedSearchesProvider.notifier).fetch());
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(savedSearchesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cautari salvate'),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: state.isLoading
          ? const Center(child: CircularProgressIndicator(color: AppColors.accent))
          : state.searches.isEmpty
              ? _buildEmpty()
              : ListView.separated(
                  padding: const EdgeInsets.all(AppSpacing.pagePadding),
                  itemCount: state.searches.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    return _SearchItem(search: state.searches[index]);
                  },
                ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Padding(
        padding: AppSpacing.pageH,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.saved_search, size: 64, color: AppColors.textTertiary),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Nicio cautare salvata',
              style: AppTypography.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Salveaza cautarile din Exploreaza pentru a primi notificari cand apar oferte noi.',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchItem extends ConsumerWidget {
  final SavedSearch search;
  const _SearchItem({required this.search});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSecondary,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: const Icon(Icons.search, color: AppColors.accent),
        title: Text(
          search.displayLabel,
          style: AppTypography.bodyMedium,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: _buildSubtitle(),
        trailing: IconButton(
          icon: const Icon(Icons.close, size: 20, color: AppColors.textTertiary),
          onPressed: () {
            ref.read(savedSearchesProvider.notifier).delete(search.id);
          },
        ),
        onTap: () {
          // Navigate to explore with filters
          final params = <String, String>{};
          if (search.query != null) params['q'] = search.query!;
          if (search.cityId != null) params['city'] = search.cityId.toString();
          if (search.categoryId != null) params['category'] = search.categoryId.toString();
          context.go(Uri(path: '/explore', queryParameters: params.isNotEmpty ? params : null).toString());
        },
      ),
    );
  }

  Widget? _buildSubtitle() {
    final parts = <String>[];
    if (search.cityName != null) parts.add(search.cityName!);
    if (search.categoryName != null) parts.add(search.categoryName!);
    if (parts.isEmpty) return null;
    return Text(
      parts.join(' · '),
      style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
    );
  }
}
