import i18next from 'i18next';
import en_US from './en_US';
import zh_CN from './zh_CN';

export { en_US, zh_CN };
export enum Language {
  EN_US = 'en_US',
  ZH_CN = 'zh_CN',
}

export const uiResources = { en_US, zh_CN };

export function createUiI18n(language = 'en_US') {
  const instance = i18next.createInstance();
  void instance.init({
    lng: language,
    fallbackLng: 'en_US',
    defaultNS: 'common',
    resources: uiResources,
    initImmediate: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

/** Fallback for controllers used outside React. React hosts supply their own translator. */
export const defaultUiI18n = createUiI18n();
