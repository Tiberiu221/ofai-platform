import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/followed_businesses_provider.dart';
import '../../providers/gamification_provider.dart';
import '../../widgets/initial_avatar.dart';
import '../../core/network/api_client.dart';
import '../../core/network/api_endpoints.dart';
import '../../core/utils/launchers.dart';
import '../../widgets/orange_glow_wave.dart';
import '../../core/network/api_exceptions.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  bool _didFetch = false;

  Future<void> _showReferralSheet(BuildContext context) async {
    String? code;
    Map<String, dynamic>? stats;
    try {
      final results = await Future.wait([
        ApiClient().dio.get(ApiEndpoints.referralCode),
        ApiClient().dio.get(ApiEndpoints.referralStats),
      ]);
      code = results[0].data['referral_code'] as String?;
      stats = results[1].data as Map<String, dynamic>?;
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context)!.referralError)),
        );
      }
      return;
    }
    if (code == null || !context.mounted) return;
    final referralCode = code;
    final totalReferrals = stats?['total_referrals'] ?? 0;
    final totalPoints = stats?['total_points_earned'] ?? 0;
    final referrals = (stats?['referrals'] as List?) ?? [];

    final shareText = AppLocalizations.of(context)!.shareText(referralCode);

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 32, height: 4, decoration: BoxDecoration(color: AppColors.textTertiary, borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: AppSpacing.xxl),
              const Icon(Icons.card_giftcard, color: AppColors.accent, size: 48),
              const SizedBox(height: AppSpacing.lg),
              Text(AppLocalizations.of(context)!.inviteFriends, style: AppTypography.headlineSmall),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AppLocalizations.of(context)!.inviteSubtitle,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
              // Referral stats
              if (totalReferrals > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _StatChip(icon: Icons.people, label: AppLocalizations.of(context)!.invitedCount(totalReferrals as int)),
                    const SizedBox(width: AppSpacing.md),
                    _StatChip(icon: Icons.star, label: AppLocalizations.of(context)!.pointsCount(totalPoints as int)),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                // Recent referrals list
                if (referrals.isNotEmpty)
                  Container(
                    constraints: const BoxConstraints(maxHeight: 120),
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: referrals.length > 5 ? 5 : referrals.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
                      itemBuilder: (_, i) {
                        final r = referrals[i];
                        final name = r['first_name'] ?? AppLocalizations.of(context)!.user;
                        final date = DateTime.tryParse(r['created_at'] ?? '');
                        final ago = date != null ? _timeAgo(context, date) : '';
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            children: [
                              const Icon(Icons.person_add, size: 16, color: AppColors.accent),
                              const SizedBox(width: 8),
                              Text(name, style: AppTypography.bodySmall),
                              const Spacer(),
                              Text(ago, style: AppTypography.bodySmall.copyWith(color: AppColors.textTertiary)),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
              ],
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.bgCard,
                  borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      referralCode,
                      style: AppTypography.labelLarge.copyWith(
                        fontFamily: 'monospace',
                        letterSpacing: 2,
                        color: AppColors.accent,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Launchers.shareText(shareText);
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.share, size: 20),
                  label: Text(AppLocalizations.of(context)!.sendInvite),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }

  String _timeAgo(BuildContext context, DateTime date) {
    final l10n = AppLocalizations.of(context)!;
    final diff = DateTime.now().difference(date);
    if (diff.inDays > 30) return l10n.timeAgoMonths((diff.inDays / 30).floor());
    if (diff.inDays > 0) return l10n.timeAgoDays(diff.inDays);
    if (diff.inHours > 0) return l10n.timeAgoHours(diff.inHours);
    return l10n.timeAgoRecent;
  }

  void _tryFetch() {
    final auth = ref.read(authProvider);
    if (auth.status == AuthStatus.authenticated && !_didFetch) {
      _didFetch = true;
      ref.read(favoritesProvider.notifier).fetch();
      ref.read(followedBusinessesProvider.notifier).fetch();
      ref.read(gamificationProvider.notifier).fetch();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;
    final user = auth.user;

    // Listen for auth changes to trigger fetch or reset
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated && !_didFetch) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
      } else if (next.status == AuthStatus.unauthenticated) {
        _didFetch = false;
      }
    });

    if (!isLoggedIn) {
      return Scaffold(
        body: Stack(
          children: [
            const Positioned.fill(child: ExcludeSemantics(child: OrangeGlowWave())),
            SafeArea(
              child: Padding(
                padding: AppSpacing.pageH,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.person_outline,
                      size: 80,
                      color: AppColors.textTertiary,
                    ),
                    const SizedBox(height: AppSpacing.xxl),
                    Text(
                      AppLocalizations.of(context)!.welcomeTitle,
                      style: AppTypography.displaySmall,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AppLocalizations.of(context)!.loginToAccessAccount,
                      style: AppTypography.bodyLarge.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: AppSpacing.xxxl),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => context.push('/login'),
                        child: Text(AppLocalizations.of(context)!.login),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => context.push('/register'),
                        child: Text(AppLocalizations.of(context)!.createAccount),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Trigger fetch after auth confirmed
    if (!_didFetch) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
    }

    final favState = ref.watch(favoritesProvider);
    final subState = ref.watch(followedBusinessesProvider);
    // gamification UI hidden — ref.watch removed to avoid unused variable warning
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.pageH,
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.xxl),

              // Avatar + name
              Semantics(
                label: 'Schimbă poza de profil',
                button: true,
                child: GestureDetector(
                onTap: () => _showProfilePictureOptions(context, ref),
                child: Stack(
                  children: [
                    if (user?.profilePictureUrl != null)
                      CircleAvatar(
                        radius: 40,
                        backgroundImage: NetworkImage(user!.profilePictureUrl!),
                        backgroundColor: AppColors.bgSecondary,
                      )
                    else
                      InitialAvatar(
                        initials: user?.initials ?? 'U',
                        radius: 40,
                        backgroundColor: AppColors.accent,
                        textStyle: AppTypography.displaySmall.copyWith(
                          color: AppColors.bgPrimary,
                        ),
                      ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.bgPrimary, width: 2),
                        ),
                        child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                user?.displayName ?? '',
                style: AppTypography.headlineLarge,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                user?.email ?? '',
                style: AppTypography.bodyMedium.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),

              const SizedBox(height: AppSpacing.xxl),

              // Stats row
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      icon: Icons.bookmark_outline,
                      value: '${favState.favoriteIds.length}',
                      label: AppLocalizations.of(context)!.favorites,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.notifications_none,
                      value: '${subState.followedIds.length}',
                      label: AppLocalizations.of(context)!.following,
                    ),
                  ),
                ],
              ),

              // Gamification card — hidden from UI (backend still tracks points/levels)
              // To re-enable: uncomment the block below
              // if (!gamState.isLoading && gamState.points > 0) ...[
              //   ... gamification UI ...
              // ],

              // Badges card (glassmorphism)
              if (user?.badges case final userBadges? when userBadges.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.04),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        boxShadow: [
                          // Inner glow top
                          BoxShadow(
                            color: Colors.white.withValues(alpha: 0.03),
                            blurRadius: 0,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                            child: Row(
                              children: [
                                Text(AppLocalizations.of(context)!.badgesEarned, style: AppTypography.labelLarge),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.accent,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    '${userBadges.length}',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: AppColors.bgPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                            child: Text(AppLocalizations.of(context)!.selectForReviews, style: AppTypography.captionMuted),
                          ),
                          // Badge strip
                          SizedBox(
                            height: 110,
                            child: ShaderMask(
                              shaderCallback: (Rect bounds) {
                                return LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.transparent,
                                    Colors.white,
                                    Colors.white,
                                    Colors.transparent,
                                  ],
                                  stops: const [0.0, 0.05, 0.95, 1.0],
                                ).createShader(bounds);
                              },
                              blendMode: BlendMode.dstIn,
                              child: ListView(
                                scrollDirection: Axis.horizontal,
                                physics: const BouncingScrollPhysics(),
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                children: [
                                  _BadgeChip(
                                    badge: null,
                                    isSelected: user?.displayBadgeId == null,
                                    onTap: () => _updateDisplayBadge(ref, null),
                                  ),
                                  ...userBadges.map((badge) => _BadgeChip(
                                    badge: badge,
                                    isSelected: user?.displayBadgeId == badge.id,
                                    onTap: () => _updateDisplayBadge(ref, badge.id),
                                  )),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: AppSpacing.lg),

              // Menu items
              _MenuItem(
                icon: Icons.person_outline,
                label: AppLocalizations.of(context)!.myProfile,
                onTap: () => context.push('/account/edit-profile'),
              ),
              _MenuItem(
                icon: Icons.tune_outlined,
                label: AppLocalizations.of(context)!.preferences,
                onTap: () => context.push('/account/preferences'),
              ),
              _MenuItem(
                icon: Icons.saved_search,
                label: AppLocalizations.of(context)!.savedSearches,
                onTap: () => context.push('/account/saved-searches'),
              ),
              _MenuItem(
                icon: Icons.flag_outlined,
                label: AppLocalizations.of(context)!.myReports,
                onTap: () => context.push('/account/my-reports'),
              ),
              if (user?.hasPassword ?? true)
                _MenuItem(
                  icon: Icons.lock_outline,
                  label: AppLocalizations.of(context)!.changePassword,
                  onTap: () => context.push('/account/change-password'),
                ),
              _MenuItem(
                icon: Icons.card_giftcard,
                label: AppLocalizations.of(context)!.inviteFriends,
                onTap: () => _showReferralSheet(context),
              ),
              _MenuItem(
                icon: Icons.help_outline,
                label: AppLocalizations.of(context)!.help,
                onTap: () => context.push('/help'),
              ),

              const SizedBox(height: AppSpacing.lg),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),

              _MenuItem(
                icon: Icons.logout,
                label: AppLocalizations.of(context)!.logout,
                onTap: () {
                  ref.read(authProvider.notifier).logout();
                },
              ),

              // Footer links
              const SizedBox(height: AppSpacing.xxxl * 2),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.xs,
                children: [
                  _FooterLink(
                    label: AppLocalizations.of(context)!.terms,
                    onTap: () => context.push('/terms'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  _FooterLink(
                    label: AppLocalizations.of(context)!.privacy,
                    onTap: () => context.push('/privacy'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  _FooterLink(
                    label: AppLocalizations.of(context)!.addBusiness,
                    onTap: () => launchUrl(Uri.parse('https://ofai.ro/pentru-business'), mode: LaunchMode.externalApplication),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.md,
                children: [
                  _FooterLink(
                    label: AppLocalizations.of(context)!.exportData,
                    onTap: () => context.push('/account/data-export'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  GestureDetector(
                    onTap: () => context.push('/account/delete-account'),
                    child: Text(
                      AppLocalizations.of(context)!.deleteAccount,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.danger.withValues(alpha: 0.5),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxxl),
            ],
          ),
        ),
      ),
    );
  }

  void _showProfilePictureOptions(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSecondary,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library, color: AppColors.accent),
              title: Text(AppLocalizations.of(context)!.profilePickGallery),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUploadImage(context, ref);
              },
            ),
            if (ref.read(authProvider).user?.profilePictureUrl != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: Text(AppLocalizations.of(context)!.profileDeletePhoto),
                onTap: () {
                  Navigator.pop(ctx);
                  _deleteProfilePicture(context, ref);
                },
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickAndUploadImage(BuildContext context, WidgetRef ref) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 600,
        maxHeight: 600,
        imageQuality: 85,
      );
      if (picked == null) return;

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context)!.profileUploading)),
      );

      await ref.read(authProvider.notifier).updateProfilePicture(picked.path);

      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context)!.profileUpdated)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${friendlyError(e)}')),
      );
    }
  }

  Future<void> _deleteProfilePicture(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(authProvider.notifier).deleteProfilePicture();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AppLocalizations.of(context)!.profileDeleted)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${friendlyError(e)}')),
      );
    }
  }

  Future<void> _updateDisplayBadge(WidgetRef ref, int? badgeId) async {
    try {
      await ref.read(authProvider.notifier).updateDisplayBadge(badgeId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(badgeId != null ? AppLocalizations.of(context)!.badgeSelected : AppLocalizations.of(context)!.badgeDeselected)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${friendlyError(e)}')),
      );
    }
  }
}

