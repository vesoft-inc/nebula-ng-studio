import { createBrowserRouter } from 'react-router-dom';
import routes from '@gui/routes';

/** Created once by the application bootstrap, outside React rendering. */
export function createGuiRouter() {
  const router = createBrowserRouter(routes, { basename: window.APP_CONFIG?.basePath });
  return { router, dispose: () => router.dispose() };
}
