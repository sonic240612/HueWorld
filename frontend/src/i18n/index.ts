import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';
import ja from './locales/ja.json';

const STORAGE_KEY = 'hueworld_lang';
const savedLang = localStorage.getItem(STORAGE_KEY) || 'ko';

i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en }, ja: { translation: ja } },
  lng: savedLang,
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

export function hasSavedLanguage(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function setLanguage(lang: string) {
  localStorage.setItem(STORAGE_KEY, lang);
  i18n.changeLanguage(lang);
}

export default i18n;
