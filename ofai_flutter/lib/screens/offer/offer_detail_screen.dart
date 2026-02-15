import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/launchers.dart';
import '../../providers/offers_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fullscreen_gallery.dart';

class OfferDetailScreen extends ConsumerWidget {
  final int offerId;

  const OfferDetailScreen({super.key, required this.offerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(offerDetailProvider(offerId));
    final favState = ref.watch(favoritesProvider);
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    return Scaffold(
      body: offerAsync.when(
        data: (offer) {
          final isFav = favState.favoriteIds.contains(offer.id);
          final heroImage = offer.displayImage;
          final startDate = offer.startDate != null ? DateTime.tryParse(offer.startDate!) : null;
          final endDate = offer.endDate != null ? DateTime.tryParse(offer.endDate!) : null;
          final booking = offer.booking;

          return Stack(
            children: [
              CustomScrollView(
                slivers: [
                  // Hero image
                  SliverAppBar(
                    expandedHeight: 240,
                    pinned: true,
                    backgroundColor: AppColors.bgPrimary,
                    actions: [
                      IconButton(
                        icon: const Icon(Icons.share_outlined),
                        onPressed: () => Launchers.shareOffer(offer.title, offer.id),
                      ),
                    ],
                    flexibleSpace: FlexibleSpaceBar(
                      background: Hero(
                        tag: 'offer-image-$offerId',
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (heroImage != null && heroImage.isNotEmpty)
                              CachedNetworkImage(
                                imageUrl: heroImage,
                                fit: BoxFit.cover,
                                placeholder: (_, __) => Container(color: AppColors.bgSecondary),
                                errorWidget: (_, __, ___) => Container(
                                  color: AppColors.bgSecondary,
                                  child: const Icon(Icons.local_offer_outlined, size: 48, color: AppColors.textTertiary),
                                ),
                              )
                            else
                              Container(
                                color: AppColors.bgSecondary,
                                child: const Icon(Icons.local_offer_outlined, size: 48, color: AppColors.textTertiary),
                              ),
                          // Gradient overlay
                          const DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.transparent, Color(0xBB080808)],
                              ),
                            ),
                          ),
                          // Discount badge
                          if (offer.discountValue != null)
                            Positioned(
                              top: 80,
                              right: 16,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.accent,
                                  borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                                ),
                                child: Text(
                                  offer.discountLabel,
                                  style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
                                ),
                              ),
                            ),
                        ],
                        ),
                      ),
                    ),
                  ),

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.pagePadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Title
                          Text(offer.title, style: AppTypography.headlineLarge),

                          const SizedBox(height: AppSpacing.md),

                          // Date range
                          if (startDate != null || endDate != null) ...[
                            Row(
                              children: [
                                Icon(Icons.calendar_today, size: 16, color: AppColors.textTertiary),
                                const SizedBox(width: AppSpacing.xs),
                                Text(
                                  'Valabilă: ${Formatters.date(startDate)} - ${Formatters.date(endDate)}',
                                  style: AppTypography.caption,
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: offer.isActive
                                        ? AppColors.success.withValues(alpha: 0.15)
                                        : AppColors.danger.withValues(alpha: 0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    offer.isActive ? 'Activă' : 'Expirată',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: offer.isActive ? AppColors.success : AppColors.danger,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Description
                          if (offer.description != null && offer.description!.isNotEmpty) ...[
                            Text(
                              offer.description!,
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Conditions
                          if (offer.conditions != null && offer.conditions!.isNotEmpty) ...[
                            _SectionTitle('Condiții'),
                            const SizedBox(height: AppSpacing.sm),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.bgSecondary,
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                              ),
                              child: Text(
                                offer.conditions!,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Business info
                          if (offer.business != null) ...[
                            _SectionTitle('Business'),
                            const SizedBox(height: AppSpacing.sm),
                            GestureDetector(
                              onTap: () => context.push('/business/${offer.business!.id}'),
                              child: Container(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                decoration: BoxDecoration(
                                  color: AppColors.bgCard,
                                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Row(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: SizedBox(
                                        width: 44,
                                        height: 44,
                                        child: offer.business!.logoUrl != null
                                            ? CachedNetworkImage(
                                                imageUrl: offer.business!.logoUrl!,
                                                fit: BoxFit.cover,
                                                errorWidget: (_, __, ___) => _BusinessInitial(offer.business!.name),
                                              )
                                            : _BusinessInitial(offer.business!.name),
                                      ),
                                    ),
                                    const SizedBox(width: AppSpacing.md),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(offer.business!.name, style: AppTypography.labelLarge),
                                          if (offer.business!.city != null || offer.business!.category != null)
                                            Text(
                                              [offer.business!.category, offer.business!.city]
                                                  .where((s) => s != null && s.isNotEmpty)
                                                  .join(' \u2022 '),
                                              style: AppTypography.captionMuted,
                                            ),
                                        ],
                                      ),
                                    ),
                                    if (offer.business!.rating != null && offer.business!.rating! > 0) ...[
                                      Icon(Icons.star, size: 16, color: AppColors.accent),
                                      const SizedBox(width: 2),
                                      Text(
                                        offer.business!.rating!.toStringAsFixed(1),
                                        style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
                                      ),
                                    ],
                                    const SizedBox(width: 4),
                                    Icon(Icons.chevron_right, size: 20, color: AppColors.textTertiary),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Locations
                          if (offer.locations != null && offer.locations!.isNotEmpty) ...[
                            _SectionTitle('Locații'),
                            const SizedBox(height: AppSpacing.sm),
                            ...offer.locations!.map((loc) => Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: GestureDetector(
                                onTap: loc.lat != null && loc.lng != null
                                    ? () => Launchers.maps(loc.lat!, loc.lng!, address: loc.address)
                                    : null,
                                child: Container(
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: AppColors.bgCard,
                                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                    border: Border.all(color: AppColors.border),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(Icons.location_on_outlined, size: 20, color: AppColors.textTertiary),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            if (loc.address != null)
                                              Text(loc.address!, style: AppTypography.bodyMedium),
                                            if (loc.cityName != null)
                                              Text(loc.cityName!, style: AppTypography.captionMuted),
                                          ],
                                        ),
                                      ),
                                      if (loc.lat != null)
                                        Icon(Icons.map_outlined, size: 18, color: AppColors.accent),
                                    ],
                                  ),
                                ),
                              ),
                            )),
                            const SizedBox(height: AppSpacing.lg),
                          ],

                          // Booking
                          if (booking != null && booking.hasBooking) ...[
                            _SectionTitle('Rezervare'),
                            const SizedBox(height: AppSpacing.sm),
                            if (booking.instructions != null && booking.instructions!.isNotEmpty) ...[
                              Text(
                                booking.instructions!,
                                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                              ),
                              const SizedBox(height: AppSpacing.sm),
                            ],
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: [
                                if (booking.phone != null)
                                  _ActionChip(
                                    icon: Icons.phone,
                                    label: 'Telefon',
                                    onTap: () => Launchers.call(booking.phone!),
                                  ),
                                if (booking.whatsapp != null)
                                  _ActionChip(
                                    icon: Icons.message,
                                    label: 'WhatsApp',
                                    onTap: () => Launchers.whatsApp(booking.whatsapp!),
                                  ),
                                if (booking.url != null)
                                  _ActionChip(
                                    icon: Icons.language,
                                    label: 'Online',
                                    onTap: () => Launchers.website(booking.url!),
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Gallery
                          if (offer.gallery != null && offer.gallery!.isNotEmpty) ...[
                            _SectionTitle('Galerie'),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Gallery horizontal
                  if (offer.gallery != null && offer.gallery!.isNotEmpty)
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: 160,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                          itemCount: offer.gallery!.length,
                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (_, i) => GestureDetector(
                            onTap: () => FullscreenGallery.open(
                              context,
                              offer.gallery!.map((g) => g.url).toList(),
                              initialIndex: i,
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                              child: CachedNetworkImage(
                                imageUrl: offer.gallery![i].url,
                                width: 220,
                                fit: BoxFit.cover,
                                placeholder: (_, __) => Container(width: 220, color: AppColors.bgSecondary),
                                errorWidget: (_, __, ___) => Container(
                                  width: 220,
                                  color: AppColors.bgSecondary,
                                  child: const Icon(Icons.broken_image_outlined, color: AppColors.textTertiary),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Bottom padding for FAB
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),

              // Favorite FAB
              if (isLoggedIn)
                Positioned(
                  bottom: AppSpacing.xxl,
                  right: AppSpacing.pagePadding,
                  child: FloatingActionButton.extended(
                    onPressed: () {
                      HapticFeedback.mediumImpact();
                      ref.read(favoritesProvider.notifier).toggleFavorite(offer.id);
                    },
                    backgroundColor: isFav ? AppColors.accent : AppColors.bgCard,
                    icon: Icon(
                      isFav ? Icons.bookmark : Icons.bookmark_border,
                      color: isFav ? AppColors.bgPrimary : AppColors.accent,
                    ),
                    label: Text(
                      isFav ? 'Salvată' : 'Salvează',
                      style: AppTypography.labelMedium.copyWith(
                        color: isFav ? AppColors.bgPrimary : AppColors.accent,
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message: 'Nu s-a putut încărca oferta',
            onRetry: () => ref.invalidate(offerDetailProvider(offerId)),
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Text(title, style: AppTypography.headlineSmall);
  }
}

class _BusinessInitial extends StatelessWidget {
  final String name;
  const _BusinessInitial(this.name);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.accent,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: AppTypography.labelLarge.copyWith(color: AppColors.bgPrimary),
        ),
      ),
    );
  }
}

class _ActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _ActionChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.accentMuted,
          borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
          border: Border.all(color: AppColors.accent),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppColors.accent),
            const SizedBox(width: 6),
            Text(label, style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
          ],
        ),
      ),
    );
  }
}
