import './registerStudioTransport';
import { StrictMode, Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import { GlobalModal } from '@vesoft-inc/ui-components/modal';
import { ThemeWrapper, themeStore } from '@vesoft-inc/ui-components/theme';
import { useBrowserRouter } from '@vesoft-inc/utils';
import { autorun } from 'mobx';
import { modalStore, routerStore } from './stores/session';
import i18n from '@gui/utils/i18n';
import { injectCssVariable } from '@studio/utils';
import PageLoading from '@studio/components/PageLoading';
import routes from '@gui/routes';

const PageRoot = () => {
  useEffect(() => {
    return autorun(() => {
      injectCssVariable(themeStore.theme);
    });
  }, []);

  const router = useBrowserRouter({
    store: routerStore,
    future: { v7_startTransition: true },
    basename: window.APP_CONFIG?.basePath,
    routes,
  });

  return (
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ThemeWrapper>
          <Suspense fallback={<PageLoading />}>
            <RouterProvider router={router} />
            <GlobalModal store={modalStore} />
          </Suspense>
        </ThemeWrapper>
      </I18nextProvider>
    </StrictMode>
  );
};

const rootElement = document.getElementById('guiApp');
const root = import.meta.hot?.data?.root || createRoot(rootElement!);
import.meta.hot?.dispose(() => {
  import.meta.hot!.data.root = root;
});
root.render(<PageRoot />);
