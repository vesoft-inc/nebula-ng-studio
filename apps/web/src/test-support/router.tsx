import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type StaticDataRouteOption,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
export function createTestRouter(
  pages: { path: string; element: ReactNode; staticData?: StaticDataRouteOption }[],
  options: { initialEntries?: string[]; basepath?: string; layout?: () => ReactNode } = {}
) {
  const root = createRootRoute({ component: options.layout ?? Outlet });
  const routes = pages.map(({ path, element, staticData }) =>
    createRoute({ getParentRoute: () => root, path, staticData, component: () => element })
  );
  return createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: options.initialEntries ?? ['/'] }),
    basepath: options.basepath,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
}
