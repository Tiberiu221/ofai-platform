import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';
import 'package:ofai_flutter/l10n/app_localizations.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.helpTitle),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l10n.helpSubtitle, style: AppTypography.headlineLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.helpDescription,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xxl),

            // Contact cards
            _ContactCard(
              icon: Icons.email_outlined,
              title: l10n.helpEmailTitle,
              subtitle: l10n.helpEmailValue,
              onTap: () => _launchUrl('mailto:contact@ofai.ro'),
            ),
            const SizedBox(height: AppSpacing.md),
            _ContactCard(
              icon: Icons.phone_outlined,
              title: l10n.helpPhoneTitle,
              subtitle: l10n.helpPhoneValue,
              onTap: () => _launchUrl('tel:+40700000000'),
            ),

            const SizedBox(height: AppSpacing.xxxl),

            // FAQ
            Text(l10n.helpFaqTitle, style: AppTypography.headlineMedium),
            const SizedBox(height: AppSpacing.lg),
            ..._getFaqItems(l10n).map((faq) => _FaqItem(faq: faq)),

            const SizedBox(height: AppSpacing.xxxl),

            // Useful links
            Text(l10n.helpLinksTitle, style: AppTypography.headlineMedium),
            const SizedBox(height: AppSpacing.lg),
            _LinkItem(
              label: l10n.helpTermsLink,
              onTap: () => context.push('/terms'),
            ),
            _LinkItem(
              label: l10n.helpPrivacyLink,
              onTap: () => context.push('/privacy'),
            ),

            const SizedBox(height: AppSpacing.huge),
          ],
        ),
      ),
    );
  }

  static Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

List<_Faq> _getFaqItems(AppLocalizations l10n) => [
  _Faq(question: l10n.helpFaq1Q, answer: l10n.helpFaq1A),
  _Faq(question: l10n.helpFaq2Q, answer: l10n.helpFaq2A),
  _Faq(question: l10n.helpFaq3Q, answer: l10n.helpFaq3A),
  _Faq(question: l10n.helpFaq4Q, answer: l10n.helpFaq4A),
  _Faq(question: l10n.helpFaq5Q, answer: l10n.helpFaq5A),
  _Faq(question: l10n.helpFaq6Q, answer: l10n.helpFaq6A),
  _Faq(question: l10n.helpFaq7Q, answer: l10n.helpFaq7A),
  _Faq(question: l10n.helpFaq8Q, answer: l10n.helpFaq8A),
];

class _ContactCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ContactCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.bgGlass,
              borderRadius: BorderRadius.circular(AppSpacing.cardRadius),
              border: Border.all(color: AppColors.borderLight, width: 0.5),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.accentMuted,
                    borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
                  ),
                  child: Icon(icon, color: AppColors.accent, size: 24),
                ),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: AppTypography.labelLarge),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: AppTypography.bodyMedium.copyWith(color: AppColors.accent),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.open_in_new, size: 16, color: AppColors.textTertiary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Faq {
  final String question;
  final String answer;
  _Faq({required this.question, required this.answer});
}

class _FaqItem extends StatefulWidget {
  final _Faq faq;
  const _FaqItem({required this.faq});

  @override
  State<_FaqItem> createState() => _FaqItemState();
}

class _FaqItemState extends State<_FaqItem> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: GestureDetector(
        onTap: () => setState(() => _expanded = !_expanded),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: _expanded ? AppColors.bgCardHover : AppColors.bgCard,
            borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
            border: Border.all(
              color: _expanded ? AppColors.accent.withValues(alpha: 0.3) : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(widget.faq.question, style: AppTypography.labelLarge),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.keyboard_arrow_down,
                      color: _expanded ? AppColors.accent : AppColors.textTertiary,
                      size: 20,
                    ),
                  ),
                ],
              ),
              AnimatedCrossFade(
                firstChild: const SizedBox.shrink(),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.md),
                  child: Text(
                    widget.faq.answer,
                    style: AppTypography.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ),
                crossFadeState: _expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                duration: const Duration(milliseconds: 200),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LinkItem extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _LinkItem({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.cardRadiusSm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            Icon(Icons.arrow_forward, size: 16, color: AppColors.accent),
            const SizedBox(width: AppSpacing.sm),
            Text(
              label,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.accent),
            ),
          ],
        ),
      ),
    );
  }
}
