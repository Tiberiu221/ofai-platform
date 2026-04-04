// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Romanian Moldavian Moldovan (`ro`).
class AppLocalizationsRo extends AppLocalizations {
  AppLocalizationsRo([String locale = 'ro']) : super(locale);

  @override
  String get navHome => 'Acasa';

  @override
  String get navExplore => 'Exploreaza';

  @override
  String get navCollection => 'Colectia mea';

  @override
  String get navAccount => 'Cont';

  @override
  String get inviteFriends => 'Invita prieteni';

  @override
  String get inviteSubtitle =>
      'Trimite link-ul tau prietenilor si descopera impreuna cele mai bune oferte!';

  @override
  String invitedCount(int count) {
    return '$count invitati';
  }

  @override
  String pointsCount(int count) {
    return '$count puncte';
  }

  @override
  String get sendInvite => 'Trimite invitatia';

  @override
  String get referralError => 'Eroare la incarcarea codului de referral';

  @override
  String get myProfile => 'Profilul meu';

  @override
  String get myReports => 'Rapoartele mele';

  @override
  String get settings => 'Setari';

  @override
  String get changePassword => 'Schimba parola';

  @override
  String get help => 'Ajutor';

  @override
  String get logout => 'Deconectare';

  @override
  String get login => 'Conecteaza-te';

  @override
  String get offlineMessage => 'Esti offline';

  @override
  String timeAgoMonths(int count) {
    return '$count luni';
  }

  @override
  String timeAgoDays(int count) {
    return '$count zile';
  }

  @override
  String timeAgoHours(int count) {
    return '$count ore';
  }

  @override
  String get timeAgoRecent => 'recent';

  @override
  String get user => 'Utilizator';

  @override
  String get authWelcomeBack => 'Bine ai revenit!';

  @override
  String get authLoginSubtitle => 'Conecteaza-te pentru a continua';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Parola';

  @override
  String get authEmailRequired => 'Email obligatoriu';

  @override
  String get authEmailInvalid => 'Email invalid';

  @override
  String get authPasswordRequired => 'Parola obligatorie';

  @override
  String get authForgotPassword => 'Ai uitat parola?';

  @override
  String get authLoginButton => 'Conecteaza-te';

  @override
  String get authOr => 'sau';

  @override
  String get authContinueGoogle => 'Continua cu Google';

  @override
  String get authNoAccount => 'Nu ai cont? ';

  @override
  String get authRegister => 'Inregistreaza-te';

  @override
  String get authLoginError => 'Eroare la autentificare';

  @override
  String get authGoogleError => 'Eroare la autentificarea cu Google';

  @override
  String get authCreateAccount => 'Creeaza cont';

  @override
  String get authRegisterSubtitle =>
      'Completeaza datele pentru a te inregistra';

  @override
  String get authFirstName => 'Prenume';

  @override
  String get authLastName => 'Nume';

  @override
  String get authRequired => 'Obligatoriu';

  @override
  String get authPasswordMin8 => 'Minim 8 caractere';

  @override
  String get authPasswordNeedsDigit => 'Trebuie sa contina cel putin o cifra';

  @override
  String get authAccept => 'Accept ';

  @override
  String get authTerms => 'Termenii';

  @override
  String get authAnd => ' si ';

  @override
  String get authPrivacyPolicy => 'Politica de confidentialitate';

  @override
  String get authAcceptTermsError =>
      'Trebuie sa accepti termenii si politica de confidentialitate.';

  @override
  String get authRegisterButton => 'Creeaza cont';

  @override
  String get authRegisterError => 'Eroare la inregistrare';

  @override
  String get authHasAccount => 'Ai deja cont? ';

  @override
  String get authForgotTitle => 'Ai uitat parola?';

  @override
  String get authForgotSubtitle =>
      'Introdu adresa de email si iti vom trimite un cod de resetare.';

  @override
  String get authSendCode => 'Trimite codul';

  @override
  String get authCodeSent =>
      'Daca exista un cont cu acest email, vei primi un cod de resetare.';

  @override
  String get authSendCodeError =>
      'Eroare la trimiterea codului. Incearca din nou.';

  @override
  String get authRememberPassword => 'Ti-ai amintit parola? ';

  @override
  String get authVerifyTitle => 'Verifica codul';

  @override
  String authCodeSentTo(String email) {
    return 'Am trimis un cod de 6 cifre la $email';
  }

