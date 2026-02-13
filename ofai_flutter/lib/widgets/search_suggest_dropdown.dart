import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../providers/search_suggest_provider.dart';

class SearchSuggestDropdown extends ConsumerWidget {
  final VoidCallback onDismiss;

  const SearchSuggestDropdown({super.key, required this.onDismiss});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(searchSuggestProvider);

    if (!state.showDropdown) return const SizedBox.shrink();

    if (state.isLoading && !state.hasResults) {
      return _DropdownContainer(
        child: const Padding(
          padding: EdgeInsets.all(AppSpacing.xxl),
          child: Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                color: AppColors.accent,
                strokeWidth: 2,
              ),
            ),
          ),
        ),
      );
    }

    if (!state.hasResults && !state.isLoading) {
      return _DropdownContainer(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Center(
            child: Text(
              'Niciun rezultat',
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ),
      );
    }

    return _DropdownContainer(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 360),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Offers section
              if (state.offers.isNotEmpty) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xs,
                  ),
                  child: Text(
                    'Oferte',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textTertiary,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                ...state.offers.map(
                  (offer) => _OfferSuggestItem(
                    offer: offer,
                    onTap: () {
                      ref.read(searchSuggestProvider.notifier).clear();
                      onDismiss();
                      context.push('/offer/${offer.id}');
                    },
                  ),
                ),
              ],

              // Businesses section
              if (state.businesses.isNotEmpty) ...[
                if (state.offers.isNotEmpty)
                  const Divider(height: 1, color: AppColors.border),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.xs,
                  ),
                  child: Text(
                    'Business-uri',
                    style: AppTypography.labelSmall.copyWith(
                      color: AppColors.textTertiary,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                ...state.businesses.map(
                  (biz) => _BusinessSuggestItem(
                    business: biz,
                    onTap: () {
                      ref.read(searchSuggestProvider.notifier).clear();
                      onDismiss();
                      context.push('/business/${biz.id}');
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _DropdownContainer extends StatelessWidget {
  final Widget child;

  const _DropdownContainer({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.bgSecondary,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        child: child,
      ),
    );
  }
}

class _OfferSuggestItem extends StatelessWidget {
  final SuggestOffer offer;
  final VoidCallback onTap;

  const _OfferSuggestItem({required this.offer, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            Icon(Icons.local_offer_outlined, size: 18, color: AppColors.accent),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    offer.title,
                    style: AppTypography.bodyMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (offer.businessName != null)
                    Text(
                      offer.businessName!,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            if (offer.discountLabel != null) ...[
              const SizedBox(width: AppSpacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  offer.discountLabel!,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.accent,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BusinessSuggestItem extends StatelessWidget {
  final SuggestBusiness business;
  final VoidCallback onTap;

  const _BusinessSuggestItem({required this.business, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          children: [
            // Logo
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                width: 28,
                height: 28,
                child: business.logoUrl != null
                    ? CachedNetworkImage(
                        imageUrl: business.logoUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.bgCard,
                          child: Icon(Icons.store, size: 16, color: AppColors.textTertiary),
                        ),
                        errorWidget: (_, __, ___) => Container(
                          color: AppColors.bgCard,
                          child: Icon(Icons.store, size: 16, color: AppColors.textTertiary),
                        ),
                      )
                    : Container(
                        color: AppColors.bgCard,
                        child: Icon(Icons.store, size: 16, color: AppColors.textTertiary),
                      ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    business.name,
                    style: AppTypography.bodyMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (business.categoryName != null)
                    Text(
                      business.categoryName!,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, size: 18, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}
