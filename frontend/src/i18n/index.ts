import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const savedLang = localStorage.getItem('hueworld_lang') || 'ko';

i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en }, ja: { translation: ja } },
  lng: savedLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: string) {
  localStorage.setItem('hueworld_lang', lang);
  i18n.changeLanguage(lang);
}

export default i18n;
