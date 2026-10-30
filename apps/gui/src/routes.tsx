import { Navigate, type RouteObject } from 'react-router-dom';
import { lazy } from 'react';

import PageLayout from '@gui/components/PageLayout';

const Console = lazy(() => import('@gui/pages/Console'));

export const routes: RouteObject[] = [
  {
    element: <PageLayout />,
    path: '/ui',
    children: [
      {
        index: true,
        element: <Navigate replace to="console" />,
      },
      {
        element: <Console />,
        path: 'console',
      },
      {
        element: <Navigate replace to="/ui/console" />,
        path: '*',
      },
    ],
  },
  {
    element: <Navigate replace to="/ui/console" />,
    path: '*',
  },
];

export default routes;
