import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Termeni si conditii'),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Termeni si Conditii de Utilizare',
              style: AppTypography.headlineLarge,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Ultima actualizare: Ianuarie 2025',
              style: AppTypography.caption,
            ),
            const SizedBox(height: AppSpacing.xxl),
            ..._sections.map((s) => _SectionWidget(section: s)),
            const SizedBox(height: AppSpacing.huge),
          ],
        ),
      ),
    );
  }
}

final _sections = [
  _Section(
    title: '1. Acceptarea Termenilor',
    body:
        'Prin accesarea si utilizarea platformei OFAI, acceptati acesti termeni si conditii in totalitate. Daca nu sunteti de acord cu oricare dintre acesti termeni, va rugam sa nu utilizati platforma.',
  ),
  _Section(
    title: '2. Descrierea Serviciului',
    body:
        'OFAI este o platforma digitala care permite utilizatorilor sa descopere oferte si reduceri de la afaceri locale din Romania. Serviciul include listarea ofertelor, recenzii, sistem de puncte si notificari.',
  ),
  _Section(
    title: '3. Inregistrarea Contului',
    body:
        'Pentru a utiliza anumite functionalitati ale platformei, trebuie sa va creati un cont. Sunteti responsabili pentru mentinerea confidentialitatii datelor de autentificare si pentru toate activitatile care au loc sub contul dvs.',
  ),
  _Section(
    title: '4. Utilizare Acceptabila',
    body:
        'Va angajati sa utilizati platforma in conformitate cu legile aplicabile si sa nu:\n\n'
        '\u2022 Publicati continut fals, inselator sau defaimator\n'
        '\u2022 Incercati sa accesati neautorizat sisteme sau date\n'
        '\u2022 Utilizati platforma pentru spam sau activitati comerciale neautorizate\n'
        '\u2022 Interferati cu functionarea normala a platformei',
  ),
  _Section(
    title: '5. Recenzii si Continut Utilizator',
    body:
        'Utilizatorii pot lasa recenzii pentru afacerile listate pe platforma. Recenziile trebuie sa fie oneste, relevante si sa respecte regulile comunitatii. Ne rezervam dreptul de a modera sau sterge continut care incalca aceste reguli.',
  ),
  _Section(
    title: '6. Sistemul de Puncte',
    body:
        'OFAI ofera un sistem de puncte pentru activitatea pe platforma. Punctele sunt acordate pentru actiuni precum scrierea de recenzii. Detaliile despre acumularea si utilizarea punctelor sunt disponibile in sectiunea de ajutor.',
  ),
  _Section(
    title: '7. Ofertele si Afacerile',
    body:
        'Ofertele listate pe platforma sunt furnizate de afacerile partenere. OFAI nu garanteaza disponibilitatea, acuratetea sau calitatea ofertelor. Responsabilitatea pentru onorarea ofertelor revine exclusiv afacerilor respective.',
  ),
  _Section(
    title: '8. Proprietate Intelectuala',
    body:
        'Continutul platformei, inclusiv design-ul, logo-urile, textele si codul sursa, este protejat de drepturile de proprietate intelectuala. Nu aveti dreptul sa reproduceti, distribuiti sau modificati acest continut fara acordul nostru scris.',
  ),
  _Section(
    title: '9. Limitarea Raspunderii',
    body:
        'OFAI nu este responsabil pentru pierderi sau daune rezultate din utilizarea platformei, inclusiv dar fara a se limita la pierderi financiare, pierderea datelor sau intreruperi ale serviciului.',
  ),
  _Section(
    title: '10. Suspendare si Reziliere',
    body:
        'Ne rezervam dreptul de a suspenda sau inchide contul dvs. in cazul incalcarii acestor termeni. Puteti solicita stergerea contului in orice moment din setarile aplicatiei.',
  ),
  _Section(
    title: '11. Legea Aplicabila',
    body:
        'Acesti termeni sunt guvernati de legislatia din Romania. Orice disputa va fi solutionata de instantele competente din Romania.',
  ),
  _Section(
    title: '12. Contact',
    body:
        'Pentru intrebari legate de acesti termeni, ne puteti contacta la adresa de email disponibila in sectiunea de ajutor a aplicatiei.',
  ),
];

class _Section {
  final String title;
  final String body;
  _Section({required this.title, required this.body});
}

class _SectionWidget extends StatelessWidget {
  final _Section section;
  const _SectionWidget({required this.section});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(section.title, style: AppTypography.headlineSmall),
          const SizedBox(height: AppSpacing.sm),
          Text(
            section.body,
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.textSecondary,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}
