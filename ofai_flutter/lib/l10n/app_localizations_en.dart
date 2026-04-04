// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get navHome => 'Home';

  @override
  String get navExplore => 'Explore';

  @override
  String get navCollection => 'My Collection';

  @override
  String get navAccount => 'Account';

  @override
  String get inviteFriends => 'Invite friends';

  @override
  String get inviteSubtitle =>
      'Share your link with friends and discover the best deals together!';

  @override
  String invitedCount(int count) {
    return '$count invited';
  }

  @override
  String pointsCount(int count) {
    return '$count points';
  }

  @override
  String get sendInvite => 'Send invitation';

  @override
  String get referralError => 'Error loading referral code';

  @override
  String get myProfile => 'My Profile';

  @override
  String get myReports => 'My Reports';

  @override
  String get settings => 'Settings';

  @override
  String get changePassword => 'Change Password';

  @override
  String get help => 'Help';

  @override
  String get logout => 'Log Out';

  @override
  String get login => 'Sign In';

  @override
  String get offlineMessage => 'You\'re offline';

  @override
  String timeAgoMonths(int count) {
    return '$count months';
  }

  @override
  String timeAgoDays(int count) {
    return '$count days';
  }

  @override
  String timeAgoHours(int count) {
    return '$count hours';
  }

  @override
  String get timeAgoRecent => 'recently';

  @override
  String get user => 'User';

  @override
  String get authWelcomeBack => 'Welcome back!';

  @override
  String get authLoginSubtitle => 'Sign in to continue';

  @override
  String get authEmail => 'Email';

  @override
  String get authPassword => 'Password';

  @override
  String get authEmailRequired => 'Email required';

  @override
  String get authEmailInvalid => 'Invalid email';

  @override
  String get authPasswordRequired => 'Password required';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authLoginButton => 'Sign in';

  @override
  String get authOr => 'or';

  @override
  String get authContinueGoogle => 'Continue with Google';

  @override
  String get authNoAccount => 'Don\'t have an account? ';

  @override
  String get authRegister => 'Sign up';

  @override
  String get authLoginError => 'Login error';

  @override
  String get authGoogleError => 'Google sign-in error';

  @override
  String get authCreateAccount => 'Create account';

  @override
  String get authRegisterSubtitle => 'Fill in your details to register';

  @override
  String get authFirstName => 'First name';

  @override
  String get authLastName => 'Last name';

  @override
  String get authRequired => 'Required';

  @override
  String get authPasswordMin8 => 'Minimum 8 characters';

  @override
  String get authPasswordNeedsDigit => 'Must contain at least one digit';

  @override
  String get authAccept => 'I accept ';

  @override
  String get authTerms => 'Terms';

  @override
  String get authAnd => ' and ';

  @override
  String get authPrivacyPolicy => 'Privacy Policy';

  @override
  String get authAcceptTermsError =>
      'You must accept the terms and privacy policy.';

  @override
  String get authRegisterButton => 'Create account';

  @override
  String get authRegisterError => 'Registration error';

  @override
  String get authHasAccount => 'Already have an account? ';

  @override
  String get authForgotTitle => 'Forgot password?';

  @override
  String get authForgotSubtitle =>
      'Enter your email address and we\'ll send you a reset code.';

  @override
  String get authSendCode => 'Send code';

  @override
  String get authCodeSent =>
      'If an account exists with this email, you\'ll receive a reset code.';

  @override
  String get authSendCodeError => 'Error sending code. Try again.';

  @override
  String get authRememberPassword => 'Remember your password? ';

  @override
  String get authVerifyTitle => 'Verify code';

  @override
  String authCodeSentTo(String email) {
    return 'We sent a 6-digit code to $email';
  }

  @override
  String authExpiresIn(String time) {
    return 'Expires in $time';
  }

  @override
  String get authCodeExpired => 'Code expired';

  @override
  String get authEnterAllDigits => 'Enter all 6 digits';

  @override
  String get authInvalidCode => 'Invalid or expired code';

  @override
  String get authVerifyButton => 'Verify';

  @override
  String get authNoCode => 'Didn\'t receive the code? ';

  @override
  String get authResend => 'Resend';

  @override
  String get authResending => 'Sending...';

  @override
  String get authNewCodeSent => 'New code sent!';

  @override
  String get authResendError => 'Error resending';

  @override
  String get authNewPassword => 'New password';

  @override
  String get authNewPasswordSubtitle =>
      'Choose a new password for your account.';

  @override
  String get authNewPasswordLabel => 'New password';

  @override
  String get authConfirmPassword => 'Confirm password';

  @override
  String get authPasswordIsRequired => 'Password is required';

  @override
  String get authConfirmRequired => 'Confirmation is required';

  @override
  String get authPasswordsMismatch => 'Passwords don\'t match';

  @override
  String get authResetButton => 'Reset password';

  @override
  String get authResetSuccess => 'Password changed successfully!';

  @override
  String get authResetError =>
      'Error resetting password. The code may have expired.';

  @override
  String get onboardingSkip => 'Skip';

  @override
  String get onboardingContinue => 'Continue';

  @override
  String get onboardingStart => 'Get started';

  @override
  String get onboardingTitle1 => 'Discover offers';

  @override
  String get onboardingDesc1 =>
      'Find verified deals from barbershops, restaurants, fitness and 12+ categories in your city.';

  @override
  String get onboardingTrust1 => '100% Free';

  @override
  String get onboardingTrustDesc1 => 'No hidden costs, no subscriptions';

  @override
  String get onboardingTitle2 => 'Follow businesses';

  @override
  String get onboardingDesc2 =>
      'Subscribe to your favorite businesses and get notified when new offers appear.';

  @override
  String get onboardingTrust2 => 'Verified Businesses';

  @override
  String get onboardingTrustDesc2 => 'The OFAI team verifies every partner';

  @override
  String get onboardingTitle3 => 'Save more';

  @override
  String get onboardingDesc3 =>
      'Save offers to favorites, reveal promo codes and take advantage of exclusive deals.';

  @override
  String get onboardingTrust3 => 'Personalized Offers';

  @override
  String get onboardingTrustDesc3 => 'Based on your city and preferences';

  @override
  String get homeSubtitle => 'The best deals in your city';

  @override
  String get searchHint => 'Search offers, businesses...';

  @override
  String get categories => 'Categories';

  @override
  String get discoverCities => 'Discover cities';

  @override
  String get dealOfDay => 'Deal of the Day';

  @override
  String get flashOffers => 'Flash Deals';

  @override
  String get collections => 'Collections';

  @override
  String offersCount(int count) {
    return '$count offers';
  }

  @override
  String get recentlyViewed => 'Recently viewed';

  @override
  String get forYou => 'For you';

  @override
  String get popularOffers => 'Popular offers';

  @override
  String get noOffersAvailable => 'No offers available';

  @override
  String get checkBackLater => 'Check back later for new offers';

  @override
  String get errorLoadingOffers => 'Could not load offers';

  @override
  String get promotedOffers => 'Promoted Offers';

  @override
  String get partnerBusinesses => 'Partner businesses';

  @override
  String get businesses => 'Businesses';

  @override
  String get noBusinessAvailable => 'No business available';

  @override
  String get checkBackLaterShort => 'Check back later';

  @override
  String get errorLoadingBusinesses => 'Could not load businesses';

  @override
  String get seeAll => 'See all';

  @override
  String get explore => 'Explore';

  @override
  String get cityFilter => 'City';

  @override
  String get categoryFilter => 'Category';

  @override
  String get saveSearch => 'Save';

  @override
  String get resetFilters => 'Reset';

  @override
  String get offers => 'Offers';

  @override
  String showingResults(int count, int total, String type) {
    return 'Showing $count of $total $type';
  }

  @override
  String get noOfferFound => 'No offer found';

  @override
  String get tryOtherFilters => 'Try other filters or search something else';

  @override
  String get noBusinessFound => 'No business found';

  @override
  String get searchSaved => 'Search saved!';

  @override
  String get searchSaveError => 'Error saving (max 10)';

  @override
  String get locationUnavailable => 'Location unavailable';

  @override
  String get locationError => 'Could not determine location';

  @override
  String get recentSearches => 'Recent searches';

  @override
  String get deleteAll => 'Delete all';

  @override
  String get myPreferences => 'My preferences';

  @override
  String get chooseCity => 'Choose city';

  @override
  String get allCities => 'All cities';

  @override
  String get chooseCategory => 'Choose category';

  @override
  String get allCategories => 'All categories';

  @override
  String get sorting => 'Sort';

  @override
  String get sortDefault => 'Default';

  @override
  String get sortPopular => 'Popular';

  @override
  String get sortDiscount => 'Highest discount';

  @override
  String get sortEndingSoon => 'Ending soon';

  @override
  String get sortDistance => 'Distance';

  @override
  String get loginToSaveOffers => 'Sign in to save offers';

  @override
  String get loginToSaveSubtitle =>
      'Save your favorite offers and follow your favorite businesses';

  @override
  String get signIn => 'Sign in';

  @override
  String get myCollection => 'My Collection';

  @override
  String get searchInOffers => 'Search in offers...';

  @override
  String get searchInBusinesses => 'Search in businesses...';

  @override
  String get sortNameAZ => 'Name A-Z';

  @override
  String get sortRating => 'Rating';

  @override
  String get sortDiscountShort => 'Discount';

  @override
  String get sortEndingSoonShort => 'Ending soon';

  @override
  String get sortDistanceShort => 'Distance';

  @override
  String get loadingError => 'Loading error';

  @override
  String get retry => 'Retry';

  @override
  String get noFavoriteOffers => 'No favorite offers';

  @override
  String get noFavoriteOffersSubtitle =>
      'Save offers from the explore page or from offer details';

  @override
  String get noResults => 'No results';

  @override
  String get noFavoriteOfferMatch => 'No favorite offer matches your search';

  @override
  String removedFromFavorites(String name) {
    return '$name removed from favorites';
  }

  @override
  String get cancel => 'Cancel';

  @override
  String get removeError => 'Error removing';

  @override
  String get noFollowedBusinesses => 'Not following any business';

  @override
  String get noFollowedBusinessesSubtitle =>
      'Follow businesses to get notified about their offers';

  @override
  String get noFollowedBusinessMatch =>
      'No followed business matches your search';

  @override
  String removedFromFollowed(String name) {
    return '$name removed from followed';
  }

  @override
  String get shareOffer => 'Share offer';

  @override
  String get reportOffer => 'Report offer';

  @override
  String get reportSent => 'Report sent. Thank you!';

  @override
  String get report => 'Report';

  @override
  String get flashOffer => 'Flash deal';

  @override
  String offerTitle(String title) {
    return 'Offer title: $title';
  }

  @override
  String get trending => 'Trending';

  @override
  String saveCount(int count) {
    return '$count saves';
  }

  @override
  String validPeriod(String start, String end) {
    return 'Valid: $start - $end';
  }

  @override
  String get active => 'Active';

  @override
  String get expired => 'Expired';

  @override
  String get conditions => 'Conditions';

  @override
  String get howToUseOffer => 'How to use the offer';

  @override
  String get redemptionCall => 'Call and mention the OFAI offer';

  @override
  String get redemptionWhatsapp =>
      'Message on WhatsApp and mention the OFAI offer';

  @override
  String get redemptionOnline => 'Book online and mention the OFAI offer';

  @override
  String get redemptionBooking => 'Mention the OFAI offer when booking';

  @override
  String get redemptionAppointment =>
      'Mention the OFAI offer at your appointment';

  @override
  String get redemptionOrder => 'Mention the OFAI offer when ordering';

  @override
  String get redemptionCheckout =>
      'Apply the code or mention the OFAI offer at checkout';

  @override
  String get redemptionShowPage => 'Show this page to get the discount';

  @override
  String get redemptionDefault => 'Mention the OFAI offer to get the discount';

  @override
  String get codesExhausted => 'Codes are exhausted';

  @override
  String codesRemaining(int count) {
    return 'Only $count codes remaining!';
  }

  @override
  String get business => 'Business';

  @override
  String get locations => 'Locations';

  @override
  String get booking => 'Booking';

  @override
  String get phone => 'Phone';

  @override
  String get online => 'Online';

  @override
  String get similarOffers => 'Similar offers';

  @override
  String galleryCount(int count) {
    return 'Gallery ($count)';
  }

  @override
  String get galleryImage => 'Gallery image';

  @override
  String get callNow => 'Call now';

  @override
  String get bookOnline => 'Book online';

  @override
  String get saved => 'Saved';

  @override
  String get save => 'Save';

  @override
  String get errorLoadingOffer => 'Could not load offer';

  @override
  String get promoCode => 'Promo Code';

  @override
  String get loginToSeeCode => 'Sign in to see the code';

  @override
  String get codeUnavailable => 'Code unavailable';

  @override
  String get codeLoadError => 'Could not load code';

  @override
  String get showCodeAtCheckout => 'Show this code at checkout';

  @override
  String get codeCopied => 'Code copied to clipboard';

  @override
  String get revealCode => 'Reveal code';

  @override
  String get copyCode => 'Copy code';

  @override
  String get tapForFullscreen => 'Tap for fullscreen';

  @override
  String get tryAgain => 'Try again';

  @override
  String discountLabel(String label) {
    return 'Discount $label';
  }

  @override
  String get shareBusiness => 'Share business';

  @override
  String get reportBusiness => 'Report business';

  @override
  String get thisIsYourBusiness => 'This is your business';

  @override
  String get manageOnWeb => 'Manage on Web';

  @override
  String followersCount(int count) {
    return '$count followers';
  }

  @override
  String reviewsCount(int count) {
    return '($count reviews)';
  }

  @override
  String get writeReview => 'Write review';

  @override
  String get reviewSummary => 'Review summary';

  @override
  String get contact => 'Contact';

  @override
  String get activeOffers => 'Active offers';

  @override
  String get reviews => 'Reviews';

  @override
  String get noReviewsYet => 'No reviews yet';

  @override
  String get beFirstToReview => 'Be the first to write a review!';

  @override
  String get loadMoreReviews => 'Load more reviews';

  @override
  String get followed => 'Followed';

  @override
  String get follow => 'Follow';

  @override
  String get errorLoadingBusiness => 'Could not load business';

  @override
  String get premiumBusiness => 'Premium Business';

  @override
  String get verifiedBusiness => 'Verified Business';

  @override
  String get premiumDescription =>
      'This business has an OFAI Premium subscription. It benefits from increased visibility, advanced analytics, and priority support.';

  @override
  String get verifiedDescription =>
      'This business has been verified by the OFAI team. We verify identity, location, and service quality to ensure a trustworthy experience.';

  @override
  String get writeAReview => 'Write a review';

  @override
  String get commentHint => 'Write a comment (optional)...';

  @override
  String get submitReview => 'Submit review';

  @override
  String get submitError => 'Error submitting';

  @override
  String get deleteReviewTitle => 'Delete review?';

  @override
  String get deleteReviewBody =>
      'The review and any business reply will be permanently deleted.';

  @override
  String get delete => 'Delete';

  @override
  String get reviewDeleted => 'Review deleted';

  @override
  String get reviewDeleteError => 'Error deleting review';

  @override
  String ratingLabel(String rating, int count) {
    return 'Rating $rating out of 5, $count reviews';
  }

  @override
  String get welcomeTitle => 'Welcome!';

  @override
  String get loginToAccessAccount => 'Sign in to access your account';

  @override
  String get createAccount => 'Create account';

  @override
  String get favorites => 'Favorites';

  @override
  String get following => 'Following';

  @override
  String get badgesEarned => 'Badges earned';

  @override
  String get selectForReviews => 'Select for reviews';

  @override
  String get savedSearches => 'Saved searches';

  @override
  String get preferences => 'Preferences & Notifications';

  @override
  String get addBusiness => 'Add business';

  @override
  String get terms => 'Terms';

  @override
  String get privacy => 'Privacy';

  @override
  String get exportData => 'Export data';

  @override
  String get deleteAccount => 'Delete account';

  @override
  String shareText(String code) {
    return 'Discover the best deals in your city on OFAI! Use my link: https://ofai.ro/r/$code';
  }

  @override
  String get prefTitle => 'Preferences & Notifications';

  @override
  String get prefCities => 'Preferred cities';

  @override
  String get prefCitiesHelp => 'You can select multiple cities';

  @override
  String get prefCategories => 'Preferred categories';

  @override
  String get prefCategoriesHelp => 'Select the categories that interest you';

  @override
  String get prefNotifications => 'Notifications';

  @override
  String get prefNotificationsHelp => 'Choose which notifications you receive';

  @override
  String get prefDealOfDay => 'Deal of the Day';

  @override
  String get prefFollowedBusiness => 'Followed businesses';

  @override
  String get prefFlashDeals => 'Flash deals';

  @override
  String get prefWeeklyDigest => 'Weekly digest';

  @override
  String get prefReviewPrompt => 'Review request';

  @override
  String get prefSavedSearch => 'Saved searches';

  @override
  String get prefMarketing => 'Marketing';

  @override
  String get prefSave => 'Save preferences';

  @override
  String get prefUpdated => 'Preferences updated';

  @override
  String get prefErrorCities => 'Could not load cities';

  @override
  String get prefErrorCategories => 'Could not load categories';

  @override
  String get changePasswordTitle => 'Change password';

  @override
  String get currentPassword => 'Current password';

  @override
  String get currentPasswordHint => 'Enter current password';

  @override
  String get currentPasswordRequired => 'Current password is required';

  @override
  String get newPassword => 'New password';

  @override
  String get newPasswordHint => 'Min 8 characters, at least one digit';

  @override
  String get newPasswordRequired => 'New password is required';

  @override
  String get minChars => 'Minimum 8 characters';

  @override
  String get needsDigit => 'Must contain at least one digit';

  @override
  String get confirmPassword => 'Confirm password';

  @override
  String get confirmPasswordHint => 'Repeat new password';

  @override
  String get confirmRequired => 'Confirmation is required';

  @override
  String get passwordsMismatch => 'Passwords don\'t match';

  @override
  String get passwordChanged => 'Password changed';

  @override
  String get editProfileTitle => 'Edit profile';

  @override
  String get firstName => 'First name';

  @override
  String get firstNameHint => 'Your first name';

  @override
  String get firstNameRequired => 'First name is required';

  @override
  String get lastName => 'Last name';

  @override
  String get lastNameHint => 'Your last name';

  @override
  String get lastNameRequired => 'Last name is required';

  @override
  String get email => 'Email';

  @override
  String get nameChangeLimit => 'Name can be changed once every 30 days.';

  @override
  String get showPictureInReviews => 'Show picture in reviews';

  @override
  String get profileUpdated => 'Profile photo updated!';

  @override
  String get saveError => 'Error saving';

  @override
  String get deleteAccountTitle => 'Delete account';

  @override
  String get deleteWarning => 'Warning!';

  @override
  String get deleteWarningBody =>
      'Account deletion is irreversible. All your data will be permanently deleted, including:';

  @override
  String get deleteItem1 => 'Profile and personal data';

  @override
  String get deleteItem2 => 'Written reviews';

  @override
  String get deleteItem3 => 'Favorite offers';

  @override
  String get deleteItem4 => 'Business subscriptions';

  @override
  String get deleteItem5 => 'Activity history';

  @override
  String get confirmWithPassword => 'Confirm with password';

  @override
  String get enterAccountPassword => 'Enter account password';

  @override
  String get passwordRequiredForDelete => 'Enter password to confirm';

  @override
  String get googleDeleteInfo =>
      'Your account is connected via Google. Press the button below to confirm deletion.';

  @override
  String get deleteAccountButton => 'Delete account permanently';

  @override
  String get confirmDeleteTitle => 'Confirm deletion';

  @override
  String get confirmDeleteBody =>
      'Are you sure you want to delete your account? This action is irreversible and all your data will be permanently deleted.';

  @override
  String get cancelAction => 'Cancel';

  @override
  String get deleteAccountAction => 'Delete account';

  @override
  String get myData => 'My Data';

  @override
  String get exportError => 'Export error';

  @override
  String get gdprInfo =>
      'This is all your data stored on the OFAI platform, in accordance with GDPR.';

  @override
  String get shareData => 'Share data';

  @override
  String get myDataSubject => 'OFAI - My Data';

  @override
  String errorGeneric(String message) {
    return 'Error: $message';
  }

  @override
  String get unexpectedError => 'An unexpected error occurred';

  @override
  String get errorOccurred => 'An error occurred';

  @override
  String get unfollowBusiness => 'Unfollow';

  @override
  String get businessResponse => 'Business response';

  @override
  String get newBadge => 'New';

  @override
  String get removeFromFavorites => 'Remove from favorites';

  @override
  String get addToFavorites => 'Add to favorites';

  @override
  String get promoted => 'PROMOTED';

  @override
  String get saveSingular => '1 save';

  @override
  String savePlural(int count) {
    return '$count saves';
  }

  @override
  String get helpTitle => 'Help & Support';

  @override
  String get helpSubtitle => 'How can we help?';

  @override
  String get helpDescription =>
      'The OFAI team is here for you. We usually respond within 24 hours.';

  @override
  String get helpEmailTitle => 'Email';

  @override
  String get helpEmailValue => 'contact@ofai.ro';

  @override
  String get helpPhoneTitle => 'Phone';

  @override
  String get helpPhoneValue => '+40 700 000 000';

  @override
  String get helpFaqTitle => 'Frequently asked questions';

  @override
  String get helpLinksTitle => 'Useful links';

  @override
  String get helpTermsLink => 'Terms and conditions';

  @override
  String get helpPrivacyLink => 'Privacy policy';

  @override
  String get helpFaq1Q => 'How does the platform work?';

  @override
  String get helpFaq1A =>
      'OFAI helps you discover deals and discounts from local businesses. You can search by city, category or keywords, save your favorite offers and follow preferred businesses.';

  @override
  String get helpFaq2Q => 'How do I earn points?';

  @override
  String get helpFaq2A =>
      'You earn points for your activity on the platform: writing reviews, daily visits and interacting with offers.';

  @override
  String get helpFaq3Q => 'How can I use my points?';

  @override
  String get helpFaq3A =>
      'Accumulated points contribute to your progress on the platform. The more points you have, the higher your level and the more badges you unlock.';

  @override
  String get helpFaq4Q => 'How do I change my city?';

  @override
  String get helpFaq4A =>
      'Go to Account > Preferences and select your desired city. Offers and businesses will be filtered automatically.';

  @override
  String get helpFaq5Q => 'How do I follow a business?';

  @override
  String get helpFaq5A =>
      'Open the business page and tap the \"Follow\" button. You\'ll receive notifications when the business adds new offers.';

  @override
  String get helpFaq6Q => 'How do I leave a review?';

  @override
  String get helpFaq6A =>
      'Open the business page and tap \"Write a review\". Choose a rating from 1 to 5 stars and optionally leave a comment.';

  @override
  String get helpFaq7Q => 'How do I delete my account?';

  @override
  String get helpFaq7A =>
      'Go to Account > Delete account. This action is irreversible and all your data will be permanently deleted.';

  @override
  String get helpFaq8Q => 'How do I register a business?';

  @override
  String get helpFaq8A =>
      'From Account, tap \"Add a business\" and fill in the form. Our team will review your request and notify you.';

  @override
  String get bizReqTitle => 'Add a business';

  @override
  String get bizReqSubtitle =>
      'Suggest a business that is not yet on the platform.';

  @override
  String get bizReqNameLabel => 'Business name *';

  @override
  String get bizReqNameHint => 'E.g.: Elite Salon';

  @override
  String get bizReqNameRequired => 'Name is required';

  @override
  String get bizReqCityLabel => 'City *';

  @override
  String get bizReqCityHint => 'Choose city';

  @override
  String get bizReqCityRequired => 'City is required';

  @override
  String get bizReqCategoryLabel => 'Category';

  @override
  String get bizReqCategoryHint => 'Choose category';

  @override
  String get bizReqAddressLabel => 'Address';

  @override
  String get bizReqAddressHint => 'E.g.: 10 Victoriei St., Cluj-Napoca';

  @override
  String get bizReqPhoneLabel => 'Phone';

  @override
  String get bizReqPhoneHint => 'E.g.: 0712 345 678';

  @override
  String get bizReqWebsiteLabel => 'Website';

  @override
  String get bizReqWebsiteHint => 'E.g.: www.elitesalon.ro';

  @override
  String get bizReqDescLabel => 'Description';

  @override
  String get bizReqDescHint => 'Briefly describe the business...';

  @override
  String get bizReqSubmit => 'Submit request';

  @override
  String get bizReqSuccessTitle => 'Request sent!';

  @override
  String get bizReqSuccessBody =>
      'Your request has been registered. We will review it and notify you when it is approved.';

  @override
  String get bizReqError =>
      'Error sending request. Do you already have a pending request?';

  @override
  String get reportOfferTitle => 'Report offer';

  @override
  String get reportBusinessTitle => 'Report business';

  @override
  String get reportSelectReason => 'Select the reason for reporting:';

  @override
  String get reportFakeOffer => 'Offer is not real';

  @override
  String get reportMisleadingPrice => 'Misleading price';

  @override
  String get reportInappropriate => 'Inappropriate content';

  @override
  String get reportSpam => 'Spam / aggressive advertising';

  @override
  String get reportOther => 'Other';

  @override
  String get reportClosedBusiness => 'Business closed / non-existent';

  @override
  String get reportDetailsHint => 'Describe the issue...';

  @override
  String get reportDetailsMinLength =>
      'Please describe the issue (minimum 5 characters).';

  @override
  String get reportSubmitBtn => 'Submit report';

  @override
  String get reportErrorGeneric => 'Error submitting report.';

  @override
  String get reportErrorDuplicate => 'You have already reported this resource.';

  @override
  String get reportErrorRateLimit =>
      'You have reached the report limit for today.';

  @override
  String get myReportsTitle => 'My Reports';

  @override
  String get myReportsEmpty => 'No reports submitted';

  @override
  String get myReportsEmptySubtitle => 'Your reports will appear here';

  @override
  String reportOfferTarget(int id) {
    return 'Offer #$id';
  }

  @override
  String reportBusinessTarget(int id) {
    return 'Business #$id';
  }

  @override
  String get reportWithdrawTitle => 'Withdraw report?';

  @override
  String get reportWithdrawBody => 'The report will be permanently deleted.';

  @override
  String get reportWithdrawConfirm => 'Withdraw';

  @override
  String get reportWithdrawn => 'Report has been withdrawn';

  @override
  String get reportWithdrawError => 'Could not withdraw report';

  @override
  String get reportStatusPending => 'Pending';

  @override
  String get reportStatusReviewed => 'Reviewed';

  @override
  String get reportStatusResolved => 'Resolved';

  @override
  String get reportStatusUnknown => 'Unknown';

  @override
  String get profilePickGallery => 'Choose from gallery';

  @override
  String get profileDeletePhoto => 'Delete photo';

  @override
  String get profileUploading => 'Uploading photo...';

  @override
  String get profileDeleted => 'Profile photo deleted';

  @override
  String get badgeSelected => 'Badge selected!';

  @override
  String get badgeDeselected => 'Badge deactivated';

  @override
  String get categoriesTitle => 'Categories';

  @override
  String get categoriesEmpty => 'No categories available';

  @override
  String get categoriesError => 'Error loading categories';

  @override
  String get categoriesRetry => 'Retry';

  @override
  String get citiesTitle => 'Cities';

  @override
  String get citiesEmpty => 'No cities available';

  @override
  String get citiesError => 'Error loading cities';

  @override
  String get savedSearchesTitle => 'Saved Searches';

  @override
  String get savedSearchesEmpty => 'No saved searches';

  @override
  String get savedSearchesEmptySubtitle =>
      'Save searches from Explore to get notified when new offers appear.';

  @override
  String get tabOffers => 'Offers';

  @override
  String get tabGallery => 'Gallery';

  @override
  String get tabMenu => 'Menu';

  @override
  String get tabSchedule => 'Schedule';

  @override
  String get tabReviews => 'Reviews';

  @override
  String get tabContact => 'Contact';

  @override
  String get tabDetails => 'Details';

  @override
  String get seeAllPhotos => 'All >';

  @override
  String photosCount(int count) {
    return 'Photos ($count)';
  }

  @override
  String get expandHours => 'See full schedule';

  @override
  String get collapseHours => 'Collapse';

  @override
  String get legalEntity => 'Legal entity';

  @override
  String get cuiLabel => 'CUI / CIF';

  @override
  String get foundedYearLabel => 'Founded';

  @override
  String get verifiedSince => 'Verified since';

  @override
  String get callNowCta => 'Call now';

  @override
  String get bookNowCta => 'Book now';

  @override
  String get navigateCta => 'Navigate';

  @override
  String get noPhotos => 'No photos yet';

  @override
  String get credibilityTitle => 'Legal information';

  @override
  String get stepChooseOffer => 'Choose offer';

  @override
  String get stepChooseOfferDesc => 'Check details and conditions';

  @override
  String get stepContact => 'Contact';

  @override
  String get stepContactDesc => 'Call or book online';

  @override
  String get stepEnjoy => 'Enjoy!';

  @override
  String get stepEnjoyDesc => 'Show the offer and enjoy the discount';

  @override
  String get stepCopyCode => 'Copy code';

  @override
  String get stepCopyCodeDesc => 'Copy the promo code';

  @override
  String get stepUseCode => 'Use code';

  @override
  String get stepUseCodeDesc => 'Use the code at checkout';

  @override
  String get enjoyNowCta => 'Get it now';

  @override
  String get revealCodeCta => 'Reveal code';

  @override
  String get openNow => 'Open now';

  @override
  String get closedNow => 'Closed';
}
