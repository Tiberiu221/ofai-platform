import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../../core/theme/app_spacing.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Confidentialitate'),
        backgroundColor: AppColors.bgPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Politica de Confidentialitate',
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
    title: '1. Introducere',
    body:
        'Aceasta politica de confidentialitate descrie modul in care OFAI colecteaza, utilizeaza si protejeaza datele personale ale utilizatorilor platformei. Ne angajam sa respectam dreptul dvs. la viata privata si sa protejam datele personale in conformitate cu GDPR si legislatia romaneasca.',
  ),
  _Section(
    title: '2. Date Personale Colectate',
    body:
        '2.1 Date furnizate direct:\n'
        '\u2022 Nume si prenume\n'
        '\u2022 Adresa de email\n'
        '\u2022 Parola (stocata criptat)\n'
        '\u2022 Preferinte (oras, categorii)\n\n'
        '2.2 Date colectate automat:\n'
        '\u2022 Adresa IP\n'
        '\u2022 Tipul dispozitivului si sistemul de operare\n'
        '\u2022 Activitatea pe platforma (vizualizari, favorite, abonamente)\n\n'
        '2.3 Date pe care NU le colectam:\n'
        '\u2022 Date financiare sau bancare\n'
        '\u2022 Date biometrice\n'
        '\u2022 Date sensibile (rasa, religie, orientare politica)',
  ),
  _Section(
    title: '3. Scopurile Prelucrarii',
    body:
        'Datele personale sunt prelucrate pentru:\n\n'
        '\u2022 Furnizarea si imbunatatirea serviciilor platformei\n'
        '\u2022 Personalizarea continutului si ofertelor\n'
        '\u2022 Comunicarea cu utilizatorii (notificari, suport)\n'
        '\u2022 Analiza si statistici agregate (anonimizate)\n'
        '\u2022 Prevenirea fraudelor si asigurarea securitatii',
  ),
  _Section(
    title: '4. Localizare GPS',
    body:
        'Aplicatia poate solicita accesul la localizarea dispozitivului pentru a va arata oferte si afaceri din apropierea dvs. Aceasta permisiune este optionala si poate fi revocata din setarile dispozitivului.',
  ),
  _Section(
    title: '5. Partajarea Datelor',
    body:
        'Nu vindem si nu inchiriem datele personale ale utilizatorilor. Datele pot fi partajate doar cu:\n\n'
        '\u2022 Furnizorii de servicii tehnice (hosting, email) — sub contracte de prelucrare\n'
        '\u2022 Autoritatile competente — cand legislatia o impune',
  ),
  _Section(
    title: '6. Securitatea Datelor',
    body:
        'Implementam masuri tehnice si organizatorice adecvate pentru protectia datelor, inclusiv criptarea comunicatiilor (HTTPS/TLS), stocarea securizata a parolelor si monitorizarea accesului.',
  ),
  _Section(
    title: '7. Perioada de Stocare',
    body:
        'Datele personale sunt stocate pe durata existentei contului. La stergerea contului, datele sunt eliminate definitiv in termen de 30 de zile.',
  ),
  _Section(
    title: '8. Drepturile Dvs. (GDPR)',
    body:
        'Aveti urmatoarele drepturi:\n\n'
        '\u2022 Dreptul de acces la datele personale\n'
        '\u2022 Dreptul la rectificarea datelor incorecte\n'
        '\u2022 Dreptul la stergerea datelor (dreptul de a fi uitat)\n'
        '\u2022 Dreptul la portabilitatea datelor\n'
        '\u2022 Dreptul de a va opune prelucrarii\n'
        '\u2022 Dreptul de a depune plangere la ANSPDCP\n\n'
        'Puteti exercita aceste drepturi din setarile contului sau contactandu-ne.',
  ),
  _Section(
    title: '9. Cookie-uri',
    body:
        'Platforma web utilizeaza cookie-uri esentiale pentru functionare. Aplicatia mobila nu utilizeaza cookie-uri, ci stocarea securizata locala a dispozitivului.',
  ),
  _Section(
    title: '10. Contact',
    body:
        'Pentru orice intrebari legate de confidentialitate sau pentru exercitarea drepturilor GDPR, ne puteti contacta prin sectiunea de ajutor a aplicatiei.',
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
