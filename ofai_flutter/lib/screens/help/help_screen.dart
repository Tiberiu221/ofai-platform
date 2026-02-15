import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Ajutor & Suport'),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Cum te putem ajuta?', style: AppTypography.headlineLarge),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Echipa OFAI iti sta la dispozitie. Raspundem in medie in mai putin de 24 de ore.',
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xxl),

            // Contact cards
            _ContactCard(
              icon: Icons.email_outlined,
              title: 'Email',
              subtitle: 'contact@ofai.ro',
              onTap: () => _launchUrl('mailto:contact@ofai.ro'),
            ),
            const SizedBox(height: AppSpacing.md),
            _ContactCard(
              icon: Icons.phone_outlined,
              title: 'Telefon',
              subtitle: '+40 700 000 000',
              onTap: () => _launchUrl('tel:+40700000000'),
            ),

            const SizedBox(height: AppSpacing.xxxl),

            // FAQ
            Text('Intrebari frecvente', style: AppTypography.headlineMedium),
            const SizedBox(height: AppSpacing.lg),
            ..._faqItems.map((faq) => _FaqItem(faq: faq)),

            const SizedBox(height: AppSpacing.xxxl),

            // Useful links
            Text('Link-uri utile', style: AppTypography.headlineMedium),
            const SizedBox(height: AppSpacing.lg),
            _LinkItem(
              label: 'Termeni si conditii',
              onTap: () => Navigator.of(context).pushNamed('/terms'),
            ),
            _LinkItem(
              label: 'Politica de confidentialitate',
              onTap: () => Navigator.of(context).pushNamed('/privacy'),
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

final _faqItems = [
  _Faq(
    question: 'Cum functioneaza platforma?',
    answer:
        'OFAI iti permite sa descoperi oferte si reduceri de la afaceri locale. Poti cauta dupa oras, categorie sau cuvinte cheie, salva ofertele favorite si urmari business-urile preferate.',
  ),
  _Faq(
    question: 'Cum castig puncte?',
    answer:
        'Castigi puncte pentru activitatea ta pe platforma: scrierea de recenzii, vizitarea zilnica a aplicatiei si interactiunea cu ofertele.',
  ),
  _Faq(
    question: 'Cum pot folosi punctele?',
    answer:
        'Punctele acumulate pot fi folosite pentru a debloca oferte exclusive sau beneficii speciale pe platforma.',
  ),
  _Faq(
    question: 'Cum schimb orasul?',
    answer:
        'Mergi in Cont > Preferinte si selecteaza orasul dorit. Ofertele si business-urile vor fi filtrate automat.',
  ),
  _Faq(
    question: 'Cum urmaresc un business?',
    answer:
        'Deschide pagina business-ului si apasa butonul "Urmareste". Vei primi notificari cand business-ul adauga oferte noi.',
  ),
  _Faq(
    question: 'Cum las o recenzie?',
    answer:
        'Deschide pagina business-ului si apasa "Scrie recenzie". Alege un rating de la 1 la 5 stele si optional lasa un comentariu.',
  ),
  _Faq(
    question: 'Cum imi sterg contul?',
    answer:
        'Mergi in Cont > Sterge contul. Aceasta actiune este ireversibila si toate datele tale vor fi sterse permanent.',
  ),
  _Faq(
    question: 'Cum pot inregistra un business?',
    answer:
        'Din Cont, apasa "Adauga un business" si completeaza formularul. Echipa noastra va analiza cererea si te va notifica.',
  ),
];

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
