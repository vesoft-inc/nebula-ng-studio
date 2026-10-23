/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly STUDIO_BRAND_NAME: string;
  readonly STUDIO_BRAND_NAME_ZH_CN: string;
  readonly STUDIO_BRAND_CONSOLE_NAME: string;
  readonly STUDIO_BRAND_CONSOLE_PROMPT: string;
  readonly STUDIO_BRAND_STUDIO_TITLE: string;
  readonly STUDIO_BRAND_GUI_TITLE: string;
  readonly STUDIO_BRAND_COPYRIGHT: string;
  readonly STUDIO_BRAND_HELP_URL_TEMPLATE: string;
  readonly STUDIO_DEFAULT_LANGUAGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
