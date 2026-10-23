import { Navigate, Route, RouteProps, createRoutesFromElements } from 'react-router-dom';
import { lazy } from 'react';

import Login from '@studio/pages/Login';
import PageLayout from '@studio/components/PageLayout';

const Console = lazy(() => import('@studio/pages/Console'));
const SchemaManager = lazy(() => import('@studio/pages/SchemaManager'));
const SchemaList = SchemaManager;
const Explorer = lazy(() => import('@studio/pages/Explorer'));

export type IRouteItem = RouteProps & {
  key: string;
  authrization?: boolean;
  subRoutes?: IRouteItem[];
};

export const routes: IRouteItem[] = [
  {
    key: 'login',
    path: '/login',
    element: <Login />,
    authrization: false,
  },
  {
    key: 'page-layout',
    element: <PageLayout />,
    path: '/*',
    subRoutes: [
      {
        key: 'schema-manager',
        element: <SchemaManager />,
        path: 'schema-manager/*',
      },
      {
        key: 'schemalist',
        path: 'schema-list',
        index: true,
        element: <SchemaList />,
      },
      {
        key: 'console',
        element: <Console />,
        index: true,
        path: 'console',
      },
      {
        key: 'explorer',
        path: 'explorer/snapshots',
        subRoutes: [
          { key: 'explorer-snapshots', index: true, element: <Explorer /> },
          { key: 'explorer-snapshot', path: ':snapshotId', element: <Explorer /> },
        ],
      },
      {
        key: 'default',
        element: <Navigate replace to="console" />,
        path: '*',
      },
    ],
  },
];

const renderRoutes = (routes: IRouteItem[]) => {
  return routes.map((route) => {
    if (route.subRoutes?.length) {
      return (
        <Route key={route.key} path={route.path} element={route.element}>
          {renderRoutes(route.subRoutes)}
        </Route>
      );
    }
    return <Route key={route.key} index={route.index} path={route.path} element={route.element} />;
  });
};

export default createRoutesFromElements(renderRoutes(routes));
