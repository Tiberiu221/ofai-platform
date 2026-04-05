import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/collections_provider.dart';
import '../../widgets/offer_card.dart';

import '../../widgets/error_state.dart' as w;

class CollectionDetailScreen extends ConsumerWidget {
  final int collectionId;

  const CollectionDetailScreen({super.key, required this.collectionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detailAsync = ref.watch(collectionDetailProvider(collectionId));

    return Scaffold(
      body: detailAsync.when(
        data: (collection) => RefreshIndicator(
          color: AppColors.accent,
          backgroundColor: AppColors.bgCard,
          onRefresh: () async {
            ref.invalidate(collectionDetailProvider(collectionId));
            await ref.read(collectionDetailProvider(collectionId).future);
          },
          child: CustomScrollView(
            slivers: [
            // Header with image
            SliverAppBar(
              expandedHeight: collection.imageUrl != null ? 200 : 0,
              pinned: true,
              backgroundColor: AppColors.bgPrimary,
              foregroundColor: AppColors.textPrimary,
              flexibleSpace: collection.imageUrl != null
                  ? FlexibleSpaceBar(
                      background: CachedNetworkImage(
                        imageUrl: collection.imageUrl!,
                        fit: BoxFit.cover,
                        memCacheWidth: 800,
                        color: Colors.black.withValues(alpha: 0.3),
                        colorBlendMode: BlendMode.darken,
                      ),
                    )
                  : null,
              title: Text(
                collection.title,
                style: AppTypography.headlineSmall,
              ),
            ),

            // Description
            if (collection.description != null && collection.description!.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.pagePadding),
                  child: Text(
                    collection.description!,
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),

            // Offer count
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                  vertical: AppSpacing.sm,
                ),
                child: Text(
                  '${collection.offers?.length ?? 0} oferte',
                  style: AppTypography.labelMedium.copyWith(
                    color: AppColors.textTertiary,
                  ),
                ),
              ),
            ),

            // Offers list
            if (collection.offers != null && collection.offers!.isNotEmpty)
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                  vertical: AppSpacing.sm,
                ),
                sliver: SliverList.separated(
                  itemCount: collection.offers!.length,
                  separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.md),
                  itemBuilder: (context, index) => OfferCard(
                    offer: collection.offers![index],
                  ),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: AppSpacing.huge)),
            ],
          ),
        ),
        loading: () => SafeArea(
          child: Column(
            children: [
              AppBar(
                backgroundColor: AppColors.bgPrimary,
                foregroundColor: AppColors.textPrimary,
                title: const Text('...'),
              ),
              const Expanded(
                child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
              ),
            ],
          ),
        ),
        error: (err, _) => SafeArea(
          child: Column(
            children: [
              AppBar(
                backgroundColor: AppColors.bgPrimary,
                foregroundColor: AppColors.textPrimary,
              ),
              Expanded(
                child: w.ErrorState(
                  message: 'Nu s-a putut incarca colectia',
                  onRetry: () => ref.invalidate(collectionDetailProvider(collectionId)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
