import { createBrowserRouter } from 'react-router-dom';
import routes from './routes';
import { bindSessionLifecycle } from './session';

/** A router belongs to the mounted application, not to an individual React render. */
export function createStudioRouter() {
  const router = createBrowserRouter(routes, { basename: window.APP_CONFIG?.basePath });
  const unbindSession = bindSessionLifecycle((path) => {
    void router.navigate(path, { replace: true });
  });

  return {
    router,
    dispose: () => {
      unbindSession();
      router.dispose();
    },
  };
}