  @override
  String authExpiresIn(String time) {
    return 'Expira in $time';
  }

  @override
  String get authCodeExpired => 'Cod expirat';

  @override
  String get authEnterAllDigits => 'Introdu toate cele 6 cifre';

  @override
  String get authInvalidCode => 'Cod invalid sau expirat';

  @override
  String get authVerifyButton => 'Verifica';

  @override
  String get authNoCode => 'Nu ai primit codul? ';

  @override
  String get authResend => 'Retrimite';

  @override
  String get authResending => 'Se trimite...';

  @override
  String get authNewCodeSent => 'Cod nou trimis!';

  @override
  String get authResendError => 'Eroare la retrimitere';

  @override
  String get authNewPassword => 'Parola noua';

  @override
  String get authNewPasswordSubtitle =>
      'Alege o parola noua pentru contul tau.';

  @override
  String get authNewPasswordLabel => 'Parola noua';

  @override
  String get authConfirmPassword => 'Confirma parola';

  @override
  String get authPasswordIsRequired => 'Parola este obligatorie';

  @override
  String get authConfirmRequired => 'Confirmarea este obligatorie';

  @override
  String get authPasswordsMismatch => 'Parolele nu coincid';

  @override
  String get authResetButton => 'Reseteaza parola';

  @override
  String get authResetSuccess => 'Parola a fost schimbata cu succes!';

  @override
  String get authResetError =>
      'Eroare la resetarea parolei. Codul poate fi expirat.';

  @override
  String get onboardingSkip => 'Sari peste';

  @override
  String get onboardingContinue => 'Continua';

  @override
  String get onboardingStart => 'Incepe';

  @override
  String get onboardingTitle1 => 'Descopera oferte';

  @override
  String get onboardingDesc1 =>
      'Gaseste reduceri verificate de la frizerii, restaurante, fitness si 12+ categorii din orasul tau.';

  @override
  String get onboardingTrust1 => '100% Gratuit';

  @override
  String get onboardingTrustDesc1 => 'Fara costuri ascunse, fara abonamente';

  @override
  String get onboardingTitle2 => 'Urmareste business-uri';

  @override
  String get onboardingDesc2 =>
      'Aboneaza-te la business-urile preferate si primeste notificari cand apar oferte noi.';

  @override
  String get onboardingTrust2 => 'Business-uri Verificate';

  @override
  String get onboardingTrustDesc2 => 'Echipa OFAI verifica fiecare partener';

  @override
  String get onboardingTitle3 => 'Economiseste mai mult';

  @override
  String get onboardingDesc3 =>
      'Salveaza ofertele la favorite, dezvaluie coduri promo si profita de reduceri exclusive.';

  @override
  String get onboardingTrust3 => 'Oferte Personalizate';

  @override
  String get onboardingTrustDesc3 => 'Bazate pe orasul si preferintele tale';

  @override
  String get homeSubtitle => 'Cele mai bune oferte din orasul tau';

  @override
  String get searchHint => 'Cauta oferte, business-uri...';

  @override
  String get categories => 'Categorii';

  @override
  String get discoverCities => 'Descopera orase';

  @override
  String get dealOfDay => 'Oferta Zilei';

  @override
  String get flashOffers => 'Oferte Flash';

  @override
  String get collections => 'Colectii';

  @override
  String offersCount(int count) {
    return '$count oferte';
  }

  @override
  String get recentlyViewed => 'Vazute recent';

  @override
  String get forYou => 'Pentru tine';

  @override
  String get popularOffers => 'Oferte populare';

  @override
  String get noOffersAvailable => 'Nicio oferta disponibila';

  @override
  String get checkBackLater => 'Revino mai tarziu pentru oferte noi';

  @override
  String get errorLoadingOffers => 'Nu s-au putut incarca ofertele';

  @override
  String get promotedOffers => 'Oferte Promovate';

  @override
  String get partnerBusinesses => 'Business-uri partenere';

  @override
  String get businesses => 'Business-uri';

  @override
  String get noBusinessAvailable => 'Niciun business disponibil';

  @override
  String get checkBackLaterShort => 'Revino mai tarziu';

  @override
  String get errorLoadingBusinesses => 'Nu s-au putut incarca business-urile';

  @override
  String get seeAll => 'Vezi toate';

  @override
  String get explore => 'Exploreaza';

  @override
  String get cityFilter => 'Oras';

  @override
  String get categoryFilter => 'Categorie';