class _BadgeChip extends StatelessWidget {
  final UserBadge? badge;
  final bool isSelected;
  final VoidCallback? onTap;
  const _BadgeChip({this.badge, this.isSelected = false, this.onTap});

  @override
  Widget build(BuildContext context) {
    final isNone = badge == null;
    final color = isNone ? AppColors.textTertiary : _parseColor(badge!.color);
    final label = isNone ? 'Fără insignă' : badge!.name;

    return GestureDetector(
      onTap: onTap,
      child: Tooltip(
        message: badge?.description ?? label,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: SizedBox(
            width: 80,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Circle with optional checkmark overlay
                AnimatedScale(
                  scale: isSelected ? 1.08 : 1.0,
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  child: SizedBox(
                    width: 58,
                    height: 58,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        // Main circle
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          curve: Curves.easeOut,
                          width: 54,
                          height: 54,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isNone
                                ? AppColors.bgSecondary
                                : color.withValues(alpha: 0.12),
                            border: Border.all(
                              color: isSelected
                                  ? color
                                  : color.withValues(alpha: 0.30),
                              width: isSelected ? 2.5 : 1,
                            ),
                            boxShadow: isSelected && !isNone
                                ? [
                                    BoxShadow(
                                      color: color.withValues(alpha: 0.40),
                                      blurRadius: 14,
                                      spreadRadius: 0,
                                    ),
                                  ]
                                : [],
                          ),
                          child: Center(
                            child: Icon(
                              isNone ? Icons.close_rounded : Icons.star_rounded,
                              size: isNone ? 20 : 24,
                              color: isNone
                                  ? AppColors.textTertiary
                                  : (isSelected ? color : color.withValues(alpha: 0.7)),
                            ),
                          ),
                        ),
                        // Checkmark overlay (bottom-right) when selected
                        if (isSelected && !isNone)
                          Positioned(
                            right: 0,
                            bottom: 0,
                            child: Container(
                              width: 18,
                              height: 18,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: color,
                                border: Border.all(
                                  color: AppColors.bgPrimary,
                                  width: 2,
                                ),
                              ),
                              child: const Icon(
                                Icons.check,
                                size: 10,
                                color: Colors.white,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                // Label — 2 lines
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    fontSize: 10,
                    height: 1.2,
                    color: isSelected ? color : AppColors.textTertiary,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _parseColor(String hex) {
    hex = hex.replaceFirst('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.lg,
        horizontal: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.accent, size: 24),
          const SizedBox(height: AppSpacing.xs),
          Text(
            value,
            style: AppTypography.headlineMedium.copyWith(
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const color = AppColors.textPrimary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyLarge.copyWith(color: color),
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
  }
}

class _FooterLink extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _FooterLink({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(
          color: AppColors.textTertiary,
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _StatChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.bgCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: AppColors.accent),
          const SizedBox(width: 6),
          Text(label, style: AppTypography.bodySmall),
        ],
      ),
    );
  }
}
