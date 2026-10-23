import { RouterProvider, type RouterProviderProps } from 'react-router-dom';
import { GlobalModal } from '@vesoft-inc/ui-components/modal';
import { AppProviders } from './AppProviders';
import { modalStore } from './session';

export function App({ router }: Pick<RouterProviderProps, 'router'>) {
  return (
    <AppProviders>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <GlobalModal store={modalStore} />
    </AppProviders>
  );
}
