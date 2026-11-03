import { createRouter, type RouterHistory } from '@tanstack/react-router';
import { PageLoading } from '@vesoft-inc/studio-ui-internal';
import { routeTree } from '../routeTree.gen';
import { PageError } from './PageError';
import { bindSessionLifecycle } from './session';
import { routePaths, toBrowserPath } from './paths';

export function createStudioRouter(options: { history?: RouterHistory; basepath?: string } = {}) {
  const router = createRouter({
    routeTree,
    basepath: options.basepath ?? window.APP_CONFIG?.basePath,
    history: options.history,
    rewrite: {
      input: ({ url }) => {
        // Validate before the router decodes dynamic parameters; preserve valid encoded names.
        try {
          decodeURIComponent(url.pathname);
        } catch {
          url.pathname = url.pathname.startsWith('/schema-manager/')
            ? routePaths.schema.graphTypes
            : routePaths.console;
        }
        return url;
      },
    },
    defaultPendingComponent: PageLoading,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultErrorComponent: PageError,
  });
  const unbindSession = bindSessionLifecycle((path) => {
    void router.navigate({ href: toBrowserPath(path, router.options.basepath), replace: true, ignoreBlocker: true });
  });
  // RouterProvider owns its subscription; bootstrap owns the browser history listeners.
  return {
    router,
    dispose: () => {
      unbindSession();
      if (!options.history) router.history.destroy();
    },
  };
}
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createStudioRouter>['router'];
  }
}
