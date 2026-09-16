import i18next from 'i18next';
import en_US from './en_US';
import zh_CN from './zh_CN';
import { LocalStorageUtil } from '@studio/utils/function';
import { LANG_KEY } from '@studio/utils/constant';
import { Language } from '@studio/utils/i18n';
import { brandConfig } from '@studio/utils';

export const defaultNS = 'common';

const i18n = i18next.createInstance();
const defaultLanguage = LocalStorageUtil.getItem<string>(LANG_KEY) || (brandConfig.defaultLanguage as Language);

i18n.init({
  lng: defaultLanguage,
  fallbackLng: Language.EN_US,
  debug: process.env.NODE_ENV === 'development',
  resources: {
    [Language.EN_US]: en_US,
    [Language.ZH_CN]: zh_CN,
  },
});

export { Language };

export default i18n;