  @override
  String get saveSearch => 'Salveaza';

  @override
  String get resetFilters => 'Reseteaza';

  @override
  String get offers => 'Oferte';

  @override
  String showingResults(int count, int total, String type) {
    return 'Afisand $count din $total $type';
  }

  @override
  String get noOfferFound => 'Nicio oferta gasita';

  @override
  String get tryOtherFilters => 'Incearca alte filtre sau cauta altceva';

  @override
  String get noBusinessFound => 'Niciun business gasit';

  @override
  String get searchSaved => 'Cautare salvata!';

  @override
  String get searchSaveError => 'Eroare la salvare (max 10)';

  @override
  String get locationUnavailable => 'Locatia nu este disponibila';

  @override
  String get locationError => 'Nu s-a putut determina locatia';

  @override
  String get recentSearches => 'Cautari recente';

  @override
  String get deleteAll => 'Sterge tot';

  @override
  String get myPreferences => 'Preferintele mele';

  @override
  String get chooseCity => 'Alege orasul';

  @override
  String get allCities => 'Toate orasele';

  @override
  String get chooseCategory => 'Alege categoria';

  @override
  String get allCategories => 'Toate categoriile';

  @override
  String get sorting => 'Sortare';

  @override
  String get sortDefault => 'Implicit';

  @override
  String get sortPopular => 'Populare';

  @override
  String get sortDiscount => 'Reducere maxima';

  @override
  String get sortEndingSoon => 'Expira curand';

  @override
  String get sortDistance => 'Distanta';

  @override
  String get loginToSaveOffers => 'Conecteaza-te pentru a salva oferte';

  @override
  String get loginToSaveSubtitle =>
      'Salveaza ofertele preferate si urmareste business-urile favorite';

  @override
  String get signIn => 'Conecteaza-te';

  @override
  String get myCollection => 'Colectia mea';

  @override
  String get searchInOffers => 'Cauta in oferte...';

  @override
  String get searchInBusinesses => 'Cauta in business-uri...';

  @override
  String get sortNameAZ => 'Nume A-Z';

  @override
  String get sortRating => 'Rating';

  @override
  String get sortDiscountShort => 'Reducere';

  @override
  String get sortEndingSoonShort => 'Expira curand';

  @override
  String get sortDistanceShort => 'Distanta';

  @override
  String get loadingError => 'Eroare la incarcare';

  @override
  String get retry => 'Reincearca';

  @override
  String get noFavoriteOffers => 'Nu ai oferte favorite';

  @override
  String get noFavoriteOffersSubtitle =>
      'Salveaza oferte din pagina de explorare sau din detaliile unei oferte';

  @override
  String get noResults => 'Niciun rezultat';

  @override
  String get noFavoriteOfferMatch =>
      'Nicio oferta favorita nu corespunde cautarii';

  @override
  String removedFromFavorites(String name) {
    return '$name eliminata din favorite';
  }

  @override
  String get cancel => 'Anuleaza';

  @override
  String get removeError => 'Eroare la eliminare';

  @override
  String get noFollowedBusinesses => 'Nu urmaresti niciun business';

  @override
  String get noFollowedBusinessesSubtitle =>
      'Urmareste business-uri pentru a primi notificari despre ofertele lor';

  @override
  String get noFollowedBusinessMatch =>
      'Niciun business urmarit nu corespunde cautarii';

  @override
  String removedFromFollowed(String name) {
    return '$name eliminat din urmarite';
  }

  @override
  String get shareOffer => 'Distribuie oferta';

  @override
  String get reportOffer => 'Raporteaza oferta';

  @override
  String get reportSent => 'Raportul a fost trimis. Multumim!';

  @override
  String get report => 'Raporteaza';

  @override
  String get flashOffer => 'Oferta flash';

  @override
  String offerTitle(String title) {
    return 'Titlu oferta: $title';
  }

  @override
  String get trending => 'Trending';

  @override
  String saveCount(int count) {
    return '$count salvari';
  }

  @override
  String validPeriod(String start, String end) {
    return 'Valabila: $start - $end';
  }

  @override
  String get active => 'Activa';

  @override
  String get expired => 'Expirata';

  @override
  String get conditions => 'Conditii';

  @override
  String get howToUseOffer => 'Cum sa folosesti oferta';

  @override
  String get redemptionCall => 'Suna si mentioneaza oferta OFAI';

