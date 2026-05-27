import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LANGUAGE, isSupportedLanguage, LANGUAGE_STORAGE_KEY } from './config';

import commonEn from './locales/en/common.json';
import navbarEn from './locales/en/navbar.json';
import homeEn from './locales/en/home.json';
import authEn from './locales/en/auth.json';
import profileEn from './locales/en/profile.json';
import errorsEn from './locales/en/errors.json';

import commonVi from './locales/vi/common.json';
import navbarVi from './locales/vi/navbar.json';
import homeVi from './locales/vi/home.json';
import authVi from './locales/vi/auth.json';
import profileVi from './locales/vi/profile.json';
import errorsVi from './locales/vi/errors.json';

import commonJa from './locales/ja/common.json';
import navbarJa from './locales/ja/navbar.json';
import homeJa from './locales/ja/home.json';
import authJa from './locales/ja/auth.json';
import profileJa from './locales/ja/profile.json';
import errorsJa from './locales/ja/errors.json';

const savedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
const lng = savedLanguage && isSupportedLanguage(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: commonEn,
      navbar: navbarEn,
      home: homeEn,
      auth: authEn,
      profile: profileEn,
      errors: errorsEn,
    },
    vi: {
      common: commonVi,
      navbar: navbarVi,
      home: homeVi,
      auth: authVi,
      profile: profileVi,
      errors: errorsVi,
    },
    ja: {
      common: commonJa,
      navbar: navbarJa,
      home: homeJa,
      auth: authJa,
      profile: profileJa,
      errors: errorsJa,
    },
  },
  lng,
  fallbackLng: DEFAULT_LANGUAGE,
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

i18n.on('languageChanged', (language) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
});

export default i18n;
