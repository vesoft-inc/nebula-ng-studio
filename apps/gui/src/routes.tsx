import { Navigate, Route, RouteProps, createRoutesFromElements } from 'react-router-dom';
import { lazy } from 'react';

import PageLayout from '@gui/components/PageLayout';

const Console = lazy(() => import('@studio/pages/Console'));

export type IRouteItem = RouteProps & {
  key: string;
  authrization?: boolean;
  subRoutes?: IRouteItem[];
};

export const routes: IRouteItem[] = [
  {
    key: 'page-layout',
    element: <PageLayout />,
    path: '/ui/*',
    subRoutes: [
      {
        key: 'console',
        element: <Console />,
        index: true,
        path: 'console',
      },
      {
        key: 'default',
        element: <Navigate replace to="console" />,
        path: '*',
      },
    ],
  },
  {
    key: 'default',
    element: <Navigate replace to="/ui/console" />,
    path: '*',
  },
];

export default createRoutesFromElements(
  routes.map((route) =>
    route.subRoutes ? (
      <Route key={route.key} path={route.path} element={route.element}>
        {route.subRoutes.map((subRoute) => (
          <Route key={subRoute.key} path={subRoute.path} element={subRoute.element} index={subRoute.index} />
        ))}
      </Route>
    ) : (
      <Route key={route.key} path={route.path} element={route.element} />
    )
  )
);
