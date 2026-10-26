import { useEffect, type ReactNode } from 'react';
import { autorun } from 'mobx';
import { I18nextProvider } from 'react-i18next';
import { GraphResourcesProvider } from '@vesoft-inc/ui-components/graph/resources';
import { UiProvider } from '@vesoft-inc/ui-components/provider';
import { ThemeWrapper, themeStore } from '@vesoft-inc/ui-components/theme';
import { modalStore, iconGroupStore } from './session';
import i18n from '@studio/utils/i18n';
import { injectCssVariable } from '@vesoft-inc/ui-components/utilities';

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => autorun(() => injectCssVariable(themeStore.theme)), []);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeWrapper>
        <UiProvider i18n={i18n} modalStore={modalStore} renderGlobalModal={false} cssBaseline={false}>
          <GraphResourcesProvider value={iconGroupStore}>{children}</GraphResourcesProvider>
        </UiProvider>
      </ThemeWrapper>
    </I18nextProvider>
  );
}