  @override
  String get redemptionWhatsapp =>
      'Scrie pe WhatsApp si mentioneaza oferta OFAI';

  @override
  String get redemptionOnline => 'Rezerva online si mentioneaza oferta OFAI';

  @override
  String get redemptionBooking => 'Mentioneaza oferta OFAI la rezervare';

  @override
  String get redemptionAppointment => 'Mentioneaza oferta OFAI la programare';

  @override
  String get redemptionOrder => 'Mentioneaza oferta OFAI la comanda';

  @override
  String get redemptionCheckout =>
      'Aplica codul sau mentioneaza oferta OFAI la checkout';

  @override
  String get redemptionShowPage =>
      'Arata aceasta pagina pentru a beneficia de reducere';

  @override
  String get redemptionDefault =>
      'Mentioneaza oferta OFAI pentru a beneficia de reducere';

  @override
  String get codesExhausted => 'Codurile s-au epuizat';

  @override
  String codesRemaining(int count) {
    return 'Doar $count coduri ramase!';
  }

  @override
  String get business => 'Business';

  @override
  String get locations => 'Locatii';

  @override
  String get booking => 'Rezervare';

  @override
  String get phone => 'Telefon';

  @override
  String get online => 'Online';

  @override
  String get similarOffers => 'Oferte similare';

  @override
  String galleryCount(int count) {
    return 'Galerie ($count)';
  }

  @override
  String get galleryImage => 'Imagine galerie';

  @override
  String get callNow => 'Suna acum';

  @override
  String get bookOnline => 'Rezerva online';

  @override
  String get saved => 'Salvata';

  @override
  String get save => 'Salveaza';

  @override
  String get errorLoadingOffer => 'Nu s-a putut incarca oferta';

  @override
  String get promoCode => 'Cod Promotional';

  @override
  String get loginToSeeCode => 'Conecteaza-te pentru a vedea codul';

  @override
  String get codeUnavailable => 'Codul nu este disponibil';

  @override
  String get codeLoadError => 'Nu s-a putut incarca codul';

  @override
  String get showCodeAtCheckout => 'Arata acest cod la casa';

  @override
  String get codeCopied => 'Cod copiat in clipboard';

  @override
  String get revealCode => 'Dezvaluie codul';

  @override
  String get copyCode => 'Copiaza codul';

  @override
  String get tapForFullscreen => 'Apasa pentru ecran complet';

  @override
  String get tryAgain => 'Incearca din nou';

  @override
  String discountLabel(String label) {
    return 'Reducere $label';
  }

  @override
  String get shareBusiness => 'Distribuie business';

  @override
  String get reportBusiness => 'Raporteaza business';

  @override
  String get thisIsYourBusiness => 'Acesta este business-ul tau';

  @override
  String get manageOnWeb => 'Gestioneaza pe Web';

  @override
  String followersCount(int count) {
    return '$count urmaritori';
  }

  @override
  String reviewsCount(int count) {
    return '($count recenzii)';
  }

  @override
  String get writeReview => 'Scrie recenzie';

  @override
  String get reviewSummary => 'Rezumat recenzii';

  @override
  String get contact => 'Contact';

  @override
  String get activeOffers => 'Oferte active';

  @override
  String get reviews => 'Recenzii';

  @override
  String get noReviewsYet => 'Nicio recenzie inca';

  @override
  String get beFirstToReview => 'Fii primul care scrie o recenzie!';

  @override
  String get loadMoreReviews => 'Incarca mai multe recenzii';

  @override
  String get followed => 'Urmarit';

  @override
  String get follow => 'Urmareste';

  @override
  String get errorLoadingBusiness => 'Nu s-a putut incarca business-ul';

  @override
  String get premiumBusiness => 'Business Premium';

  @override
  String get verifiedBusiness => 'Business Verificat';

  @override
  String get premiumDescription =>
      'Acest business are un abonament Premium OFAI. Beneficiaza de vizibilitate sporita, analize avansate si suport prioritar.';

  @override
  String get verifiedDescription =>
      'Acest business a fost verificat de echipa OFAI. Verificam identitatea, locatia si calitatea serviciilor pentru a asigura o experienta de incredere.';

  @override
  String get writeAReview => 'Scrie o recenzie';

  @override
  String get commentHint => 'Scrie un comentariu (optional)...';

  @override
  String get submitReview => 'Trimite recenzia';

  @override
  String get submitError => 'Eroare la trimitere';

