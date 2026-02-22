import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/utils/launchers.dart';
import '../../providers/businesses_provider.dart';
import '../../providers/subscriptions_provider.dart';
import '../../providers/reviews_provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/offer_requests_provider.dart';
import '../../widgets/review_card.dart';
import '../../widgets/error_state.dart' as w;
import '../../widgets/fullscreen_gallery.dart';
import '../../widgets/animated_toggle_fab.dart';
import '../../services/analytics_service.dart';

class BusinessDetailScreen extends ConsumerWidget {
  final int businessId;

  const BusinessDetailScreen({super.key, required this.businessId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final businessAsync = ref.watch(businessDetailProvider(businessId));
    final subsState = ref.watch(subscriptionsProvider);
    final reviewsState = ref.watch(businessReviewsProvider(businessId));
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;

    return Scaffold(
      body: businessAsync.when(
        data: (business) {
          final isSub = subsState.subscribedIds.contains(business.id);
          final coverUrl = business.coverImage ??
              (business.images != null && business.images!.isNotEmpty ? business.images!.first.url : null) ??
              business.logoUrl;

          return Stack(
            children: [
              CustomScrollView(
                slivers: [
                  // Cover with parallax
                  SliverAppBar(
                    expandedHeight: 220,
                    pinned: true,
                    stretch: true,
                    backgroundColor: AppColors.bgPrimary,
                    actions: [
                      IconButton(
                        icon: const Icon(Icons.share_outlined),
                        onPressed: () {
                          Launchers.shareBusiness(business.name, business.id);
                          AnalyticsService.trackClick(businessId: business.id, actionType: 'share');
                        },
                      ),
                    ],
                    flexibleSpace: LayoutBuilder(
                      builder: (context, constraints) {
                        final top = constraints.biggest.height;
                        final expandedHeight = 220 + MediaQuery.of(context).padding.top;
                        final collapsedHeight = kToolbarHeight + MediaQuery.of(context).padding.top;
                        final scrollFraction = ((expandedHeight - top) / (expandedHeight - collapsedHeight)).clamp(0.0, 1.0);
                        final parallaxOffset = scrollFraction * 30;

                        return FlexibleSpaceBar(
                          background: Stack(
                            fit: StackFit.expand,
                            children: [
                              Transform.translate(
                                offset: Offset(0, parallaxOffset),
                                child: coverUrl != null && coverUrl.isNotEmpty
                                    ? CachedNetworkImage(
                                        imageUrl: coverUrl,
                                        fit: BoxFit.cover,
                                        placeholder: (_, __) => Container(color: AppColors.bgSecondary),
                                        errorWidget: (_, __, ___) => Container(color: AppColors.bgSecondary),
                                      )
                                    : Container(color: AppColors.bgSecondary),
                              ),
                              const DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [Colors.transparent, Color(0xCC080808)],
                                  ),
                                ),
                              ),
                              // Logo overlay
                              Positioned(
                                bottom: 16,
                                left: 20,
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: SizedBox(
                                    width: 56,
                                    height: 56,
                                    child: business.logoUrl != null
                                        ? CachedNetworkImage(
                                            imageUrl: business.logoUrl!,
                                            fit: BoxFit.cover,
                                            errorWidget: (_, __, ___) => _Initial(business.name),
                                          )
                                        : _Initial(business.name),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),

                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.pagePadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Name
                          Row(
                            children: [
                              Expanded(
                                child: Text(business.name, style: AppTypography.headlineLarge),
                              ),
                              if (business.isVerified)
                                Padding(
                                  padding: const EdgeInsets.only(left: 6),
                                  child: Icon(Icons.verified, color: AppColors.accent, size: 24),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            [business.categoryName, business.cityName]
                                .where((s) => s.isNotEmpty)
                                .join(' \u2022 '),
                            style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                          ),

                          const SizedBox(height: AppSpacing.lg),

                          // Rating row
                          if (business.rating != null && business.rating! > 0) ...[
                            Row(
                              children: [
                                ...List.generate(5, (i) => Icon(
                                  i < business.rating!.round() ? Icons.star : Icons.star_border,
                                  size: 20,
                                  color: i < business.rating!.round() ? AppColors.accent : AppColors.textTertiary,
                                )),
                                const SizedBox(width: AppSpacing.sm),
                                Text(
                                  business.rating!.toStringAsFixed(1),
                                  style: AppTypography.labelLarge.copyWith(color: AppColors.accent),
                                ),
                                if (business.ratingCount != null)
                                  Text(
                                    ' (${business.ratingCount} recenzii)',
                                    style: AppTypography.caption,
                                  ),
                                const Spacer(),
                                if (isLoggedIn)
                                  GestureDetector(
                                    onTap: () => _showReviewSheet(context, ref),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                      decoration: BoxDecoration(
                                        border: Border.all(color: AppColors.accent),
                                        borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                                      ),
                                      child: Text(
                                        'Scrie recenzie',
                                        style: AppTypography.labelSmall.copyWith(color: AppColors.accent),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Review summary
                          if (business.reviewSummary != null && business.reviewSummary!.text.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: AppColors.accentMuted,
                                borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Icon(Icons.auto_awesome, size: 16, color: AppColors.accent),
                                      const SizedBox(width: 6),
                                      Text('Rezumat recenzii', style: AppTypography.labelMedium.copyWith(color: AppColors.accent)),
                                    ],
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    business.reviewSummary!.text,
                                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Contact info
                          if (business.address != null || business.phone != null || business.website != null) ...[
                            Text('Contact', style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            if (business.address != null)
                              _InfoTile(
                                icon: Icons.location_on_outlined,
                                label: business.address!,
                                onTap: business.lat != null && business.lng != null
                                    ? () {
                                        Launchers.maps(business.lat!, business.lng!, address: business.address);
                                        AnalyticsService.trackClick(businessId: business.id, actionType: 'navigate');
                                      }
                                    : null,
                              ),
                            if (business.phone != null)
                              _InfoTile(
                                icon: Icons.phone_outlined,
                                label: business.phone!,
                                onTap: () {
                                  Launchers.call(business.phone!);
                                  AnalyticsService.trackClick(businessId: business.id, actionType: 'phone');
                                },
                              ),
                            if (business.website != null)
                              _InfoTile(
                                icon: Icons.language,
                                label: business.website!,
                                onTap: () {
                                  Launchers.website(business.website!);
                                  AnalyticsService.trackClick(businessId: business.id, actionType: 'website');
                                },
                                accent: true,
                              ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Locations
                          if (business.locations != null && business.locations!.length > 1) ...[
                            Text('Locații', style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            ...business.locations!.map((loc) => Padding(
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
                                      Icon(Icons.location_on_outlined, size: 18, color: AppColors.textTertiary),
                                      const SizedBox(width: AppSpacing.sm),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            if (loc.address != null)
                                              Text(loc.address!, style: AppTypography.bodyMedium),
                                            if (loc.city != null)
                                              Text(loc.city!.name, style: AppTypography.captionMuted),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Booking
                          if (business.booking != null && business.booking!.hasBooking) ...[
                            Text('Rezervare', style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            Wrap(
                              spacing: AppSpacing.sm,
                              runSpacing: AppSpacing.sm,
                              children: [
                                if (business.booking!.phone != null)
                                  _BookingChip(
                                    icon: Icons.phone,
                                    label: 'Telefon',
                                    onTap: () {
                                      Launchers.call(business.booking!.phone!);
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'phone');
                                    },
                                  ),
                                if (business.booking!.whatsapp != null)
                                  _BookingChip(
                                    icon: Icons.message,
                                    label: 'WhatsApp',
                                    onTap: () {
                                      Launchers.whatsApp(business.booking!.whatsapp!);
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'whatsapp');
                                    },
                                  ),
                                if (business.booking!.url != null)
                                  _BookingChip(
                                    icon: Icons.language,
                                    label: 'Online',
                                    onTap: () {
                                      Launchers.website(business.booking!.url!);
                                      AnalyticsService.trackClick(businessId: business.id, actionType: 'booking_url');
                                    },
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xxl),
                          ],

                          // Active offers have priority over pinch card — mutually exclusive
                          if (business.activeOffers != null && business.activeOffers!.isNotEmpty) ...[
                            Text('Oferte active', style: AppTypography.headlineSmall),
                            const SizedBox(height: AppSpacing.sm),
                            ...business.activeOffers!.map((offer) => Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                              child: Container(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                decoration: BoxDecoration(
                                  color: AppColors.bgCard,
                                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                                  border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
                                ),
                                child: Row(
                                  children: [
                                    if (offer.discountLabel.isNotEmpty)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: AppColors.accent,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          offer.discountLabel,
                                          style: AppTypography.labelSmall.copyWith(color: AppColors.bgPrimary),
                                        ),
                                      ),
                                    if (offer.discountLabel.isNotEmpty)
                                      const SizedBox(width: AppSpacing.sm),
                                    Expanded(
                                      child: Text(
                                        offer.title,
                                        style: AppTypography.bodyMedium,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )),
                            const SizedBox(height: AppSpacing.xxl),
                          ] else if (business.showPinch) ...[
                            // Pinch card — "Vreau o ofertă!" (only when NO active offers)
                            _PinchRequestCard(
                              businessId: business.id,
                              isLoggedIn: isLoggedIn,
                            ),
                          ],

                          // Images gallery
                          if (business.images != null && business.images!.isNotEmpty) ...[
                            Text(
                              'Galerie (${business.images!.length})',
                              style: AppTypography.headlineSmall,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                          ],
                        ],
                      ),
                    ),
                  ),

                  // Gallery horizontal
                  if (business.images != null && business.images!.isNotEmpty)
                    SliverToBoxAdapter(
                      child: SizedBox(
                        height: 140,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                          itemCount: business.images!.length,
                          separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
                          itemBuilder: (_, i) => GestureDetector(
                            onTap: () {
                              FullscreenGallery.open(
                                context,
                                business.images!.map((img) => img.url).toList(),
                                initialIndex: i,
                              );
                              AnalyticsService.trackClick(businessId: business.id, actionType: 'gallery');
                            },
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                              child: CachedNetworkImage(
                                imageUrl: business.images![i].url,
                                width: 200,
                                fit: BoxFit.cover,
                                placeholder: (_, __) => Container(width: 200, color: AppColors.bgSecondary),
                                errorWidget: (_, __, ___) => Container(width: 200, color: AppColors.bgSecondary),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Reviews section
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.pagePadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (business.images != null && business.images!.isNotEmpty)
                            const SizedBox(height: AppSpacing.xxl),
                          Text('Recenzii', style: AppTypography.headlineSmall),
                        ],
                      ),
                    ),
                  ),

                  // Review cards
                  if (reviewsState.isLoading)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.xxl),
                        child: Center(child: CircularProgressIndicator(color: AppColors.accent)),
                      ),
                    )
                  else if (reviewsState.reviews.isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.xxl),
                          child: Center(
                            child: Text(
                              'Nicio recenzie încă',
                              style: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                            ),
                          ),
                        ),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
                      sliver: SliverList.separated(
                        itemCount: reviewsState.reviews.length,
                        separatorBuilder: (_, __) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (_, i) => ReviewCard(review: reviewsState.reviews[i]),
                      ),
                    ),

                  // Load more reviews
                  if (reviewsState.hasMore && reviewsState.reviews.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.pagePadding),
                        child: Center(
                          child: TextButton(
                            onPressed: () => ref.read(businessReviewsProvider(businessId).notifier).loadMore(),
                            child: Text(
                              'Încarcă mai multe recenzii',
                              style: AppTypography.labelMedium.copyWith(color: AppColors.accent),
                            ),
                          ),
                        ),
                      ),
                    ),

                  // Bottom padding for FAB
                  const SliverToBoxAdapter(child: SizedBox(height: 100)),
                ],
              ),

              // Subscribe FAB with bounce animation
              if (isLoggedIn)
                Positioned(
                  bottom: AppSpacing.xxl,
                  right: AppSpacing.pagePadding,
                  child: AnimatedToggleFab(
                    isActive: isSub,
                    onTap: () => ref.read(subscriptionsProvider.notifier).toggleSubscription(business.id),
                    activeIcon: Icons.notifications_active,
                    inactiveIcon: Icons.notifications_none,
                    activeLabel: 'Urmarit',
                    inactiveLabel: 'Urmareste',
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.accent)),
        error: (err, _) => Scaffold(
          appBar: AppBar(backgroundColor: AppColors.bgPrimary),
          body: w.ErrorState(
            message: 'Nu s-a putut încărca business-ul',
            onRetry: () => ref.invalidate(businessDetailProvider(businessId)),
          ),
        ),
      ),
    );
  }

  void _showSuccessOverlay(BuildContext context) {
    showDialog(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black54,
      builder: (_) => const _SuccessOverlay(),
    );
  }

  void _showReviewSheet(BuildContext context, WidgetRef ref) {
    int selectedRating = 5;
    final commentController = TextEditingController();
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: AppColors.overlay,
      builder: (_) => ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            decoration: const BoxDecoration(
              color: AppColors.bgGlass,
              borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.cardRadius)),
              border: Border(top: BorderSide(color: AppColors.borderLight, width: 0.5)),
            ),
            child: StatefulBuilder(
        builder: (context, setState) => Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.pagePadding,
            AppSpacing.lg,
            AppSpacing.pagePadding,
            MediaQuery.of(context).viewInsets.bottom + AppSpacing.xxl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 32, height: 4,
                decoration: BoxDecoration(
                  color: AppColors.textTertiary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text('Scrie o recenzie', style: AppTypography.headlineSmall),
              const SizedBox(height: AppSpacing.lg),

              // Stars
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(5, (i) => GestureDetector(
                  onTap: () => setState(() => selectedRating = i + 1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Icon(
                      i < selectedRating ? Icons.star : Icons.star_border,
                      size: 36,
                      color: i < selectedRating ? AppColors.accent : AppColors.textTertiary,
                    ),
                  ),
                )),
              ),

              const SizedBox(height: AppSpacing.lg),

              TextField(
                controller: commentController,
                maxLines: 4,
                maxLength: 2000,
                style: AppTypography.bodyMedium,
                decoration: InputDecoration(
                  hintText: 'Scrie un comentariu (opțional)...',
                  hintStyle: AppTypography.bodyMedium.copyWith(color: AppColors.textTertiary),
                  filled: true,
                  fillColor: AppColors.bgSecondary,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: isSubmitting ? null : () async {
                    setState(() => isSubmitting = true);
                    final success = await ref
                        .read(businessReviewsProvider(businessId).notifier)
                        .submitReview(
                          rating: selectedRating,
                          comment: commentController.text.trim(),
                        );
                    if (context.mounted) {
                      Navigator.pop(context);
                      if (success) {
                        _showSuccessOverlay(context);
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                          content: Text('Eroare la trimitere'),
                          backgroundColor: AppColors.danger,
                        ));
                      }
                    }
                  },
                  child: isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary))
                      : const Text('Trimite recenzia'),
                ),
              ),
            ],
          ),
        ),
      ),
          ),
        ),
      ),
    ).then((_) => commentController.dispose());
  }
}

class _Initial extends StatelessWidget {
  final String name;
  const _Initial(this.name);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.accent,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'B',
          style: AppTypography.headlineMedium.copyWith(color: AppColors.bgPrimary),
        ),
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool accent;

  const _InfoTile({required this.icon, required this.label, this.onTap, this.accent = false});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppColors.textTertiary),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyMedium.copyWith(
                  color: accent ? AppColors.accent : AppColors.textPrimary,
                ),
              ),
            ),
            if (onTap != null)
              Icon(Icons.open_in_new, size: 16, color: AppColors.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _SuccessOverlay extends StatefulWidget {
  const _SuccessOverlay();

  @override
  State<_SuccessOverlay> createState() => _SuccessOverlayState();
}

class _SuccessOverlayState extends State<_SuccessOverlay> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );

    _scale = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.15), weight: 30),
      TweenSequenceItem(tween: Tween(begin: 1.15, end: 0.95), weight: 15),
      TweenSequenceItem(tween: Tween(begin: 0.95, end: 1.0), weight: 15),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 15),
    ]).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _opacity = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: 1.0), weight: 20),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 1.0), weight: 60),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.0), weight: 20),
    ]).animate(_controller);

    _controller.forward().then((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (_, __) => Opacity(
        opacity: _opacity.value,
        child: Center(
          child: Transform.scale(
            scale: _scale.value,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: AppColors.success,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.success.withValues(alpha: 0.4),
                    blurRadius: 24,
                    spreadRadius: 4,
                  ),
                ],
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_rounded, size: 48, color: Colors.white),
                  const SizedBox(height: 4),
                  Text(
                    'Trimis!',
                    style: AppTypography.labelMedium.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PinchRequestCard extends ConsumerStatefulWidget {
  final int businessId;
  final bool isLoggedIn;

  const _PinchRequestCard({
    required this.businessId,
    required this.isLoggedIn,
  });

  @override
  ConsumerState<_PinchRequestCard> createState() => _PinchRequestCardState();
}

class _PinchRequestCardState extends ConsumerState<_PinchRequestCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  bool _showSuccess = false;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    final success = await ref
        .read(offerRequestProvider(widget.businessId).notifier)
        .submitRequest();
    if (success && mounted) {
      // Auto-follow: subscribe if not already following
      final subsState = ref.read(subscriptionsProvider);
      if (!subsState.subscribedIds.contains(widget.businessId)) {
        ref.read(subscriptionsProvider.notifier).toggleSubscription(widget.businessId);
      }

      setState(() => _showSuccess = true);
      _pulseCtrl.forward(from: 0).then((_) {
        if (mounted) {
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) setState(() => _showSuccess = false);
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final pinchState = ref.watch(offerRequestProvider(widget.businessId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.accent.withValues(alpha: 0.12),
                AppColors.accent.withValues(alpha: 0.05),
              ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
            border: Border.all(color: AppColors.accent.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              // Icon + title
              Icon(
                Icons.campaign_outlined,
                size: 36,
                color: AppColors.accent,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Nicio ofertă activă',
                style: AppTypography.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'Cere business-ului să publice o ofertă!',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),

              // Request count badge
              if (pinchState.total > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.bgSecondary,
                      borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                    ),
                    child: Text(
                      '${pinchState.total} ${pinchState.total == 1 ? 'persoană a cerut' : 'persoane au cerut'} deja',
                      style: AppTypography.caption.copyWith(color: AppColors.textSecondary),
                    ),
                  ),
                ),

              // CTA Button
              if (!widget.isLoggedIn)
                // Not logged in — show info text
                Text(
                  'Conectează-te pentru a cere o ofertă',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                  textAlign: TextAlign.center,
                )
              else if (_showSuccess)
                // Success state
                AnimatedBuilder(
                  animation: _pulseCtrl,
                  builder: (_, __) => Transform.scale(
                    scale: 1.0 + (_pulseCtrl.value * 0.05),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.success,
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.check_circle, size: 20, color: Colors.white),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă!',
                            style: AppTypography.labelLarge.copyWith(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else if (pinchState.userRequested && pinchState.daysRemaining != null && pinchState.daysRemaining! > 0)
                // Already requested this week
                Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.bgSecondary,
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 20, color: AppColors.textTertiary),
                          const SizedBox(width: 8),
                          Text(
                            'Cerere trimisă',
                            style: AppTypography.labelLarge.copyWith(color: AppColors.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Poți cere din nou peste ${pinchState.daysRemaining} ${pinchState.daysRemaining == 1 ? 'zi' : 'zile'}',
                      style: AppTypography.caption.copyWith(color: AppColors.textTertiary),
                    ),
                  ],
                )
              else
                // Can request
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: pinchState.isSubmitting ? null : _handleSubmit,
                    icon: pinchState.isSubmitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.bgPrimary),
                          )
                        : const Icon(Icons.notifications_active, size: 20),
                    label: Text(pinchState.isSubmitting ? 'Se trimite...' : 'Vreau o ofertă!'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: AppColors.bgPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

class _BookingChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _BookingChip({required this.icon, required this.label, required this.onTap});

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
