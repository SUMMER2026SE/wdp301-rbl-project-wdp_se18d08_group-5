import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_bn.dart';
import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_es.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_ja.dart';

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

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
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
    Locale('es'),
    Locale('fr'),
    Locale('de'),
    Locale('ja'),
    Locale('bn'),
  ];

  /// The title of the application
  ///
  /// In en, this message translates to:
  /// **'Flutter Riverpod Clean Architecture'**
  String get appTitle;

  /// The welcome message displayed on the home screen
  ///
  /// In en, this message translates to:
  /// **'Welcome to Flutter Riverpod Clean Architecture'**
  String get welcomeMessage;

  /// Label for the home tab or button
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// Label for the settings tab or button
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// Label for the profile tab or button
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// Label for the dark mode option
  ///
  /// In en, this message translates to:
  /// **'Dark Mode'**
  String get darkMode;

  /// Label for the light mode option
  ///
  /// In en, this message translates to:
  /// **'Light Mode'**
  String get lightMode;

  /// Label for the system theme mode option
  ///
  /// In en, this message translates to:
  /// **'System Mode'**
  String get systemMode;

  /// Label for the language setting
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// Label for changing the application language
  ///
  /// In en, this message translates to:
  /// **'Change application language'**
  String get change_language;

  /// Label for theme selection
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// Label for changing the application theme
  ///
  /// In en, this message translates to:
  /// **'Change application theme'**
  String get change_theme;

  /// Label for notifications settings
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifications;

  /// Label for notification settings description
  ///
  /// In en, this message translates to:
  /// **'Configure notification preferences'**
  String get notification_settings;

  /// Label for the localization demo option
  ///
  /// In en, this message translates to:
  /// **'Localization Demo'**
  String get localization_demo;

  /// Description for the localization demo option
  ///
  /// In en, this message translates to:
  /// **'View localization features in action'**
  String get localization_demo_description;

  /// Title for the language settings screen
  ///
  /// In en, this message translates to:
  /// **'Language Settings'**
  String get language_settings;

  /// Instruction to select a language
  ///
  /// In en, this message translates to:
  /// **'Select your preferred language'**
  String get select_your_language;

  /// Explanation of the language selection effects
  ///
  /// In en, this message translates to:
  /// **'The selected language will be applied across the entire application'**
  String get language_explanation;

  /// Title for the localization assets demo screen
  ///
  /// In en, this message translates to:
  /// **'Localization & Assets Demo'**
  String get localization_assets_demo;

  /// Label for displaying current language info
  ///
  /// In en, this message translates to:
  /// **'Current Language'**
  String get current_language;

  /// Label for language code
  ///
  /// In en, this message translates to:
  /// **'Language code'**
  String get language_code;

  /// Label for language name
  ///
  /// In en, this message translates to:
  /// **'Language name'**
  String get language_name;

  /// Title for formatting examples section
  ///
  /// In en, this message translates to:
  /// **'Formatting Examples'**
  String get formatting_examples;

  /// Label for full date format example
  ///
  /// In en, this message translates to:
  /// **'Date (full)'**
  String get date_full;

  /// Label for short date format example
  ///
  /// In en, this message translates to:
  /// **'Date (short)'**
  String get date_short;

  /// Label for time format example
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get time;

  /// Label for currency format example
  ///
  /// In en, this message translates to:
  /// **'Currency'**
  String get currency;

  /// Label for percent format example
  ///
  /// In en, this message translates to:
  /// **'Percent'**
  String get percent;

  /// Title for localized assets section
  ///
  /// In en, this message translates to:
  /// **'Localized Assets'**
  String get localized_assets;

  /// Explanation of localized assets feature
  ///
  /// In en, this message translates to:
  /// **'This section demonstrates how to load different assets based on the selected language. Images, audio, and other resources can be language-specific.'**
  String get localized_assets_explanation;

  /// Title for localized image example
  ///
  /// In en, this message translates to:
  /// **'Localized Image Example'**
  String get image_example;

  /// Caption for the welcome image example
  ///
  /// In en, this message translates to:
  /// **'This image is loaded based on your selected language'**
  String get welcome_image_caption;

  /// Title for common image example
  ///
  /// In en, this message translates to:
  /// **'Common Image Example'**
  String get common_image_example;

  /// Caption for the common image example
  ///
  /// In en, this message translates to:
  /// **'This image is the same across all languages'**
  String get common_image_caption;

  /// Label for the logout button
  ///
  /// In en, this message translates to:
  /// **'Logout'**
  String get logout;

  /// Label for the login button
  ///
  /// In en, this message translates to:
  /// **'Login'**
  String get login;

  /// Label for the email field
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// Label for the password field
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// Label for the sign in button
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get signIn;

  /// Label for the register button
  ///
  /// In en, this message translates to:
  /// **'Register'**
  String get register;

  /// Label for the forgot password button
  ///
  /// In en, this message translates to:
  /// **'Forgot Password?'**
  String get forgotPassword;

  /// Generic error message
  ///
  /// In en, this message translates to:
  /// **'An error occurred'**
  String get errorOccurred;

  /// Label for the try again button
  ///
  /// In en, this message translates to:
  /// **'Try Again'**
  String get tryAgain;

  /// A greeting message with the person's name
  ///
  /// In en, this message translates to:
  /// **'Hello, {name}!'**
  String greeting(String name);

  /// A plural message based on an item count
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No items} =1{1 item} other{{count} items}}'**
  String itemCount(num count);

  /// When something was last updated
  ///
  /// In en, this message translates to:
  /// **'Last updated: {date}'**
  String lastUpdated(DateTime date);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
    'bn',
    'de',
    'en',
    'es',
    'fr',
    'ja',
  ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'bn':
      return AppLocalizationsBn();
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
    case 'es':
      return AppLocalizationsEs();
    case 'fr':
      return AppLocalizationsFr();
    case 'ja':
      return AppLocalizationsJa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