  @override
  String get deleteReviewTitle => 'Sterge recenzia?';

  @override
  String get deleteReviewBody =>
      'Recenzia si eventualul raspuns al business-ului vor fi sterse definitiv.';

  @override
  String get delete => 'Sterge';

  @override
  String get reviewDeleted => 'Recenzia a fost stearsa';

  @override
  String get reviewDeleteError => 'Eroare la stergerea recenziei';

  @override
  String ratingLabel(String rating, int count) {
    return 'Nota $rating din 5, $count recenzii';
  }

  @override
  String get welcomeTitle => 'Bine ai venit!';

  @override
  String get loginToAccessAccount => 'Conecteaza-te pentru a accesa contul tau';

  @override
  String get createAccount => 'Creeaza cont';

  @override
  String get favorites => 'Favorite';

  @override
  String get following => 'Urmariri';

  @override
  String get badgesEarned => 'Insigne castigate';

  @override
  String get selectForReviews => 'Selecteaza pentru recenzii';

  @override
  String get savedSearches => 'Cautari salvate';

  @override
  String get preferences => 'Preferinte & Notificari';

  @override
  String get addBusiness => 'Adauga business';

  @override
  String get terms => 'Termeni';

  @override
  String get privacy => 'Confidentialitate';

  @override
  String get exportData => 'Exporta datele';

  @override
  String get deleteAccount => 'Sterge contul';

  @override
  String shareText(String code) {
    return 'Descopera ofertele din orasul tau pe OFAI! Foloseste link-ul meu: https://ofai.ro/r/$code';
  }

  @override
  String get prefTitle => 'Preferinte & Notificari';

  @override
  String get prefCities => 'Orasele preferate';

  @override
  String get prefCitiesHelp => 'Poti selecta mai multe orase';

  @override
  String get prefCategories => 'Categorii preferate';

  @override
  String get prefCategoriesHelp => 'Selecteaza categoriile care te intereseaza';

  @override
  String get prefNotifications => 'Notificari';

  @override
  String get prefNotificationsHelp => 'Alege ce notificari primesti';

  @override
  String get prefDealOfDay => 'Oferta Zilei';

  @override
  String get prefFollowedBusiness => 'Business-uri urmarite';

  @override
  String get prefFlashDeals => 'Oferte flash';

  @override
  String get prefWeeklyDigest => 'Rezumat saptamanal';

  @override
  String get prefReviewPrompt => 'Cerere recenzie';

  @override
  String get prefSavedSearch => 'Cautari salvate';

  @override
  String get prefMarketing => 'Marketing';

  @override
  String get prefSave => 'Salveaza preferintele';

  @override
  String get prefUpdated => 'Preferinte actualizate';

  @override
  String get prefErrorCities => 'Nu s-au putut incarca orasele';

  @override
  String get prefErrorCategories => 'Nu s-au putut incarca categoriile';

  @override
  String get changePasswordTitle => 'Schimba parola';

  @override
  String get currentPassword => 'Parola curenta';

  @override
  String get currentPasswordHint => 'Introdu parola curenta';

  @override
  String get currentPasswordRequired => 'Parola curenta este obligatorie';

  @override
  String get newPassword => 'Parola noua';

  @override
  String get newPasswordHint => 'Minim 8 caractere, cel putin o cifra';

  @override
  String get newPasswordRequired => 'Parola noua este obligatorie';

  @override
  String get minChars => 'Minim 8 caractere';

  @override
  String get needsDigit => 'Trebuie sa contina cel putin o cifra';

  @override
  String get confirmPassword => 'Confirma parola';

  @override
  String get confirmPasswordHint => 'Repeta parola noua';

  @override
  String get confirmRequired => 'Confirmarea este obligatorie';

  @override
  String get passwordsMismatch => 'Parolele nu se potrivesc';

  @override
  String get passwordChanged => 'Parola a fost schimbata';

  @override
  String get editProfileTitle => 'Editeaza profilul';

  @override
  String get firstName => 'Prenume';

  @override
  String get firstNameHint => 'Prenumele tau';

  @override
  String get firstNameRequired => 'Prenumele este obligatoriu';

  @override
  String get lastName => 'Nume';

  @override
  String get lastNameHint => 'Numele tau';

  @override
  String get lastNameRequired => 'Numele este obligatoriu';

  @override
  String get email => 'Email';

  @override
  String get nameChangeLimit =>
      'Numele poate fi schimbat o data la 30 de zile.';

