import { lazy, Suspense } from 'react';
import { Navigate, Outlet, type RouteObject } from 'react-router-dom';
import Login from '@studio/pages/Login';
import PageLayout from '@studio/components/PageLayout';
import PageLoading from '@studio/components/PageLoading';
import { SessionGate } from './SessionGate';
import { PageError } from './PageError';
import { schemaRoutePaths, type SchemaRoute } from './schemaRoutes';

const Console = lazy(() => import('@studio/pages/Console'));
const SchemaManager = lazy(() => import('@studio/pages/SchemaManager'));
const Explorer = lazy(() => import('@studio/pages/Explorer'));

export const routes: RouteObject[] = [
  { id: 'login', path: '/login', element: <Login />, errorElement: <PageError /> },
  {
    id: 'page-layout',
    path: '/',
    element: (
      <SessionGate>
        <PageLayout />
      </SessionGate>
    ),
    errorElement: <PageError />,
    children: [
      {
        id: 'pages',
        element: (
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        ),
        errorElement: <PageError />,
        children: [
          { index: true, element: <Navigate replace to="/console" /> },
          { id: 'console', path: 'console', element: <Console /> },
          ...(Object.keys(schemaRoutePaths) as SchemaRoute[]).map((route) => ({
            id: `schema-${route}`,
            path: schemaRoutePaths[route],
            element: <SchemaManager route={route} />,
          })),
          { path: 'schema-manager/*', element: <Navigate replace to={schemaRoutePaths['graph-types']} /> },
          {
            id: 'explorer',
            path: 'explorer/snapshots',
            children: [
              { id: 'explorer-snapshots', index: true, element: <Explorer /> },
              { id: 'explorer-snapshot', path: ':snapshotId', element: <Explorer /> },
            ],
          },
          { path: '*', element: <Navigate replace to="/console" /> },
        ],
      },
    ],
  },
];

export default routes;
