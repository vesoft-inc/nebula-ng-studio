import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider, useTheme, type Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { useThemeWithoutDefault } from '@mui/system';
import { deepmerge } from '@mui/utils';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import ModalStore from './shared/Modal/ModalStore';
import GlobalModal from './shared/Modal/GlobalModal';
import { DARK_PALETTE, LIGHT_PALETTE, ThemeStore } from './theme';
import { createUiI18n } from './locales';

export interface UiProviderProps {
  children: ReactNode;
  /** Host theme; missing Vesoft colors are filled according to its palette mode. */
  theme?: Theme;
  i18n?: I18n;
  locale?: string;
  modalStore?: ModalStore;
  renderGlobalModal?: boolean;
  cssBaseline?: boolean;
}

const UiContext = createContext<{ modalStore: ModalStore } | null>(null);

/** Supplies standalone defaults while allowing applications to share their theme and translations. */
export function UiProvider({
  children,
  theme,
  i18n,
  locale,
  modalStore,
  renderGlobalModal = true,
  cssBaseline = true,
}: UiProviderProps) {
  const inheritedTheme = useTheme();
  const hasInheritedTheme = useThemeWithoutDefault<object | null>() !== null;
  const [defaults] = useState(() => ({
    theme: new ThemeStore().theme,
    i18n: createUiI18n(locale),
    modalStore: new ModalStore(),
  }));
  const selectedI18n = i18n ?? defaults.i18n;
  const selectedModal = modalStore ?? defaults.modalStore;
  const selectedTheme = useMemo(() => {
    const hostTheme = theme ?? (hasInheritedTheme ? inheritedTheme : undefined);
    if (!hostTheme) return defaults.theme;
    const palette = hostTheme.palette.mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
    return {
      ...hostTheme,
      palette: {
        ...hostTheme.palette,
        vesoft: deepmerge(palette.vesoft, hostTheme.palette.vesoft ?? {}),
      },
    };
  }, [theme, inheritedTheme, hasInheritedTheme, defaults.theme]);

  useEffect(() => {
    if (locale && selectedI18n.language !== locale) void selectedI18n.changeLanguage(locale);
  }, [locale, selectedI18n]);

  return (
    <UiContext.Provider value={{ modalStore: selectedModal }}>
      <I18nextProvider i18n={selectedI18n}>
        <ThemeProvider theme={selectedTheme}>
          {cssBaseline && <CssBaseline />}
          {children}
          {renderGlobalModal && <GlobalModal store={selectedModal} />}
        </ThemeProvider>
      </I18nextProvider>
    </UiContext.Provider>
  );
}

export function useUi() {
  const context = useContext(UiContext);
  if (!context) throw new Error('UiProvider is required');
  return context;
}
