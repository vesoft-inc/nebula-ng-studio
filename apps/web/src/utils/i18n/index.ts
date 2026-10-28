import i18next from 'i18next';
import en_US from './en_US';
import zh_CN from './zh_CN';
import { LocalStorageUtil } from '@vesoft-inc/studio-core/browser';
import { LANG_KEY } from '@studio/utils/constant';
import z from 'zod';
import { brandConfig } from '@studio/utils';

export const defaultNS = 'common';

export const enum Language {
  EN_US = 'en_US',
  ZH_CN = 'zh_CN',
}

const i18n = i18next.createInstance();

const defaultLanguage = LocalStorageUtil.getItem<string>(LANG_KEY) || (brandConfig.defaultLanguage as Language);

i18n.init({
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  debug: process.env.NODE_ENV === 'development',
  resources: {
    [Language.EN_US]: en_US,
    [Language.ZH_CN]: zh_CN,
  },
});

const initZodLocale = (lng: string) => {
  if (lng === Language.ZH_CN) {
    z.config(z.locales.zhCN());
  } else if (lng === Language.EN_US) {
    z.config(z.locales.en());
  } else {
    z.config(z.locales.en());
  }
};

initZodLocale(defaultLanguage);

i18n.on('languageChanged', (lng) => {
  initZodLocale(lng);
});

export default i18n;