  @override
  String get showPictureInReviews => 'Arata poza in recenzii';

  @override
  String get profileUpdated => 'Poza de profil actualizata!';

  @override
  String get saveError => 'Eroare la salvare';

  @override
  String get deleteAccountTitle => 'Sterge contul';

  @override
  String get deleteWarning => 'Atentie!';

  @override
  String get deleteWarningBody =>
      'Stergerea contului este ireversibila. Toate datele tale vor fi sterse permanent, inclusiv:';

  @override
  String get deleteItem1 => 'Profilul si datele personale';

  @override
  String get deleteItem2 => 'Recenziile scrise';

  @override
  String get deleteItem3 => 'Ofertele favorite';

  @override
  String get deleteItem4 => 'Abonamentele la business-uri';

  @override
  String get deleteItem5 => 'Istoricul activitatii';

  @override
  String get confirmWithPassword => 'Confirma cu parola';

  @override
  String get enterAccountPassword => 'Introdu parola contului';

  @override
  String get passwordRequiredForDelete => 'Introdu parola pentru confirmare';

  @override
  String get googleDeleteInfo =>
      'Contul tau este conectat prin Google. Apasa butonul de mai jos pentru a confirma stergerea.';

  @override
  String get deleteAccountButton => 'Sterge contul definitiv';

  @override
  String get confirmDeleteTitle => 'Confirmare stergere';

  @override
  String get confirmDeleteBody =>
      'Esti sigur ca vrei sa-ti stergi contul? Aceasta actiune este ireversibila si toate datele tale vor fi sterse permanent.';

  @override
  String get cancelAction => 'Anuleaza';

  @override
  String get deleteAccountAction => 'Sterge contul';

  @override
  String get myData => 'Datele mele';

  @override
  String get exportError => 'Eroare la export';

  @override
  String get gdprInfo =>
      'Acestea sunt toate datele tale stocate pe platforma OFAI, conform GDPR.';

  @override
  String get shareData => 'Partajeaza datele';

  @override
  String get myDataSubject => 'OFAI - Datele mele';

  @override
  String errorGeneric(String message) {
    return 'Eroare: $message';
  }

  @override
  String get unexpectedError => 'A aparut o eroare neasteptata';

  @override
  String get errorOccurred => 'A aparut o eroare';

  @override
  String get unfollowBusiness => 'Nu mai urmari';

  @override
  String get businessResponse => 'Raspuns business';

  @override
  String get newBadge => 'Nou';

  @override
  String get removeFromFavorites => 'Elimina din favorite';

  @override
  String get addToFavorites => 'Adauga la favorite';

  @override
  String get promoted => 'PROMOVAT';

  @override
  String get saveSingular => '1 salvare';

  @override
  String savePlural(int count) {
    return '$count salvari';
  }

  @override
  String get helpTitle => 'Ajutor & Suport';

  @override
  String get helpSubtitle => 'Cum te putem ajuta?';

  @override
  String get helpDescription =>
      'Echipa OFAI iti sta la dispozitie. Raspundem in medie in mai putin de 24 de ore.';

  @override
  String get helpEmailTitle => 'Email';

  @override
  String get helpEmailValue => 'contact@ofai.ro';

  @override
  String get helpPhoneTitle => 'Telefon';

  @override
  String get helpPhoneValue => '+40 700 000 000';

  @override
  String get helpFaqTitle => 'Intrebari frecvente';

  @override
  String get helpLinksTitle => 'Link-uri utile';

  @override
  String get helpTermsLink => 'Termeni si conditii';

  @override
  String get helpPrivacyLink => 'Politica de confidentialitate';

  @override
  String get helpFaq1Q => 'Cum functioneaza platforma?';

  @override
  String get helpFaq1A =>
      'OFAI iti permite sa descoperi oferte si reduceri de la afaceri locale. Poti cauta dupa oras, categorie sau cuvinte cheie, salva ofertele favorite si urmari business-urile preferate.';

  @override
  String get helpFaq2Q => 'Cum castig puncte?';

  @override
  String get helpFaq2A =>
      'Castigi puncte pentru activitatea ta pe platforma: scrierea de recenzii, vizitarea zilnica a aplicatiei si interactiunea cu ofertele.';

  @override
  String get helpFaq3Q => 'Cum pot folosi punctele?';

