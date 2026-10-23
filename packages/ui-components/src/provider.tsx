import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ThemeProvider, useTheme, type Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import ModalStore from './shared/Modal/ModalStore';
import GlobalModal from './shared/Modal/GlobalModal';
import { ThemeStore } from './theme';
import { createUiI18n } from './locales';

export interface UiProviderProps {
  children: ReactNode;
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
  const [defaults] = useState(() => ({
    theme: new ThemeStore().theme,
    i18n: createUiI18n(locale),
    modalStore: new ModalStore(),
  }));
  const selectedI18n = i18n ?? defaults.i18n;
  const selectedModal = modalStore ?? defaults.modalStore;

  useEffect(() => {
    if (locale && selectedI18n.language !== locale) void selectedI18n.changeLanguage(locale);
  }, [locale, selectedI18n]);

  return (
    <UiContext.Provider value={{ modalStore: selectedModal }}>
      <I18nextProvider i18n={selectedI18n}>
        <ThemeProvider theme={theme ?? (inheritedTheme.palette.vesoft ? inheritedTheme : defaults.theme)}>
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
