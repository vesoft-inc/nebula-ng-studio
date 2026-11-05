import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { PageLoading } from '@vesoft-inc/studio-ui-internal';
import { routeTree } from '../routeTree.gen';

/** Created once by the application bootstrap, outside React rendering. */
export function createGuiRouter(options: { history?: RouterHistory; basepath?: string } = {}) {
  const router = createRouter({
    routeTree,
    history: options.history,
    basepath: options.basepath ?? window.APP_CONFIG?.basePath,
    defaultPendingComponent: PageLoading,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  let disposed = false;
  return {
    router,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (!options.history) router.history.destroy();
    },
  };
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createGuiRouter>['router'];
  }
}