  @override
  String get helpFaq3A =>
      'Punctele acumulate contribuie la progresul tau pe platforma. Cu cat ai mai multe puncte, cu atat urci in nivel si deblochezi badge-uri noi.';

  @override
  String get helpFaq4Q => 'Cum schimb orasul?';

  @override
  String get helpFaq4A =>
      'Mergi in Cont > Preferinte si selecteaza orasul dorit. Ofertele si business-urile vor fi filtrate automat.';

  @override
  String get helpFaq5Q => 'Cum urmaresc un business?';

  @override
  String get helpFaq5A =>
      'Deschide pagina business-ului si apasa butonul \"Urmareste\". Vei primi notificari cand business-ul adauga oferte noi.';

  @override
  String get helpFaq6Q => 'Cum las o recenzie?';

  @override
  String get helpFaq6A =>
      'Deschide pagina business-ului si apasa \"Scrie recenzie\". Alege un rating de la 1 la 5 stele si optional lasa un comentariu.';

  @override
  String get helpFaq7Q => 'Cum imi sterg contul?';

  @override
  String get helpFaq7A =>
      'Mergi in Cont > Sterge contul. Aceasta actiune este ireversibila si toate datele tale vor fi sterse permanent.';

  @override
  String get helpFaq8Q => 'Cum pot inregistra un business?';

  @override
  String get helpFaq8A =>
      'Din Cont, apasa \"Adauga un business\" si completeaza formularul. Echipa noastra va analiza cererea si te va notifica.';

  @override
  String get bizReqTitle => 'Adauga un business';

  @override
  String get bizReqSubtitle =>
      'Propune un business care nu se afla inca pe platforma.';

  @override
  String get bizReqNameLabel => 'Numele business-ului *';

  @override
  String get bizReqNameHint => 'Ex: Salon Elite';

  @override
  String get bizReqNameRequired => 'Numele este obligatoriu';

  @override
  String get bizReqCityLabel => 'Oras *';

  @override
  String get bizReqCityHint => 'Alege orasul';

  @override
  String get bizReqCityRequired => 'Orasul este obligatoriu';

  @override
  String get bizReqCategoryLabel => 'Categorie';

  @override
  String get bizReqCategoryHint => 'Alege categoria';

  @override
  String get bizReqAddressLabel => 'Adresa';

  @override
  String get bizReqAddressHint => 'Ex: Str. Victoriei 10, Cluj-Napoca';

  @override
  String get bizReqPhoneLabel => 'Telefon';

  @override
  String get bizReqPhoneHint => 'Ex: 0712 345 678';

  @override
  String get bizReqWebsiteLabel => 'Website';

  @override
  String get bizReqWebsiteHint => 'Ex: www.salonelite.ro';

  @override
  String get bizReqDescLabel => 'Descriere';

  @override
  String get bizReqDescHint => 'Descrie pe scurt business-ul...';

  @override
  String get bizReqSubmit => 'Trimite cererea';

  @override
  String get bizReqSuccessTitle => 'Cerere trimisa!';

  @override
  String get bizReqSuccessBody =>
      'Cererea ta a fost inregistrata. O vom analiza si te vom notifica cand va fi aprobata.';

  @override
  String get bizReqError =>
      'Eroare la trimiterea cererii. Mai ai deja o cerere in asteptare?';

  @override
  String get reportOfferTitle => 'Raporteaza oferta';

  @override
  String get reportBusinessTitle => 'Raporteaza business-ul';

  @override
  String get reportSelectReason => 'Selecteaza motivul raportarii:';

  @override
  String get reportFakeOffer => 'Oferta nu este reala';

  @override
  String get reportMisleadingPrice => 'Pret inselator';

  @override
  String get reportInappropriate => 'Continut inadecvat';

  @override
  String get reportSpam => 'Spam / publicitate agresiva';

  @override
  String get reportOther => 'Altul';

  @override
  String get reportClosedBusiness => 'Business inchis / inexistent';

  @override
  String get reportDetailsHint => 'Descrie problema...';

  @override
  String get reportDetailsMinLength =>
      'Te rugam sa descrii problema (minim 5 caractere).';

  @override
  String get reportSubmitBtn => 'Trimite raportul';

  @override
  String get reportErrorGeneric => 'Eroare la trimiterea raportului.';

  @override
  String get reportErrorDuplicate => 'Ai raportat deja aceasta resursa.';

  @override
  String get reportErrorRateLimit =>
      'Ai atins limita de rapoarte pentru astazi.';

