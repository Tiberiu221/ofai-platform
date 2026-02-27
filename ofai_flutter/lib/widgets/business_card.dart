import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/app_spacing.dart';
import '../models/business.dart';
import '../providers/auth_provider.dart';
import '../providers/subscriptions_provider.dart';
import 'tap_scale.dart';

class BusinessCard extends ConsumerWidget {
  final Business business;

  const BusinessCard({super.key, required this.business});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasCover = business.coverImage != null && business.coverImage!.isNotEmpty;

    return Semantics(
      label: 'Business: ${business.name}, ${business.categoryName}',
      button: true,
      child: TapScale(
      onTap: () => context.push('/business/${business.id}'),
      child: Container(
        clipBehavior: Clip.hardEdge,
        decoration: BoxDecoration(
          color: AppColors.bgCard,
          borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            // Cover image strip with follow heart overlay
            if (hasCover)
              SizedBox(
                height: 64,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: business.coverImage!,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: AppColors.bgSecondary),
                      errorWidget: (_, __, ___) => Container(color: AppColors.bgSecondary),
                    ),
                    _buildFollowHeart(ref),
                  ],
                ),
              ),
            // Main row content
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  // Logo
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    child: SizedBox(
                      width: 56,
                      height: 56,
                      child: _buildLogo(),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  // Info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                business.name,
                                style: AppTypography.labelLarge,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (business.isVerified)
                              Padding(
                                padding: const EdgeInsets.only(left: 4),
                                child: Icon(Icons.verified, color: AppColors.accent, size: 16),
                              ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          [business.categoryName, business.cityName]
                              .where((s) => s.isNotEmpty)
                              .join(' • '),
                          style: AppTypography.captionMuted,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Row(
                          children: [
                            // Rating
                            if (business.rating != null && business.rating! > 0) ...[
                              Icon(Icons.star, size: 14, color: AppColors.accent),
                              const SizedBox(width: 2),
                              Text(
                                business.rating!.toStringAsFixed(1),
                                style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                              ),
                              if (business.ratingCount != null)
                                Text(
                                  ' (${business.ratingCount})',
                                  style: AppTypography.captionMuted,
                                ),
                              const SizedBox(width: AppSpacing.sm),
                            ],
                            // Offers count
                            if (business.activeOffersCount != null && business.activeOffersCount! > 0) ...[
                              Icon(Icons.local_offer_outlined, size: 12, color: AppColors.textTertiary),
                              const SizedBox(width: 2),
                              Text(
                                '${business.activeOffersCount} oferte',
                                style: AppTypography.captionMuted,
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right, color: AppColors.textTertiary, size: 20),
                ],
              ),
            ),
          ],
        ),
      ),
      ),
    );
  }

  /// Follow heart icon — shown for all users, redirects to login if not authenticated
  Widget _buildFollowHeart(WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;
    final isFollowing = isLoggedIn
        ? ref.watch(subscriptionsProvider.select((s) => s.subscribedIds.contains(business.id)))
        : false;

    return Positioned(
      top: 8,
      left: 8,
      child: Semantics(
        label: isFollowing ? 'Nu mai urmări' : 'Urmărește',
        button: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.lightImpact();
            if (!isLoggedIn) {
              GoRouter.of(ref.context).push('/login');
              return;
            }
            ref.read(subscriptionsProvider.notifier).toggleSubscription(business.id);
          },
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.overlay,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isFollowing ? Icons.favorite : Icons.favorite_border,
              size: 16,
              color: isFollowing ? const Color(0xFFEF4444) : AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogo() {
    final url = business.logoUrl;
    if (url == null || url.isEmpty) {
      return Container(
        color: AppColors.accent,
        child: Center(
          child: Text(
            business.name.isNotEmpty ? business.name[0].toUpperCase() : 'B',
            style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
          ),
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      placeholder: (_, __) => Container(color: AppColors.bgSecondary),
      errorWidget: (_, __, ___) => Container(
        color: AppColors.accent,
        child: Center(
          child: Text(
            business.name.isNotEmpty ? business.name[0].toUpperCase() : 'B',
            style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
          ),
        ),
      ),
    );
  }
}
