import { RouterProvider, type AnyRouter } from '@tanstack/react-router';
import { GlobalModal } from '@vesoft-inc/studio-ui-internal/modal';
import { AppProviders } from './AppProviders';
import { modalStore } from './session';

export function App({ router }: { router: AnyRouter }) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <GlobalModal store={modalStore} />
    </AppProviders>
  );
}