  @override
  String get myReportsTitle => 'Rapoartele mele';

  @override
  String get myReportsEmpty => 'Niciun raport trimis';

  @override
  String get myReportsEmptySubtitle => 'Rapoartele tale vor aparea aici';

  @override
  String reportOfferTarget(int id) {
    return 'Oferta #$id';
  }

  @override
  String reportBusinessTarget(int id) {
    return 'Business #$id';
  }

  @override
  String get reportWithdrawTitle => 'Retrage raportul?';

  @override
  String get reportWithdrawBody => 'Raportul va fi sters definitiv.';

  @override
  String get reportWithdrawConfirm => 'Retrage';

  @override
  String get reportWithdrawn => 'Raportul a fost retras';

  @override
  String get reportWithdrawError => 'Nu s-a putut retrage raportul';

  @override
  String get reportStatusPending => 'In asteptare';

  @override
  String get reportStatusReviewed => 'Analizat';

  @override
  String get reportStatusResolved => 'Rezolvat';

  @override
  String get reportStatusUnknown => 'Necunoscut';

  @override
  String get profilePickGallery => 'Alege din galerie';

  @override
  String get profileDeletePhoto => 'Sterge poza';

  @override
  String get profileUploading => 'Se incarca poza...';

  @override
  String get profileDeleted => 'Poza de profil stearsa';

  @override
  String get badgeSelected => 'Insigna selectata!';

  @override
  String get badgeDeselected => 'Insigna dezactivata';

  @override
  String get categoriesTitle => 'Categorii';

  @override
  String get categoriesEmpty => 'Nicio categorie disponibila';

  @override
  String get categoriesError => 'Eroare la incarcarea categoriilor';

  @override
  String get categoriesRetry => 'Reincearca';

  @override
  String get citiesTitle => 'Orase';

  @override
  String get citiesEmpty => 'Niciun oras disponibil';

  @override
  String get citiesError => 'Eroare la incarcarea oraselor';

  @override
  String get savedSearchesTitle => 'Cautari salvate';

  @override
  String get savedSearchesEmpty => 'Nicio cautare salvata';

  @override
  String get savedSearchesEmptySubtitle =>
      'Salveaza cautarile din Exploreaza pentru a primi notificari cand apar oferte noi.';

  @override
  String get tabOffers => 'Oferte';

  @override
  String get tabGallery => 'Galerie';

  @override
  String get tabMenu => 'Meniu';

  @override
  String get tabSchedule => 'Program';

  @override
  String get tabReviews => 'Recenzii';

  @override
  String get tabContact => 'Contact';

  @override
  String get tabDetails => 'Detalii';

  @override
  String get seeAllPhotos => 'Toate >';

  @override
  String photosCount(int count) {
    return 'Foto ($count)';
  }

  @override
  String get expandHours => 'Vezi programul complet';

  @override
  String get collapseHours => 'Ascunde';

  @override
  String get legalEntity => 'Denumire legală';

  @override
  String get cuiLabel => 'CUI / CIF';

  @override
  String get foundedYearLabel => 'An înfiintare';

  @override
  String get verifiedSince => 'Verificat din';

  @override
  String get callNowCta => 'Sună acum';

  @override
  String get bookNowCta => 'Rezervă';

  @override
  String get navigateCta => 'Navighează';

  @override
  String get noPhotos => 'Nicio fotografie încă';

  @override
  String get credibilityTitle => 'Informații legale';

  @override
  String get stepChooseOffer => 'Alege oferta';

  @override
  String get stepChooseOfferDesc => 'Verifică detaliile și condițiile';

  @override
  String get stepContact => 'Contactează';

  @override
  String get stepContactDesc => 'Sună sau rezervă online';

  @override
  String get stepEnjoy => 'Profită!';

  @override
  String get stepEnjoyDesc => 'Prezintă oferta și bucură-te de reducere';

  @override
  String get stepCopyCode => 'Copiază codul';

  @override
  String get stepCopyCodeDesc => 'Copiază codul promoțional';

  @override
  String get stepUseCode => 'Folosește codul';

  @override
  String get stepUseCodeDesc => 'Folosește codul la plată';

  @override
  String get enjoyNowCta => 'Profită acum';

  @override
  String get revealCodeCta => 'Dezvăluie codul';

  @override
  String get openNow => 'Deschis acum';

  @override
  String get closedNow => 'Închis';
}
