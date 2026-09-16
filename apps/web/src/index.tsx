import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router-dom';
import { GlobalModal } from '@vesoft-inc/ui-components/modal';
import { ThemeWrapper } from '@vesoft-inc/ui-components/theme';
import { useBrowserRouter } from '@vesoft-inc/utils';
import { observer } from 'mobx-react-lite';
import { autorun } from 'mobx';
import '@gui/stores';
import { StoreProvider, useStore } from '@studio/stores';
import i18n from '@studio/utils/i18n';
import PageLoading from '@studio/components/PageLoading';
import { injectCssVariable } from './utils';
import routes from './routes';
import './tailwind.css';

const PageRoot = observer(() => {
  const rootStore = useStore();
  const { themeStore, routerStore } = rootStore;
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

const rootElement = document.getElementById('studioApp');
const root = import.meta.hot?.data?.root || createRoot(rootElement!);
import.meta.hot?.dispose(() => {
  import.meta.hot!.data.root = root;
});
root.render(<PageRoot />);
