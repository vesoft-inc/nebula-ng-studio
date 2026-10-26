import { AppTarget } from './constant';

export const isDevMode = () => process.env.NODE_ENV === 'development';

export const brandConfig = {
  name: import.meta.env.STUDIO_BRAND_NAME,
  nameZhCN: import.meta.env.STUDIO_BRAND_NAME_ZH_CN,
  consoleName: import.meta.env.STUDIO_BRAND_CONSOLE_NAME,
  consolePrompt: import.meta.env.STUDIO_BRAND_CONSOLE_PROMPT,
  studioTitle: import.meta.env.STUDIO_BRAND_STUDIO_TITLE,
  guiTitle: import.meta.env.STUDIO_BRAND_GUI_TITLE,
  copyright: import.meta.env.STUDIO_BRAND_COPYRIGHT,
  helpUrlTemplate: import.meta.env.STUDIO_BRAND_HELP_URL_TEMPLATE,
  defaultLanguage: import.meta.env.STUDIO_DEFAULT_LANGUAGE,
} as const;

export const isStudioTarget = process.env.APP_TARGET === AppTarget.Studio;
export const isGuiTarget = process.env.APP_TARGET === AppTarget.Gui;
