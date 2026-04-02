import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/storage/preferences.dart';
import '../../widgets/orange_glow_wave.dart';
import '../../app.dart';
import '../../services/analytics_service.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;

  List<_OnboardingPage> _getPages(AppLocalizations l10n) => [
    _OnboardingPage(
      icon: Icons.local_offer_outlined,
      title: l10n.onboardingTitle1,
      description: l10n.onboardingDesc1,
      trustIcon: Icons.shield_outlined,
      trustTitle: l10n.onboardingTrust1,
      trustDesc: l10n.onboardingTrustDesc1,
    ),
    _OnboardingPage(
      icon: Icons.store_outlined,
      title: l10n.onboardingTitle2,
      description: l10n.onboardingDesc2,
      trustIcon: Icons.verified_outlined,
      trustTitle: l10n.onboardingTrust2,
      trustDesc: l10n.onboardingTrustDesc2,
    ),
    _OnboardingPage(
      icon: Icons.savings_outlined,
      title: l10n.onboardingTitle3,
      description: l10n.onboardingDesc3,
      trustIcon: Icons.auto_awesome_outlined,
      trustTitle: l10n.onboardingTrust3,
      trustDesc: l10n.onboardingTrustDesc3,
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _complete() async {
    await AppPreferences.setOnboardingDone();
    AnalyticsService.trackOnboardingComplete();
    if (mounted) {
      ref.invalidate(onboardingDoneProvider);
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final pages = _getPages(l10n);
    return Scaffold(
      body: Stack(
        children: [
          // Orange glow wave background
          const Positioned.fill(
            child: ExcludeSemantics(child: OrangeGlowWave()),
          ),
          // Content
          SafeArea(
            child: Column(
              children: [
                // Skip button
                Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: GestureDetector(
                  onTap: _complete,
                  child: Text(
                    l10n.onboardingSkip,
                    style: AppTypography.labelMedium.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),

            // Pages
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: pages.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemBuilder: (_, i) {
                  final page = pages[i];
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xxl,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Icon with glow
                        Container(
                          width: 140,
                          height: 140,
                          decoration: BoxDecoration(
                            color: AppColors.accentMuted,
                            borderRadius: BorderRadius.circular(36),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.accent.withValues(alpha: 0.15),
                                blurRadius: 40,
                                spreadRadius: 0,
                              ),
                            ],
                          ),
                          child: Icon(
                            page.icon,
                            size: 60,
                            color: AppColors.accent,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxxl),

                        // Title
                        Text(
                          page.title,
                          style: AppTypography.displayMedium,
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.lg),

                        // Description
                        Text(
                          page.description,
                          style: AppTypography.bodyLarge.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.6,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: AppSpacing.xxl),

                        // Trust badge
                        AnimatedOpacity(
                          opacity: _currentPage == i ? 1.0 : 0.0,
                          duration: const Duration(milliseconds: 400),
                          curve: Curves.easeOut,
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.bgCard,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Icon(
                                  page.trustIcon,
                                  size: 26,
                                  color: AppColors.accent,
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        page.trustTitle,
                                        style:
                                            AppTypography.labelLarge.copyWith(
                                              color: AppColors.textPrimary,
                                            ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        page.trustDesc,
                                        style:
                                            AppTypography.bodySmall.copyWith(
                                              color: AppColors.textTertiary,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Dots indicator
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(pages.length, (i) {
                  final isActive = i == _currentPage;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: isActive ? 28 : 8,
                    height: 8,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      gradient: isActive
                          ? const LinearGradient(
                              colors: AppColors.accentGradient,
                            )
                          : null,
                      color: isActive ? null : AppColors.bgSecondary,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  );
                }),
              ),
            ),

            // Action button
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xxl,
                0,
                AppSpacing.xxl,
                AppSpacing.xxxl,
              ),
              child: SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  onPressed: () {
                    if (_currentPage < pages.length - 1) {
                      _pageController.nextPage(
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeInOut,
                      );
                    } else {
                      _complete();
                    }
                  },
                  child: Text(
                    _currentPage < pages.length - 1 ? l10n.onboardingContinue : l10n.onboardingStart,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
        ],
      ),
    );
  }
}

class _OnboardingPage {
  final IconData icon;
  final String title;
  final String description;
  final IconData trustIcon;
  final String trustTitle;
  final String trustDesc;

  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.description,
    required this.trustIcon,
    required this.trustTitle,
    required this.trustDesc,
  });
}
