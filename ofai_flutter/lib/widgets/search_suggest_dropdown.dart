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
  final String query;

  const SearchSuggestDropdown({
    super.key,
    required this.onDismiss,
    required this.query,
  });

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
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.xxl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.search_off_rounded,
                size: 28,
                color: AppColors.textTertiary,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Niciun rezultat pentru \u201E$query\u201D',
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Incearca alt termen de cautare',
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
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
                    query: query,
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
                    query: query,
                    onTap: () {
                      ref.read(searchSuggestProvider.notifier).clear();
                      onDismiss();
                      context.push('/business/${biz.id}');
                    },
                  ),
                ),
              ],

              // "View all results" link
              const Divider(height: 1, color: AppColors.border),
              InkWell(
                onTap: onDismiss,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.search, size: 16, color: AppColors.accent),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          'Vezi toate rezultatele',
                          style: AppTypography.bodyMedium.copyWith(
                            color: AppColors.accent,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Icon(Icons.arrow_forward, size: 14, color: AppColors.accent),
                    ],
                  ),
                ),
              ),
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

/// Builds a RichText with matched substrings highlighted in accent/bold.
class _HighlightText extends StatelessWidget {
  final String text;
  final String query;
  final TextStyle baseStyle;
  final int maxLines;

  const _HighlightText({
    required this.text,
    required this.query,
    required this.baseStyle,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    if (query.isEmpty) {
      return Text(text, style: baseStyle, maxLines: maxLines, overflow: TextOverflow.ellipsis);
    }

    final lowerText = text.toLowerCase();
    final lowerQuery = query.toLowerCase();
    final spans = <TextSpan>[];
    int start = 0;

    while (start < text.length) {
      final idx = lowerText.indexOf(lowerQuery, start);
      if (idx == -1) {
        spans.add(TextSpan(text: text.substring(start)));
        break;
      }
      if (idx > start) {
        spans.add(TextSpan(text: text.substring(start, idx)));
      }
      spans.add(TextSpan(
        text: text.substring(idx, idx + query.length),
        style: TextStyle(
          fontWeight: FontWeight.w700,
          color: AppColors.accent,
        ),
      ));
      start = idx + query.length;
    }

    return RichText(
      text: TextSpan(style: baseStyle, children: spans),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
    );
  }
}

class _OfferSuggestItem extends StatelessWidget {
  final SuggestOffer offer;
  final String query;
  final VoidCallback onTap;

  const _OfferSuggestItem({
    required this.offer,
    required this.query,
    required this.onTap,
  });

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
                  _HighlightText(
                    text: offer.title,
                    query: query,
                    baseStyle: AppTypography.bodyMedium,
                  ),
                  if (offer.businessName != null)
                    _HighlightText(
                      text: offer.businessName!,
                      query: query,
                      baseStyle: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
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
  final String query;
  final VoidCallback onTap;

  const _BusinessSuggestItem({
    required this.business,
    required this.query,
    required this.onTap,
  });

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
                        memCacheWidth: 56,
                        memCacheHeight: 56,
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
                  _HighlightText(
                    text: business.name,
                    query: query,
                    baseStyle: AppTypography.bodyMedium,
                  ),
                  if (business.categoryName != null)
                    _HighlightText(
                      text: business.categoryName!,
                      query: query,
                      baseStyle: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
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
