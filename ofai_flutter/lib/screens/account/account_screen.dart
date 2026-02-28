import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../models/user.dart';
import '../../providers/auth_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/subscriptions_provider.dart';
import '../../providers/business_requests_provider.dart';
import '../../providers/gamification_provider.dart';
import '../../widgets/initial_avatar.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  bool _didFetch = false;

  void _tryFetch() {
    final auth = ref.read(authProvider);
    if (auth.status == AuthStatus.authenticated && !_didFetch) {
      _didFetch = true;
      ref.read(favoritesProvider.notifier).fetch();
      ref.read(subscriptionsProvider.notifier).fetch();
      ref.read(businessRequestsProvider.notifier).fetchMyRequests();
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
        body: SafeArea(
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
                  'Bine ai venit!',
                  style: AppTypography.displaySmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Conecteaza-te pentru a accesa contul tau',
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
                    child: const Text('Conecteaza-te'),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => context.push('/register'),
                    child: const Text('Creeaza cont'),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Trigger fetch after auth confirmed
    if (!_didFetch) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
    }

    final favState = ref.watch(favoritesProvider);
    final subState = ref.watch(subscriptionsProvider);
    final bizReqState = ref.watch(businessRequestsProvider);
    final gamState = ref.watch(gamificationProvider);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.pageH,
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.xxl),

              // Avatar + name
              GestureDetector(
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
                      icon: Icons.star_outline,
                      value: '${user?.points ?? 0}',
                      label: 'Puncte',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.bookmark_outline,
                      value: '${favState.favoriteIds.length}',
                      label: 'Favorite',
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: _StatCard(
                      icon: Icons.notifications_none,
                      value: '${subState.subscribedIds.length}',
                      label: 'Urmariri',
                    ),
                  ),
                ],
              ),

              // Badges section (selectable for review display)
              if (user?.badges != null && user!.badges!.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.lg),
                Text('Insigne', style: AppTypography.labelLarge),
                Text('Selectează una pentru a o afișa în recenzii', style: AppTypography.captionMuted),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _BadgeChip(
                      badge: null,
                      isSelected: user!.displayBadgeId == null,
                      onTap: () => _updateDisplayBadge(ref, null),
                    ),
                    ...user!.badges!.map((badge) => _BadgeChip(
                      badge: badge,
                      isSelected: user!.displayBadgeId == badge.id,
                      onTap: () => _updateDisplayBadge(ref, badge.id),
                    )),
                  ],
                ),
              ],

              // Gamification card
              if (gamState.points > 0) ...[
                const SizedBox(height: AppSpacing.lg),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.accent.withValues(alpha: 0.1),
                        AppColors.accent.withValues(alpha: 0.03),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
                    border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Level header
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.accent,
                              borderRadius: BorderRadius.circular(AppSpacing.pillRadius),
                            ),
                            child: Text(
                              'Nivel ${gamState.level}',
                              style: AppTypography.labelSmall.copyWith(color: AppColors.bgPrimary),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(gamState.levelName, style: AppTypography.labelLarge),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),

                      // Progress bar
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: gamState.progress,
                          backgroundColor: AppColors.bgSecondary,
                          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.accent),
                          minHeight: 6,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${gamState.points} / ${gamState.nextLevelPoints} puncte',
                        style: AppTypography.captionMuted,
                      ),

                    ],
                  ),
                ),
              ],

              // Business request status card
              if (bizReqState.latestRequest != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _BusinessRequestStatusCard(request: bizReqState.latestRequest!),
              ],

              const SizedBox(height: AppSpacing.xxxl),

              // Menu items
              _MenuItem(
                icon: Icons.person_outline,
                label: 'Profilul meu',
                onTap: () => context.push('/account/edit-profile'),
              ),
              _MenuItem(
                icon: Icons.tune_outlined,
                label: 'Preferinte',
                onTap: () => context.push('/account/preferences'),
              ),
              if (user?.hasPassword ?? true)
                _MenuItem(
                  icon: Icons.lock_outline,
                  label: 'Schimba parola',
                  onTap: () => context.push('/account/change-password'),
                ),
              _SwitchMenuItem(
                icon: Icons.face_outlined,
                label: 'Arată poza în recenzii',
                value: user?.showPictureInReviews ?? true,
                onChanged: (val) async {
                  try {
                    await ref.read(authProvider.notifier).updateShowPictureInReviews(val);
                  } catch (_) {
                    if (!mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Eroare la salvare'), backgroundColor: AppColors.danger),
                    );
                  }
                },
              ),
              _MenuItem(
                icon: Icons.help_outline,
                label: 'Ajutor',
                onTap: () => context.push('/help'),
              ),

              const SizedBox(height: AppSpacing.lg),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),

              _MenuItem(
                icon: Icons.logout,
                label: 'Deconectare',
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
                    label: 'Termeni',
                    onTap: () => context.push('/terms'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  _FooterLink(
                    label: 'Confidentialitate',
                    onTap: () => context.push('/privacy'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  _FooterLink(
                    label: 'Adauga business',
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
                    label: 'Exporta datele',
                    onTap: () => context.push('/account/data-export'),
                  ),
                  Text('·', style: AppTypography.bodySmall.copyWith(color: AppColors.textMuted)),
                  GestureDetector(
                    onTap: () => context.push('/account/delete-account'),
                    child: Text(
                      'Sterge contul',
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
              title: const Text('Alege din galerie'),
              onTap: () {
                Navigator.pop(ctx);
                _pickAndUploadImage(context, ref);
              },
            ),
            if (ref.read(authProvider).user?.profilePictureUrl != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Sterge poza'),
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
        const SnackBar(content: Text('Se incarca poza...')),
      );

      await ref.read(authProvider.notifier).updateProfilePicture(picked.path);

      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Poza de profil actualizata!')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${e.toString()}')),
      );
    }
  }

  Future<void> _deleteProfilePicture(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(authProvider.notifier).deleteProfilePicture();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Poza de profil stearsa')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${e.toString()}')),
      );
    }
  }

  Future<void> _updateDisplayBadge(WidgetRef ref, int? badgeId) async {
    try {
      await ref.read(authProvider.notifier).updateDisplayBadge(badgeId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(badgeId != null ? 'Insignă selectată!' : 'Insignă dezactivată')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Eroare: ${e.toString()}')),
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
    // "Niciuna" chip when badge is null
    if (badge == null) {
      return GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.accent.withValues(alpha: 0.15) : AppColors.bgSecondary,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isSelected ? AppColors.accent : AppColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.close, size: 14, color: isSelected ? AppColors.accent : AppColors.textTertiary),
              const SizedBox(width: 4),
              Text(
                'Niciuna',
                style: AppTypography.caption.copyWith(
                  color: isSelected ? AppColors.accent : AppColors.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final color = _parseColor(badge!.color);
    return GestureDetector(
      onTap: onTap,
      child: Tooltip(
        message: badge!.description ?? badge!.name,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? color.withValues(alpha: 0.2) : color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? color : color.withValues(alpha: 0.3),
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(isSelected ? Icons.star : Icons.verified, size: 14, color: color),
              const SizedBox(width: 4),
              Text(
                badge!.name,
                style: AppTypography.caption.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
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

class _BusinessRequestStatusCard extends StatelessWidget {
  final dynamic request;

  const _BusinessRequestStatusCard({required this.request});

  @override
  Widget build(BuildContext context) {
    Color statusColor;
    IconData statusIcon;
    String statusText;

    if (request.isPending) {
      statusColor = Colors.amber;
      statusIcon = Icons.hourglass_top;
      statusText = 'Cererea ta este in asteptare';
    } else if (request.isApproved) {
      statusColor = Colors.green;
      statusIcon = Icons.check_circle_outline;
      statusText = 'Business-ul tau a fost aprobat!';
    } else {
      statusColor = AppColors.danger;
      statusIcon = Icons.cancel_outlined;
      statusText = 'Cererea a fost respinsa';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(statusIcon, color: statusColor, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  statusText,
                  style: AppTypography.labelMedium.copyWith(color: statusColor),
                ),
              ),
            ],
          ),
          if (request.isRejected && request.adminNotes != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              request.adminNotes!,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xs),
          Text(
            request.name,
            style: AppTypography.bodySmall.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
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

class _SwitchMenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _SwitchMenuItem({
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.xs,
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textPrimary, size: 22),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Text(
              label,
              style: AppTypography.bodyLarge.copyWith(color: AppColors.textPrimary),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: AppColors.accent,
            activeTrackColor: AppColors.accent.withValues(alpha: 0.3),
            inactiveThumbColor: AppColors.textTertiary,
            inactiveTrackColor: AppColors.bgSecondary,
          ),
        ],
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
