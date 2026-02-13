import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../providers/auth_provider.dart';
import '../../providers/favorites_provider.dart';
import '../../providers/subscriptions_provider.dart';
import '../../providers/business_requests_provider.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _didFetch = false;

  void _tryFetch() {
    final auth = ref.read(authProvider);
    if (auth.status == AuthStatus.authenticated && !_didFetch) {
      _didFetch = true;
      ref.read(favoritesProvider.notifier).fetch();
      ref.read(subscriptionsProvider.notifier).fetch();
      ref.read(businessRequestsProvider.notifier).fetchMyRequests();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final isLoggedIn = auth.status == AuthStatus.authenticated;
    final user = auth.user;

    // Listen for auth changes to trigger fetch
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated && !_didFetch) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _tryFetch());
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

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: AppSpacing.pageH,
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.xxl),

              // Avatar + name
              CircleAvatar(
                radius: 40,
                backgroundColor: AppColors.accent,
                child: Text(
                  user?.initials ?? 'U',
                  style: AppTypography.displaySmall.copyWith(
                    color: AppColors.bgPrimary,
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

              // Business request status card
              if (bizReqState.latestRequest != null) ...[
                const SizedBox(height: AppSpacing.lg),
                _BusinessRequestStatusCard(request: bizReqState.latestRequest!),
              ],

              const SizedBox(height: AppSpacing.xxxl),

              // Menu items
              _MenuItem(
                icon: Icons.add_business,
                label: 'Adauga un business',
                onTap: () => context.push('/business-request'),
                accent: true,
              ),
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
              _MenuItem(
                icon: Icons.lock_outline,
                label: 'Schimba parola',
                onTap: () => context.push('/account/change-password'),
              ),

              const SizedBox(height: AppSpacing.xxl),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),

              _MenuItem(
                icon: Icons.download_outlined,
                label: 'Exporta datele mele',
                onTap: () => context.push('/account/data-export'),
              ),
              _MenuItem(
                icon: Icons.description_outlined,
                label: 'Termeni si conditii',
                onTap: () => _openWebPage('https://ofai.ro/termeni'),
              ),
              _MenuItem(
                icon: Icons.privacy_tip_outlined,
                label: 'Confidentialitate',
                onTap: () => _openWebPage('https://ofai.ro/confidentialitate'),
              ),
              _MenuItem(
                icon: Icons.help_outline,
                label: 'Ajutor',
                onTap: () => _openWebPage('https://ofai.ro/ajutor'),
              ),

              const SizedBox(height: AppSpacing.xxl),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),

              _MenuItem(
                icon: Icons.logout,
                label: 'Deconectare',
                onTap: () {
                  ref.read(authProvider.notifier).logout();
                },
                danger: true,
              ),

              const SizedBox(height: AppSpacing.xxl),
              const Divider(),
              const SizedBox(height: AppSpacing.lg),

              _MenuItem(
                icon: Icons.delete_forever_outlined,
                label: 'Sterge contul',
                onTap: () => context.push('/account/delete-account'),
                danger: true,
              ),

              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openWebPage(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
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
  final bool accent;
  final bool danger;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.accent = false,
    this.danger = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = danger
        ? AppColors.danger
        : accent
            ? AppColors.accent
            : AppColors.textPrimary;

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
