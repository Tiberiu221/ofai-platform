import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ro.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ro'),
  ];

  /// No description provided for @navHome.
  ///
  /// In ro, this message translates to:
  /// **'Acasa'**
  String get navHome;

  /// No description provided for @navExplore.
  ///
  /// In ro, this message translates to:
  /// **'Exploreaza'**
  String get navExplore;

  /// No description provided for @navCollection.
  ///
  /// In ro, this message translates to:
  /// **'Colectia mea'**
  String get navCollection;

  /// No description provided for @navAccount.
  ///
  /// In ro, this message translates to:
  /// **'Cont'**
  String get navAccount;

  /// No description provided for @inviteFriends.
  ///
  /// In ro, this message translates to:
  /// **'Invita prieteni'**
  String get inviteFriends;

  /// No description provided for @inviteSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Trimite link-ul tau prietenilor si descopera impreuna cele mai bune oferte!'**
  String get inviteSubtitle;

  /// No description provided for @invitedCount.
  ///
  /// In ro, this message translates to:
  /// **'{count} invitati'**
  String invitedCount(int count);

  /// No description provided for @pointsCount.
  ///
  /// In ro, this message translates to:
  /// **'{count} puncte'**
  String pointsCount(int count);

  /// No description provided for @sendInvite.
  ///
  /// In ro, this message translates to:
  /// **'Trimite invitatia'**
  String get sendInvite;

  /// No description provided for @referralError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la incarcarea codului de referral'**
  String get referralError;

  /// No description provided for @myProfile.
  ///
  /// In ro, this message translates to:
  /// **'Profilul meu'**
  String get myProfile;

  /// No description provided for @myReports.
  ///
  /// In ro, this message translates to:
  /// **'Rapoartele mele'**
  String get myReports;

  /// No description provided for @settings.
  ///
  /// In ro, this message translates to:
  /// **'Setari'**
  String get settings;

  /// No description provided for @changePassword.
  ///
  /// In ro, this message translates to:
  /// **'Schimba parola'**
  String get changePassword;

  /// No description provided for @help.
  ///
  /// In ro, this message translates to:
  /// **'Ajutor'**
  String get help;

  /// No description provided for @logout.
  ///
  /// In ro, this message translates to:
  /// **'Deconectare'**
  String get logout;

  /// No description provided for @login.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te'**
  String get login;

  /// No description provided for @offlineMessage.
  ///
  /// In ro, this message translates to:
  /// **'Esti offline'**
  String get offlineMessage;

  /// No description provided for @timeAgoMonths.
  ///
  /// In ro, this message translates to:
  /// **'{count} luni'**
  String timeAgoMonths(int count);

  /// No description provided for @timeAgoDays.
  ///
  /// In ro, this message translates to:
  /// **'{count} zile'**
  String timeAgoDays(int count);

  /// No description provided for @timeAgoHours.
  ///
  /// In ro, this message translates to:
  /// **'{count} ore'**
  String timeAgoHours(int count);

  /// No description provided for @timeAgoRecent.
  ///
  /// In ro, this message translates to:
  /// **'recent'**
  String get timeAgoRecent;

  /// No description provided for @user.
  ///
  /// In ro, this message translates to:
  /// **'Utilizator'**
  String get user;

  /// No description provided for @authWelcomeBack.
  ///
  /// In ro, this message translates to:
  /// **'Bine ai revenit!'**
  String get authWelcomeBack;

  /// No description provided for @authLoginSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te pentru a continua'**
  String get authLoginSubtitle;

  /// No description provided for @authEmail.
  ///
  /// In ro, this message translates to:
  /// **'Email'**
  String get authEmail;

  /// No description provided for @authPassword.
  ///
  /// In ro, this message translates to:
  /// **'Parola'**
  String get authPassword;

  /// No description provided for @authEmailRequired.
  ///
  /// In ro, this message translates to:
  /// **'Email obligatoriu'**
  String get authEmailRequired;

  /// No description provided for @authEmailInvalid.
  ///
  /// In ro, this message translates to:
  /// **'Email invalid'**
  String get authEmailInvalid;

  /// No description provided for @authPasswordRequired.
  ///
  /// In ro, this message translates to:
  /// **'Parola obligatorie'**
  String get authPasswordRequired;

  /// No description provided for @authForgotPassword.
  ///
  /// In ro, this message translates to:
  /// **'Ai uitat parola?'**
  String get authForgotPassword;

  /// No description provided for @authLoginButton.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te'**
  String get authLoginButton;

  /// No description provided for @authOr.
  ///
  /// In ro, this message translates to:
  /// **'sau'**
  String get authOr;

  /// No description provided for @authContinueGoogle.
  ///
  /// In ro, this message translates to:
  /// **'Continua cu Google'**
  String get authContinueGoogle;

  /// No description provided for @authNoAccount.
  ///
  /// In ro, this message translates to:
  /// **'Nu ai cont? '**
  String get authNoAccount;

  /// No description provided for @authRegister.
  ///
  /// In ro, this message translates to:
  /// **'Inregistreaza-te'**
  String get authRegister;

  /// No description provided for @authLoginError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la autentificare'**
  String get authLoginError;

  /// No description provided for @authGoogleError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la autentificarea cu Google'**
  String get authGoogleError;

  /// No description provided for @authCreateAccount.
  ///
  /// In ro, this message translates to:
  /// **'Creeaza cont'**
  String get authCreateAccount;

  /// No description provided for @authRegisterSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Completeaza datele pentru a te inregistra'**
  String get authRegisterSubtitle;

  /// No description provided for @authFirstName.
  ///
  /// In ro, this message translates to:
  /// **'Prenume'**
  String get authFirstName;

  /// No description provided for @authLastName.
  ///
  /// In ro, this message translates to:
  /// **'Nume'**
  String get authLastName;

  /// No description provided for @authRequired.
  ///
  /// In ro, this message translates to:
  /// **'Obligatoriu'**
  String get authRequired;

  /// No description provided for @authPasswordMin8.
  ///
  /// In ro, this message translates to:
  /// **'Minim 8 caractere'**
  String get authPasswordMin8;

  /// No description provided for @authPasswordNeedsDigit.
  ///
  /// In ro, this message translates to:
  /// **'Trebuie sa contina cel putin o cifra'**
  String get authPasswordNeedsDigit;

  /// No description provided for @authAccept.
  ///
  /// In ro, this message translates to:
  /// **'Accept '**
  String get authAccept;

  /// No description provided for @authTerms.
  ///
  /// In ro, this message translates to:
  /// **'Termenii'**
  String get authTerms;

  /// No description provided for @authAnd.
  ///
  /// In ro, this message translates to:
  /// **' si '**
  String get authAnd;

  /// No description provided for @authPrivacyPolicy.
  ///
  /// In ro, this message translates to:
  /// **'Politica de confidentialitate'**
  String get authPrivacyPolicy;

  /// No description provided for @authAcceptTermsError.
  ///
  /// In ro, this message translates to:
  /// **'Trebuie sa accepti termenii si politica de confidentialitate.'**
  String get authAcceptTermsError;

  /// No description provided for @authRegisterButton.
  ///
  /// In ro, this message translates to:
  /// **'Creeaza cont'**
  String get authRegisterButton;

  /// No description provided for @authRegisterError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la inregistrare'**
  String get authRegisterError;

  /// No description provided for @authHasAccount.
  ///
  /// In ro, this message translates to:
  /// **'Ai deja cont? '**
  String get authHasAccount;

  /// No description provided for @authForgotTitle.
  ///
  /// In ro, this message translates to:
  /// **'Ai uitat parola?'**
  String get authForgotTitle;

  /// No description provided for @authForgotSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Introdu adresa de email si iti vom trimite un cod de resetare.'**
  String get authForgotSubtitle;

  /// No description provided for @authSendCode.
  ///
  /// In ro, this message translates to:
  /// **'Trimite codul'**
  String get authSendCode;

  /// No description provided for @authCodeSent.
  ///
  /// In ro, this message translates to:
  /// **'Daca exista un cont cu acest email, vei primi un cod de resetare.'**
  String get authCodeSent;

  /// No description provided for @authSendCodeError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la trimiterea codului. Incearca din nou.'**
  String get authSendCodeError;

  /// No description provided for @authRememberPassword.
  ///
  /// In ro, this message translates to:
  /// **'Ti-ai amintit parola? '**
  String get authRememberPassword;

  /// No description provided for @authVerifyTitle.
  ///
  /// In ro, this message translates to:
  /// **'Verifica codul'**
  String get authVerifyTitle;

  /// No description provided for @authCodeSentTo.
  ///
  /// In ro, this message translates to:
  /// **'Am trimis un cod de 6 cifre la {email}'**
  String authCodeSentTo(String email);

  /// No description provided for @authExpiresIn.
  ///
  /// In ro, this message translates to:
  /// **'Expira in {time}'**
  String authExpiresIn(String time);

  /// No description provided for @authCodeExpired.
  ///
  /// In ro, this message translates to:
  /// **'Cod expirat'**
  String get authCodeExpired;

  /// No description provided for @authEnterAllDigits.
  ///
  /// In ro, this message translates to:
  /// **'Introdu toate cele 6 cifre'**
  String get authEnterAllDigits;

  /// No description provided for @authInvalidCode.
  ///
  /// In ro, this message translates to:
  /// **'Cod invalid sau expirat'**
  String get authInvalidCode;

  /// No description provided for @authVerifyButton.
  ///
  /// In ro, this message translates to:
  /// **'Verifica'**
  String get authVerifyButton;

  /// No description provided for @authNoCode.
  ///
  /// In ro, this message translates to:
  /// **'Nu ai primit codul? '**
  String get authNoCode;

  /// No description provided for @authResend.
  ///
  /// In ro, this message translates to:
  /// **'Retrimite'**
  String get authResend;

  /// No description provided for @authResending.
  ///
  /// In ro, this message translates to:
  /// **'Se trimite...'**
  String get authResending;

  /// No description provided for @authNewCodeSent.
  ///
  /// In ro, this message translates to:
  /// **'Cod nou trimis!'**
  String get authNewCodeSent;

  /// No description provided for @authResendError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la retrimitere'**
  String get authResendError;

  /// No description provided for @authNewPassword.
  ///
  /// In ro, this message translates to:
  /// **'Parola noua'**
  String get authNewPassword;

  /// No description provided for @authNewPasswordSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Alege o parola noua pentru contul tau.'**
  String get authNewPasswordSubtitle;

  /// No description provided for @authNewPasswordLabel.
  ///
  /// In ro, this message translates to:
  /// **'Parola noua'**
  String get authNewPasswordLabel;

  /// No description provided for @authConfirmPassword.
  ///
  /// In ro, this message translates to:
  /// **'Confirma parola'**
  String get authConfirmPassword;

  /// No description provided for @authPasswordIsRequired.
  ///
  /// In ro, this message translates to:
  /// **'Parola este obligatorie'**
  String get authPasswordIsRequired;

  /// No description provided for @authConfirmRequired.
  ///
  /// In ro, this message translates to:
  /// **'Confirmarea este obligatorie'**
  String get authConfirmRequired;

  /// No description provided for @authPasswordsMismatch.
  ///
  /// In ro, this message translates to:
  /// **'Parolele nu coincid'**
  String get authPasswordsMismatch;

  /// No description provided for @authResetButton.
  ///
  /// In ro, this message translates to:
  /// **'Reseteaza parola'**
  String get authResetButton;

  /// No description provided for @authResetSuccess.
  ///
  /// In ro, this message translates to:
  /// **'Parola a fost schimbata cu succes!'**
  String get authResetSuccess;

  /// No description provided for @authResetError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la resetarea parolei. Codul poate fi expirat.'**
  String get authResetError;

  /// No description provided for @onboardingSkip.
  ///
  /// In ro, this message translates to:
  /// **'Sari peste'**
  String get onboardingSkip;

  /// No description provided for @onboardingContinue.
  ///
  /// In ro, this message translates to:
  /// **'Continua'**
  String get onboardingContinue;

  /// No description provided for @onboardingStart.
  ///
  /// In ro, this message translates to:
  /// **'Incepe'**
  String get onboardingStart;

  /// No description provided for @onboardingTitle1.
  ///
  /// In ro, this message translates to:
  /// **'Descopera oferte'**
  String get onboardingTitle1;

  /// No description provided for @onboardingDesc1.
  ///
  /// In ro, this message translates to:
  /// **'Gaseste reduceri verificate de la frizerii, restaurante, fitness si 12+ categorii din orasul tau.'**
  String get onboardingDesc1;

  /// No description provided for @onboardingTrust1.
  ///
  /// In ro, this message translates to:
  /// **'100% Gratuit'**
  String get onboardingTrust1;

  /// No description provided for @onboardingTrustDesc1.
  ///
  /// In ro, this message translates to:
  /// **'Fara costuri ascunse, fara abonamente'**
  String get onboardingTrustDesc1;

  /// No description provided for @onboardingTitle2.
  ///
  /// In ro, this message translates to:
  /// **'Urmareste business-uri'**
  String get onboardingTitle2;

  /// No description provided for @onboardingDesc2.
  ///
  /// In ro, this message translates to:
  /// **'Aboneaza-te la business-urile preferate si primeste notificari cand apar oferte noi.'**
  String get onboardingDesc2;

  /// No description provided for @onboardingTrust2.
  ///
  /// In ro, this message translates to:
  /// **'Business-uri Verificate'**
  String get onboardingTrust2;

  /// No description provided for @onboardingTrustDesc2.
  ///
  /// In ro, this message translates to:
  /// **'Echipa OFAI verifica fiecare partener'**
  String get onboardingTrustDesc2;

  /// No description provided for @onboardingTitle3.
  ///
  /// In ro, this message translates to:
  /// **'Economiseste mai mult'**
  String get onboardingTitle3;

  /// No description provided for @onboardingDesc3.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza ofertele la favorite, dezvaluie coduri promo si profita de reduceri exclusive.'**
  String get onboardingDesc3;

  /// No description provided for @onboardingTrust3.
  ///
  /// In ro, this message translates to:
  /// **'Oferte Personalizate'**
  String get onboardingTrust3;

  /// No description provided for @onboardingTrustDesc3.
  ///
  /// In ro, this message translates to:
  /// **'Bazate pe orasul si preferintele tale'**
  String get onboardingTrustDesc3;

  /// No description provided for @homeSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Cele mai bune oferte din orasul tau'**
  String get homeSubtitle;

  /// No description provided for @searchHint.
  ///
  /// In ro, this message translates to:
  /// **'Cauta oferte, business-uri...'**
  String get searchHint;

  /// No description provided for @categories.
  ///
  /// In ro, this message translates to:
  /// **'Categorii'**
  String get categories;

  /// No description provided for @discoverCities.
  ///
  /// In ro, this message translates to:
  /// **'Descopera orase'**
  String get discoverCities;

  /// No description provided for @dealOfDay.
  ///
  /// In ro, this message translates to:
  /// **'Oferta Zilei'**
  String get dealOfDay;

  /// No description provided for @flashOffers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte Flash'**
  String get flashOffers;

  /// No description provided for @collections.
  ///
  /// In ro, this message translates to:
  /// **'Colectii'**
  String get collections;

  /// No description provided for @offersCount.
  ///
  /// In ro, this message translates to:
  /// **'{count} oferte'**
  String offersCount(int count);

  /// No description provided for @recentlyViewed.
  ///
  /// In ro, this message translates to:
  /// **'Vazute recent'**
  String get recentlyViewed;

  /// No description provided for @forYou.
  ///
  /// In ro, this message translates to:
  /// **'Pentru tine'**
  String get forYou;

  /// No description provided for @popularOffers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte populare'**
  String get popularOffers;

  /// No description provided for @noOffersAvailable.
  ///
  /// In ro, this message translates to:
  /// **'Nicio oferta disponibila'**
  String get noOffersAvailable;

  /// No description provided for @checkBackLater.
  ///
  /// In ro, this message translates to:
  /// **'Revino mai tarziu pentru oferte noi'**
  String get checkBackLater;

  /// No description provided for @errorLoadingOffers.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-au putut incarca ofertele'**
  String get errorLoadingOffers;

  /// No description provided for @promotedOffers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte Promovate'**
  String get promotedOffers;

  /// No description provided for @partnerBusinesses.
  ///
  /// In ro, this message translates to:
  /// **'Business-uri partenere'**
  String get partnerBusinesses;

  /// No description provided for @businesses.
  ///
  /// In ro, this message translates to:
  /// **'Business-uri'**
  String get businesses;

  /// No description provided for @noBusinessAvailable.
  ///
  /// In ro, this message translates to:
  /// **'Niciun business disponibil'**
  String get noBusinessAvailable;

  /// No description provided for @checkBackLaterShort.
  ///
  /// In ro, this message translates to:
  /// **'Revino mai tarziu'**
  String get checkBackLaterShort;

  /// No description provided for @errorLoadingBusinesses.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-au putut incarca business-urile'**
  String get errorLoadingBusinesses;

  /// No description provided for @seeAll.
  ///
  /// In ro, this message translates to:
  /// **'Vezi toate'**
  String get seeAll;

  /// No description provided for @explore.
  ///
  /// In ro, this message translates to:
  /// **'Exploreaza'**
  String get explore;

  /// No description provided for @cityFilter.
  ///
  /// In ro, this message translates to:
  /// **'Oras'**
  String get cityFilter;

  /// No description provided for @categoryFilter.
  ///
  /// In ro, this message translates to:
  /// **'Categorie'**
  String get categoryFilter;

  /// No description provided for @saveSearch.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza'**
  String get saveSearch;

  /// No description provided for @resetFilters.
  ///
  /// In ro, this message translates to:
  /// **'Reseteaza'**
  String get resetFilters;

  /// No description provided for @offers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte'**
  String get offers;

  /// No description provided for @showingResults.
  ///
  /// In ro, this message translates to:
  /// **'Afisand {count} din {total} {type}'**
  String showingResults(int count, int total, String type);

  /// No description provided for @noOfferFound.
  ///
  /// In ro, this message translates to:
  /// **'Nicio oferta gasita'**
  String get noOfferFound;

  /// No description provided for @tryOtherFilters.
  ///
  /// In ro, this message translates to:
  /// **'Incearca alte filtre sau cauta altceva'**
  String get tryOtherFilters;

  /// No description provided for @noBusinessFound.
  ///
  /// In ro, this message translates to:
  /// **'Niciun business gasit'**
  String get noBusinessFound;

  /// No description provided for @searchSaved.
  ///
  /// In ro, this message translates to:
  /// **'Cautare salvata!'**
  String get searchSaved;

  /// No description provided for @searchSaveError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la salvare (max 10)'**
  String get searchSaveError;

  /// No description provided for @locationUnavailable.
  ///
  /// In ro, this message translates to:
  /// **'Locatia nu este disponibila'**
  String get locationUnavailable;

  /// No description provided for @locationError.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-a putut determina locatia'**
  String get locationError;

  /// No description provided for @recentSearches.
  ///
  /// In ro, this message translates to:
  /// **'Cautari recente'**
  String get recentSearches;

  /// No description provided for @deleteAll.
  ///
  /// In ro, this message translates to:
  /// **'Sterge tot'**
  String get deleteAll;

  /// No description provided for @myPreferences.
  ///
  /// In ro, this message translates to:
  /// **'Preferintele mele'**
  String get myPreferences;

  /// No description provided for @chooseCity.
  ///
  /// In ro, this message translates to:
  /// **'Alege orasul'**
  String get chooseCity;

  /// No description provided for @allCities.
  ///
  /// In ro, this message translates to:
  /// **'Toate orasele'**
  String get allCities;

  /// No description provided for @chooseCategory.
  ///
  /// In ro, this message translates to:
  /// **'Alege categoria'**
  String get chooseCategory;

  /// No description provided for @allCategories.
  ///
  /// In ro, this message translates to:
  /// **'Toate categoriile'**
  String get allCategories;

  /// No description provided for @sorting.
  ///
  /// In ro, this message translates to:
  /// **'Sortare'**
  String get sorting;

  /// No description provided for @sortDefault.
  ///
  /// In ro, this message translates to:
  /// **'Implicit'**
  String get sortDefault;

  /// No description provided for @sortPopular.
  ///
  /// In ro, this message translates to:
  /// **'Populare'**
  String get sortPopular;

  /// No description provided for @sortDiscount.
  ///
  /// In ro, this message translates to:
  /// **'Reducere maxima'**
  String get sortDiscount;

  /// No description provided for @sortEndingSoon.
  ///
  /// In ro, this message translates to:
  /// **'Expira curand'**
  String get sortEndingSoon;

  /// No description provided for @sortDistance.
  ///
  /// In ro, this message translates to:
  /// **'Distanta'**
  String get sortDistance;

  /// No description provided for @loginToSaveOffers.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te pentru a salva oferte'**
  String get loginToSaveOffers;

  /// No description provided for @loginToSaveSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza ofertele preferate si urmareste business-urile favorite'**
  String get loginToSaveSubtitle;

  /// No description provided for @signIn.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te'**
  String get signIn;

  /// No description provided for @myCollection.
  ///
  /// In ro, this message translates to:
  /// **'Colectia mea'**
  String get myCollection;

  /// No description provided for @searchInOffers.
  ///
  /// In ro, this message translates to:
  /// **'Cauta in oferte...'**
  String get searchInOffers;

  /// No description provided for @searchInBusinesses.
  ///
  /// In ro, this message translates to:
  /// **'Cauta in business-uri...'**
  String get searchInBusinesses;

  /// No description provided for @sortNameAZ.
  ///
  /// In ro, this message translates to:
  /// **'Nume A-Z'**
  String get sortNameAZ;

  /// No description provided for @sortRating.
  ///
  /// In ro, this message translates to:
  /// **'Rating'**
  String get sortRating;

  /// No description provided for @sortDiscountShort.
  ///
  /// In ro, this message translates to:
  /// **'Reducere'**
  String get sortDiscountShort;

  /// No description provided for @sortEndingSoonShort.
  ///
  /// In ro, this message translates to:
  /// **'Expira curand'**
  String get sortEndingSoonShort;

  /// No description provided for @sortDistanceShort.
  ///
  /// In ro, this message translates to:
  /// **'Distanta'**
  String get sortDistanceShort;

  /// No description provided for @loadingError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la incarcare'**
  String get loadingError;

  /// No description provided for @retry.
  ///
  /// In ro, this message translates to:
  /// **'Reincearca'**
  String get retry;

  /// No description provided for @noFavoriteOffers.
  ///
  /// In ro, this message translates to:
  /// **'Nu ai oferte favorite'**
  String get noFavoriteOffers;

  /// No description provided for @noFavoriteOffersSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza oferte din pagina de explorare sau din detaliile unei oferte'**
  String get noFavoriteOffersSubtitle;

  /// No description provided for @noResults.
  ///
  /// In ro, this message translates to:
  /// **'Niciun rezultat'**
  String get noResults;

  /// No description provided for @noFavoriteOfferMatch.
  ///
  /// In ro, this message translates to:
  /// **'Nicio oferta favorita nu corespunde cautarii'**
  String get noFavoriteOfferMatch;

  /// No description provided for @removedFromFavorites.
  ///
  /// In ro, this message translates to:
  /// **'{name} eliminata din favorite'**
  String removedFromFavorites(String name);

  /// No description provided for @cancel.
  ///
  /// In ro, this message translates to:
  /// **'Anuleaza'**
  String get cancel;

  /// No description provided for @removeError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la eliminare'**
  String get removeError;

  /// No description provided for @noFollowedBusinesses.
  ///
  /// In ro, this message translates to:
  /// **'Nu urmaresti niciun business'**
  String get noFollowedBusinesses;

  /// No description provided for @noFollowedBusinessesSubtitle.
  ///
  /// In ro, this message translates to:
  /// **'Urmareste business-uri pentru a primi notificari despre ofertele lor'**
  String get noFollowedBusinessesSubtitle;

  /// No description provided for @noFollowedBusinessMatch.
  ///
  /// In ro, this message translates to:
  /// **'Niciun business urmarit nu corespunde cautarii'**
  String get noFollowedBusinessMatch;

  /// No description provided for @removedFromFollowed.
  ///
  /// In ro, this message translates to:
  /// **'{name} eliminat din urmarite'**
  String removedFromFollowed(String name);

  /// No description provided for @shareOffer.
  ///
  /// In ro, this message translates to:
  /// **'Distribuie oferta'**
  String get shareOffer;

  /// No description provided for @reportOffer.
  ///
  /// In ro, this message translates to:
  /// **'Raporteaza oferta'**
  String get reportOffer;

  /// No description provided for @reportSent.
  ///
  /// In ro, this message translates to:
  /// **'Raportul a fost trimis. Multumim!'**
  String get reportSent;

  /// No description provided for @report.
  ///
  /// In ro, this message translates to:
  /// **'Raporteaza'**
  String get report;

  /// No description provided for @flashOffer.
  ///
  /// In ro, this message translates to:
  /// **'Oferta flash'**
  String get flashOffer;

  /// No description provided for @offerTitle.
  ///
  /// In ro, this message translates to:
  /// **'Titlu oferta: {title}'**
  String offerTitle(String title);

  /// No description provided for @trending.
  ///
  /// In ro, this message translates to:
  /// **'Trending'**
  String get trending;

  /// No description provided for @saveCount.
  ///
  /// In ro, this message translates to:
  /// **'{count} salvari'**
  String saveCount(int count);

  /// No description provided for @validPeriod.
  ///
  /// In ro, this message translates to:
  /// **'Valabila: {start} - {end}'**
  String validPeriod(String start, String end);

  /// No description provided for @active.
  ///
  /// In ro, this message translates to:
  /// **'Activa'**
  String get active;

  /// No description provided for @expired.
  ///
  /// In ro, this message translates to:
  /// **'Expirata'**
  String get expired;

  /// No description provided for @conditions.
  ///
  /// In ro, this message translates to:
  /// **'Conditii'**
  String get conditions;

  /// No description provided for @howToUseOffer.
  ///
  /// In ro, this message translates to:
  /// **'Cum sa folosesti oferta'**
  String get howToUseOffer;

  /// No description provided for @redemptionCall.
  ///
  /// In ro, this message translates to:
  /// **'Suna si mentioneaza oferta OFAI'**
  String get redemptionCall;

  /// No description provided for @redemptionWhatsapp.
  ///
  /// In ro, this message translates to:
  /// **'Scrie pe WhatsApp si mentioneaza oferta OFAI'**
  String get redemptionWhatsapp;

  /// No description provided for @redemptionOnline.
  ///
  /// In ro, this message translates to:
  /// **'Rezerva online si mentioneaza oferta OFAI'**
  String get redemptionOnline;

  /// No description provided for @redemptionBooking.
  ///
  /// In ro, this message translates to:
  /// **'Mentioneaza oferta OFAI la rezervare'**
  String get redemptionBooking;

  /// No description provided for @redemptionAppointment.
  ///
  /// In ro, this message translates to:
  /// **'Mentioneaza oferta OFAI la programare'**
  String get redemptionAppointment;

  /// No description provided for @redemptionOrder.
  ///
  /// In ro, this message translates to:
  /// **'Mentioneaza oferta OFAI la comanda'**
  String get redemptionOrder;

  /// No description provided for @redemptionCheckout.
  ///
  /// In ro, this message translates to:
  /// **'Aplica codul sau mentioneaza oferta OFAI la checkout'**
  String get redemptionCheckout;

  /// No description provided for @redemptionShowPage.
  ///
  /// In ro, this message translates to:
  /// **'Arata aceasta pagina pentru a beneficia de reducere'**
  String get redemptionShowPage;

  /// No description provided for @redemptionDefault.
  ///
  /// In ro, this message translates to:
  /// **'Mentioneaza oferta OFAI pentru a beneficia de reducere'**
  String get redemptionDefault;

  /// No description provided for @codesExhausted.
  ///
  /// In ro, this message translates to:
  /// **'Codurile s-au epuizat'**
  String get codesExhausted;

  /// No description provided for @codesRemaining.
  ///
  /// In ro, this message translates to:
  /// **'Doar {count} coduri ramase!'**
  String codesRemaining(int count);

  /// No description provided for @business.
  ///
  /// In ro, this message translates to:
  /// **'Business'**
  String get business;

  /// No description provided for @locations.
  ///
  /// In ro, this message translates to:
  /// **'Locatii'**
  String get locations;

  /// No description provided for @booking.
  ///
  /// In ro, this message translates to:
  /// **'Rezervare'**
  String get booking;

  /// No description provided for @phone.
  ///
  /// In ro, this message translates to:
  /// **'Telefon'**
  String get phone;

  /// No description provided for @online.
  ///
  /// In ro, this message translates to:
  /// **'Online'**
  String get online;

  /// No description provided for @similarOffers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte similare'**
  String get similarOffers;

  /// No description provided for @galleryCount.
  ///
  /// In ro, this message translates to:
  /// **'Galerie ({count})'**
  String galleryCount(int count);

  /// No description provided for @galleryImage.
  ///
  /// In ro, this message translates to:
  /// **'Imagine galerie'**
  String get galleryImage;

  /// No description provided for @callNow.
  ///
  /// In ro, this message translates to:
  /// **'Suna acum'**
  String get callNow;

  /// No description provided for @bookOnline.
  ///
  /// In ro, this message translates to:
  /// **'Rezerva online'**
  String get bookOnline;

  /// No description provided for @saved.
  ///
  /// In ro, this message translates to:
  /// **'Salvata'**
  String get saved;

  /// No description provided for @save.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza'**
  String get save;

  /// No description provided for @errorLoadingOffer.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-a putut incarca oferta'**
  String get errorLoadingOffer;

  /// No description provided for @promoCode.
  ///
  /// In ro, this message translates to:
  /// **'Cod Promotional'**
  String get promoCode;

  /// No description provided for @loginToSeeCode.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te pentru a vedea codul'**
  String get loginToSeeCode;

  /// No description provided for @codeUnavailable.
  ///
  /// In ro, this message translates to:
  /// **'Codul nu este disponibil'**
  String get codeUnavailable;

  /// No description provided for @codeLoadError.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-a putut incarca codul'**
  String get codeLoadError;

  /// No description provided for @showCodeAtCheckout.
  ///
  /// In ro, this message translates to:
  /// **'Arata acest cod la casa'**
  String get showCodeAtCheckout;

  /// No description provided for @codeCopied.
  ///
  /// In ro, this message translates to:
  /// **'Cod copiat in clipboard'**
  String get codeCopied;

  /// No description provided for @revealCode.
  ///
  /// In ro, this message translates to:
  /// **'Dezvaluie codul'**
  String get revealCode;

  /// No description provided for @copyCode.
  ///
  /// In ro, this message translates to:
  /// **'Copiaza codul'**
  String get copyCode;

  /// No description provided for @tapForFullscreen.
  ///
  /// In ro, this message translates to:
  /// **'Apasa pentru ecran complet'**
  String get tapForFullscreen;

  /// No description provided for @tryAgain.
  ///
  /// In ro, this message translates to:
  /// **'Incearca din nou'**
  String get tryAgain;

  /// No description provided for @discountLabel.
  ///
  /// In ro, this message translates to:
  /// **'Reducere {label}'**
  String discountLabel(String label);

  /// No description provided for @shareBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Distribuie business'**
  String get shareBusiness;

  /// No description provided for @reportBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Raporteaza business'**
  String get reportBusiness;

  /// No description provided for @thisIsYourBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Acesta este business-ul tau'**
  String get thisIsYourBusiness;

  /// No description provided for @manageOnWeb.
  ///
  /// In ro, this message translates to:
  /// **'Gestioneaza pe Web'**
  String get manageOnWeb;

  /// No description provided for @followersCount.
  ///
  /// In ro, this message translates to:
  /// **'{count} urmaritori'**
  String followersCount(int count);

  /// No description provided for @reviewsCount.
  ///
  /// In ro, this message translates to:
  /// **'({count} recenzii)'**
  String reviewsCount(int count);

  /// No description provided for @writeReview.
  ///
  /// In ro, this message translates to:
  /// **'Scrie recenzie'**
  String get writeReview;

  /// No description provided for @reviewSummary.
  ///
  /// In ro, this message translates to:
  /// **'Rezumat recenzii'**
  String get reviewSummary;

  /// No description provided for @contact.
  ///
  /// In ro, this message translates to:
  /// **'Contact'**
  String get contact;

  /// No description provided for @activeOffers.
  ///
  /// In ro, this message translates to:
  /// **'Oferte active'**
  String get activeOffers;

  /// No description provided for @reviews.
  ///
  /// In ro, this message translates to:
  /// **'Recenzii'**
  String get reviews;

  /// No description provided for @noReviewsYet.
  ///
  /// In ro, this message translates to:
  /// **'Nicio recenzie inca'**
  String get noReviewsYet;

  /// No description provided for @beFirstToReview.
  ///
  /// In ro, this message translates to:
  /// **'Fii primul care scrie o recenzie!'**
  String get beFirstToReview;

  /// No description provided for @loadMoreReviews.
  ///
  /// In ro, this message translates to:
  /// **'Incarca mai multe recenzii'**
  String get loadMoreReviews;

  /// No description provided for @followed.
  ///
  /// In ro, this message translates to:
  /// **'Urmarit'**
  String get followed;

  /// No description provided for @follow.
  ///
  /// In ro, this message translates to:
  /// **'Urmareste'**
  String get follow;

  /// No description provided for @errorLoadingBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-a putut incarca business-ul'**
  String get errorLoadingBusiness;

  /// No description provided for @premiumBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Business Premium'**
  String get premiumBusiness;

  /// No description provided for @verifiedBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Business Verificat'**
  String get verifiedBusiness;

  /// No description provided for @premiumDescription.
  ///
  /// In ro, this message translates to:
  /// **'Acest business are un abonament Premium OFAI. Beneficiaza de vizibilitate sporita, analize avansate si suport prioritar.'**
  String get premiumDescription;

  /// No description provided for @verifiedDescription.
  ///
  /// In ro, this message translates to:
  /// **'Acest business a fost verificat de echipa OFAI. Verificam identitatea, locatia si calitatea serviciilor pentru a asigura o experienta de incredere.'**
  String get verifiedDescription;

  /// No description provided for @writeAReview.
  ///
  /// In ro, this message translates to:
  /// **'Scrie o recenzie'**
  String get writeAReview;

  /// No description provided for @commentHint.
  ///
  /// In ro, this message translates to:
  /// **'Scrie un comentariu (optional)...'**
  String get commentHint;

  /// No description provided for @submitReview.
  ///
  /// In ro, this message translates to:
  /// **'Trimite recenzia'**
  String get submitReview;

  /// No description provided for @submitError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la trimitere'**
  String get submitError;

  /// No description provided for @deleteReviewTitle.
  ///
  /// In ro, this message translates to:
  /// **'Sterge recenzia?'**
  String get deleteReviewTitle;

  /// No description provided for @deleteReviewBody.
  ///
  /// In ro, this message translates to:
  /// **'Recenzia si eventualul raspuns al business-ului vor fi sterse definitiv.'**
  String get deleteReviewBody;

  /// No description provided for @delete.
  ///
  /// In ro, this message translates to:
  /// **'Sterge'**
  String get delete;

  /// No description provided for @reviewDeleted.
  ///
  /// In ro, this message translates to:
  /// **'Recenzia a fost stearsa'**
  String get reviewDeleted;

  /// No description provided for @reviewDeleteError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la stergerea recenziei'**
  String get reviewDeleteError;

  /// No description provided for @ratingLabel.
  ///
  /// In ro, this message translates to:
  /// **'Nota {rating} din 5, {count} recenzii'**
  String ratingLabel(String rating, int count);

  /// No description provided for @welcomeTitle.
  ///
  /// In ro, this message translates to:
  /// **'Bine ai venit!'**
  String get welcomeTitle;

  /// No description provided for @loginToAccessAccount.
  ///
  /// In ro, this message translates to:
  /// **'Conecteaza-te pentru a accesa contul tau'**
  String get loginToAccessAccount;

  /// No description provided for @createAccount.
  ///
  /// In ro, this message translates to:
  /// **'Creeaza cont'**
  String get createAccount;

  /// No description provided for @favorites.
  ///
  /// In ro, this message translates to:
  /// **'Favorite'**
  String get favorites;

  /// No description provided for @following.
  ///
  /// In ro, this message translates to:
  /// **'Urmariri'**
  String get following;

  /// No description provided for @badgesEarned.
  ///
  /// In ro, this message translates to:
  /// **'Insigne castigate'**
  String get badgesEarned;

  /// No description provided for @selectForReviews.
  ///
  /// In ro, this message translates to:
  /// **'Selecteaza pentru recenzii'**
  String get selectForReviews;

  /// No description provided for @savedSearches.
  ///
  /// In ro, this message translates to:
  /// **'Cautari salvate'**
  String get savedSearches;

  /// No description provided for @preferences.
  ///
  /// In ro, this message translates to:
  /// **'Preferinte'**
  String get preferences;

  /// No description provided for @addBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Adauga business'**
  String get addBusiness;

  /// No description provided for @terms.
  ///
  /// In ro, this message translates to:
  /// **'Termeni'**
  String get terms;

  /// No description provided for @privacy.
  ///
  /// In ro, this message translates to:
  /// **'Confidentialitate'**
  String get privacy;

  /// No description provided for @exportData.
  ///
  /// In ro, this message translates to:
  /// **'Exporta datele'**
  String get exportData;

  /// No description provided for @deleteAccount.
  ///
  /// In ro, this message translates to:
  /// **'Sterge contul'**
  String get deleteAccount;

  /// No description provided for @shareText.
  ///
  /// In ro, this message translates to:
  /// **'Descopera ofertele din orasul tau pe OFAI! Foloseste link-ul meu: https://ofai.ro/r/{code}'**
  String shareText(String code);

  /// No description provided for @prefTitle.
  ///
  /// In ro, this message translates to:
  /// **'Preferinte'**
  String get prefTitle;

  /// No description provided for @prefCities.
  ///
  /// In ro, this message translates to:
  /// **'Orasele preferate'**
  String get prefCities;

  /// No description provided for @prefCitiesHelp.
  ///
  /// In ro, this message translates to:
  /// **'Poti selecta mai multe orase'**
  String get prefCitiesHelp;

  /// No description provided for @prefCategories.
  ///
  /// In ro, this message translates to:
  /// **'Categorii preferate'**
  String get prefCategories;

  /// No description provided for @prefCategoriesHelp.
  ///
  /// In ro, this message translates to:
  /// **'Selecteaza categoriile care te intereseaza'**
  String get prefCategoriesHelp;

  /// No description provided for @prefNotifications.
  ///
  /// In ro, this message translates to:
  /// **'Notificari'**
  String get prefNotifications;

  /// No description provided for @prefNotificationsHelp.
  ///
  /// In ro, this message translates to:
  /// **'Alege ce notificari primesti'**
  String get prefNotificationsHelp;

  /// No description provided for @prefDealOfDay.
  ///
  /// In ro, this message translates to:
  /// **'Oferta Zilei'**
  String get prefDealOfDay;

  /// No description provided for @prefFollowedBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Business-uri urmarite'**
  String get prefFollowedBusiness;

  /// No description provided for @prefFlashDeals.
  ///
  /// In ro, this message translates to:
  /// **'Oferte flash'**
  String get prefFlashDeals;

  /// No description provided for @prefWeeklyDigest.
  ///
  /// In ro, this message translates to:
  /// **'Rezumat saptamanal'**
  String get prefWeeklyDigest;

  /// No description provided for @prefReviewPrompt.
  ///
  /// In ro, this message translates to:
  /// **'Cerere recenzie'**
  String get prefReviewPrompt;

  /// No description provided for @prefSavedSearch.
  ///
  /// In ro, this message translates to:
  /// **'Cautari salvate'**
  String get prefSavedSearch;

  /// No description provided for @prefMarketing.
  ///
  /// In ro, this message translates to:
  /// **'Marketing'**
  String get prefMarketing;

  /// No description provided for @prefSave.
  ///
  /// In ro, this message translates to:
  /// **'Salveaza preferintele'**
  String get prefSave;

  /// No description provided for @prefUpdated.
  ///
  /// In ro, this message translates to:
  /// **'Preferinte actualizate'**
  String get prefUpdated;

  /// No description provided for @prefErrorCities.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-au putut incarca orasele'**
  String get prefErrorCities;

  /// No description provided for @prefErrorCategories.
  ///
  /// In ro, this message translates to:
  /// **'Nu s-au putut incarca categoriile'**
  String get prefErrorCategories;

  /// No description provided for @changePasswordTitle.
  ///
  /// In ro, this message translates to:
  /// **'Schimba parola'**
  String get changePasswordTitle;

  /// No description provided for @currentPassword.
  ///
  /// In ro, this message translates to:
  /// **'Parola curenta'**
  String get currentPassword;

  /// No description provided for @currentPasswordHint.
  ///
  /// In ro, this message translates to:
  /// **'Introdu parola curenta'**
  String get currentPasswordHint;

  /// No description provided for @currentPasswordRequired.
  ///
  /// In ro, this message translates to:
  /// **'Parola curenta este obligatorie'**
  String get currentPasswordRequired;

  /// No description provided for @newPassword.
  ///
  /// In ro, this message translates to:
  /// **'Parola noua'**
  String get newPassword;

  /// No description provided for @newPasswordHint.
  ///
  /// In ro, this message translates to:
  /// **'Minim 8 caractere, cel putin o cifra'**
  String get newPasswordHint;

  /// No description provided for @newPasswordRequired.
  ///
  /// In ro, this message translates to:
  /// **'Parola noua este obligatorie'**
  String get newPasswordRequired;

  /// No description provided for @minChars.
  ///
  /// In ro, this message translates to:
  /// **'Minim 8 caractere'**
  String get minChars;

  /// No description provided for @needsDigit.
  ///
  /// In ro, this message translates to:
  /// **'Trebuie sa contina cel putin o cifra'**
  String get needsDigit;

  /// No description provided for @confirmPassword.
  ///
  /// In ro, this message translates to:
  /// **'Confirma parola'**
  String get confirmPassword;

  /// No description provided for @confirmPasswordHint.
  ///
  /// In ro, this message translates to:
  /// **'Repeta parola noua'**
  String get confirmPasswordHint;

  /// No description provided for @confirmRequired.
  ///
  /// In ro, this message translates to:
  /// **'Confirmarea este obligatorie'**
  String get confirmRequired;

  /// No description provided for @passwordsMismatch.
  ///
  /// In ro, this message translates to:
  /// **'Parolele nu se potrivesc'**
  String get passwordsMismatch;

  /// No description provided for @passwordChanged.
  ///
  /// In ro, this message translates to:
  /// **'Parola a fost schimbata'**
  String get passwordChanged;

  /// No description provided for @editProfileTitle.
  ///
  /// In ro, this message translates to:
  /// **'Editeaza profilul'**
  String get editProfileTitle;

  /// No description provided for @firstName.
  ///
  /// In ro, this message translates to:
  /// **'Prenume'**
  String get firstName;

  /// No description provided for @firstNameHint.
  ///
  /// In ro, this message translates to:
  /// **'Prenumele tau'**
  String get firstNameHint;

  /// No description provided for @firstNameRequired.
  ///
  /// In ro, this message translates to:
  /// **'Prenumele este obligatoriu'**
  String get firstNameRequired;

  /// No description provided for @lastName.
  ///
  /// In ro, this message translates to:
  /// **'Nume'**
  String get lastName;

  /// No description provided for @lastNameHint.
  ///
  /// In ro, this message translates to:
  /// **'Numele tau'**
  String get lastNameHint;

  /// No description provided for @lastNameRequired.
  ///
  /// In ro, this message translates to:
  /// **'Numele este obligatoriu'**
  String get lastNameRequired;

  /// No description provided for @email.
  ///
  /// In ro, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @nameChangeLimit.
  ///
  /// In ro, this message translates to:
  /// **'Numele poate fi schimbat o data la 30 de zile.'**
  String get nameChangeLimit;

  /// No description provided for @showPictureInReviews.
  ///
  /// In ro, this message translates to:
  /// **'Arata poza in recenzii'**
  String get showPictureInReviews;

  /// No description provided for @profileUpdated.
  ///
  /// In ro, this message translates to:
  /// **'Profil actualizat'**
  String get profileUpdated;

  /// No description provided for @saveError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la salvare'**
  String get saveError;

  /// No description provided for @deleteAccountTitle.
  ///
  /// In ro, this message translates to:
  /// **'Sterge contul'**
  String get deleteAccountTitle;

  /// No description provided for @deleteWarning.
  ///
  /// In ro, this message translates to:
  /// **'Atentie!'**
  String get deleteWarning;

  /// No description provided for @deleteWarningBody.
  ///
  /// In ro, this message translates to:
  /// **'Stergerea contului este ireversibila. Toate datele tale vor fi sterse permanent, inclusiv:'**
  String get deleteWarningBody;

  /// No description provided for @deleteItem1.
  ///
  /// In ro, this message translates to:
  /// **'Profilul si datele personale'**
  String get deleteItem1;

  /// No description provided for @deleteItem2.
  ///
  /// In ro, this message translates to:
  /// **'Recenziile scrise'**
  String get deleteItem2;

  /// No description provided for @deleteItem3.
  ///
  /// In ro, this message translates to:
  /// **'Ofertele favorite'**
  String get deleteItem3;

  /// No description provided for @deleteItem4.
  ///
  /// In ro, this message translates to:
  /// **'Abonamentele la business-uri'**
  String get deleteItem4;

  /// No description provided for @deleteItem5.
  ///
  /// In ro, this message translates to:
  /// **'Istoricul activitatii'**
  String get deleteItem5;

  /// No description provided for @confirmWithPassword.
  ///
  /// In ro, this message translates to:
  /// **'Confirma cu parola'**
  String get confirmWithPassword;

  /// No description provided for @enterAccountPassword.
  ///
  /// In ro, this message translates to:
  /// **'Introdu parola contului'**
  String get enterAccountPassword;

  /// No description provided for @passwordRequiredForDelete.
  ///
  /// In ro, this message translates to:
  /// **'Introdu parola pentru confirmare'**
  String get passwordRequiredForDelete;

  /// No description provided for @googleDeleteInfo.
  ///
  /// In ro, this message translates to:
  /// **'Contul tau este conectat prin Google. Apasa butonul de mai jos pentru a confirma stergerea.'**
  String get googleDeleteInfo;

  /// No description provided for @deleteAccountButton.
  ///
  /// In ro, this message translates to:
  /// **'Sterge contul definitiv'**
  String get deleteAccountButton;

  /// No description provided for @confirmDeleteTitle.
  ///
  /// In ro, this message translates to:
  /// **'Confirmare stergere'**
  String get confirmDeleteTitle;

  /// No description provided for @confirmDeleteBody.
  ///
  /// In ro, this message translates to:
  /// **'Esti sigur ca vrei sa-ti stergi contul? Aceasta actiune este ireversibila si toate datele tale vor fi sterse permanent.'**
  String get confirmDeleteBody;

  /// No description provided for @cancelAction.
  ///
  /// In ro, this message translates to:
  /// **'Anuleaza'**
  String get cancelAction;

  /// No description provided for @deleteAccountAction.
  ///
  /// In ro, this message translates to:
  /// **'Sterge contul'**
  String get deleteAccountAction;

  /// No description provided for @myData.
  ///
  /// In ro, this message translates to:
  /// **'Datele mele'**
  String get myData;

  /// No description provided for @exportError.
  ///
  /// In ro, this message translates to:
  /// **'Eroare la export'**
  String get exportError;

  /// No description provided for @gdprInfo.
  ///
  /// In ro, this message translates to:
  /// **'Acestea sunt toate datele tale stocate pe platforma OFAI, conform GDPR.'**
  String get gdprInfo;

  /// No description provided for @shareData.
  ///
  /// In ro, this message translates to:
  /// **'Partajeaza datele'**
  String get shareData;

  /// No description provided for @myDataSubject.
  ///
  /// In ro, this message translates to:
  /// **'OFAI - Datele mele'**
  String get myDataSubject;

  /// No description provided for @errorGeneric.
  ///
  /// In ro, this message translates to:
  /// **'Eroare: {message}'**
  String errorGeneric(String message);

  /// No description provided for @unexpectedError.
  ///
  /// In ro, this message translates to:
  /// **'A aparut o eroare neasteptata'**
  String get unexpectedError;

  /// No description provided for @errorOccurred.
  ///
  /// In ro, this message translates to:
  /// **'A aparut o eroare'**
  String get errorOccurred;

  /// No description provided for @unfollowBusiness.
  ///
  /// In ro, this message translates to:
  /// **'Nu mai urmari'**
  String get unfollowBusiness;

  /// No description provided for @businessResponse.
  ///
  /// In ro, this message translates to:
  /// **'Raspuns business'**
  String get businessResponse;

  /// No description provided for @newBadge.
  ///
  /// In ro, this message translates to:
  /// **'Nou'**
  String get newBadge;

  /// No description provided for @removeFromFavorites.
  ///
  /// In ro, this message translates to:
  /// **'Elimina din favorite'**
  String get removeFromFavorites;

  /// No description provided for @addToFavorites.
  ///
  /// In ro, this message translates to:
  /// **'Adauga la favorite'**
  String get addToFavorites;

  /// No description provided for @promoted.
  ///
  /// In ro, this message translates to:
  /// **'PROMOVAT'**
  String get promoted;

  /// No description provided for @saveSingular.
  ///
  /// In ro, this message translates to:
  /// **'1 salvare'**
  String get saveSingular;

  /// No description provided for @savePlural.
  ///
  /// In ro, this message translates to:
  /// **'{count} salvari'**
  String savePlural(int count);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ro'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'ro':
      return AppLocalizationsRo();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
