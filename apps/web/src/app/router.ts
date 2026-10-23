import { createBrowserRouter } from 'react-router-dom';
import { routerStore } from '@vesoft-inc/utils';
import routes from './routes';
import { bindSessionLifecycle } from './session';

/** A router belongs to the mounted application, not to an individual React render. */
export function createStudioRouter() {
  const router = createBrowserRouter(routes, { basename: window.APP_CONFIG?.basePath });
  routerStore.updateRouter(router);
  routerStore.updateState(router.state);
  const unsubscribe = router.subscribe(routerStore.updateState);
  const unbindSession = bindSessionLifecycle();

  return {
    router,
    dispose: () => {
      unbindSession();
      unsubscribe();
      router.dispose();
      if (routerStore.router === router) {
        routerStore.updateRouter(undefined);
        routerStore.updateState(undefined);
      }
    },
  };
}
