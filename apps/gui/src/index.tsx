import '@vesoft-inc/studio-ui-internal/styles.css';
import { UiProvider } from '@vesoft-inc/studio-ui-internal/provider';
import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import { GlobalModal } from '@vesoft-inc/studio-ui-internal/modal';
import { ThemeWrapper, themeStore } from '@vesoft-inc/studio-ui-internal/theme';
import { createGuiRouter } from './app/router';
import { autorun } from 'mobx';
import { modalStore } from './stores/session';
import i18n from '@gui/utils/i18n';
import { injectCssVariable } from '@vesoft-inc/studio-ui-internal/utilities';
import { PageLoading } from '@vesoft-inc/studio-ui-internal';

const PageRoot = ({ router }: { router: ReturnType<typeof createGuiRouter>['router'] }) => {
  useEffect(() => {
    return autorun(() => {
      injectCssVariable(themeStore.theme);
    });
  }, []);

  return (
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeWrapper>
          <UiProvider i18n={i18n} modalStore={modalStore} renderGlobalModal={false} cssBaseline={false}>
            <Suspense fallback={<PageLoading />}>
              <RouterProvider router={router} future={{ v7_startTransition: true }} />
              <GlobalModal store={modalStore} />
            </Suspense>
          </UiProvider>
        </ThemeWrapper>
      </I18nextProvider>
    </StrictMode>
  );
};

const application = createGuiRouter();
const rootElement = document.getElementById('guiApp');
const root = import.meta.hot?.data?.root || createRoot(rootElement!);
import.meta.hot?.dispose(() => {
  application.dispose();
  import.meta.hot!.data.root = root;
});
root.render(<PageRoot router={application.router} />);
