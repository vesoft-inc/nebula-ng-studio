import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import { GlobalModal } from '@vesoft-inc/ui-components/modal';
import { ThemeWrapper, themeStore } from '@vesoft-inc/ui-components/theme';
import { useBrowserRouter } from '@vesoft-inc/utils';
import { observer } from 'mobx-react-lite';
import { autorun } from 'mobx';
import { StoreProvider, useStore } from './stores';
import i18n from '@gui/utils/i18n';
import { injectCssVariable } from '@studio/utils';
import PageLoading from '@studio/components/PageLoading';
import routes from '@gui/routes';

const PageRoot = observer(() => {
  const rootStore = useStore();
  const { routerStore } = rootStore;
  autorun(() => {
    injectCssVariable(themeStore.theme);
  });

  const router = useBrowserRouter({
    store: routerStore,
    future: { v7_startTransition: true },
    basename: window.APP_CONFIG?.basePath,
    routes,
  });

  return (
    <StrictMode>
      <StoreProvider value={rootStore}>
        <I18nextProvider i18n={i18n}>
          <ThemeWrapper>
            <Suspense fallback={<PageLoading />}>
              <RouterProvider router={router} />
              <GlobalModal store={rootStore.modalStore} />
            </Suspense>
          </ThemeWrapper>
        </I18nextProvider>
      </StoreProvider>
    </StrictMode>
  );
});

const rootElement = document.getElementById('guiApp');
const root = import.meta.hot?.data?.root || createRoot(rootElement!);
import.meta.hot?.dispose(() => {
  import.meta.hot!.data.root = root;
});
root.render(<PageRoot />);
