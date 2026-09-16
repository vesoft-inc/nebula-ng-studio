/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEBULA_STUDIO_BRAND_NAME: string;
  readonly NEBULA_STUDIO_BRAND_NAME_ZH_CN: string;
  readonly NEBULA_STUDIO_BRAND_CONSOLE_NAME: string;
  readonly NEBULA_STUDIO_BRAND_CONSOLE_PROMPT: string;
  readonly NEBULA_STUDIO_BRAND_STUDIO_TITLE: string;
  readonly NEBULA_STUDIO_BRAND_GUI_TITLE: string;
  readonly NEBULA_STUDIO_COPYRIGHT: string;
  readonly NEBULA_STUDIO_BRAND_HELP_URL_TEMPLATE: string;
  readonly NEBULA_STUDIO_DEFAULT_LANGUAGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
