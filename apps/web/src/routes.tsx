import { Navigate, Route, RouteProps, createRoutesFromElements } from 'react-router-dom';
import { lazy } from 'react';

import Login from '@studio/pages/Login';
import PageLayout from '@studio/components/PageLayout';

const Console = lazy(() => import('@studio/pages/Console'));
const GraphTypeBuilder = lazy(() => import('@studio/pages/SchemaManager/GraphTypeBuilder'));
const GraphTypeList = lazy(() => import('@studio/pages/SchemaManager/GraphTypeList'));
const GraphList = lazy(() => import('@studio/pages/SchemaManager/GraphList'));
const SchemaManager = lazy(() => import('@studio/pages/SchemaManager'));
const SketchList = lazy(() => import('@studio/pages/SchemaManager/SketchList'));
const GraphInfo = lazy(() => import('@studio/pages/SchemaManager/GraphInfo'));
const SchemaList = lazy(() => import('@studio/pages/SchemaList'));
const Explorer = lazy(() => import('@studio/pages/Explorer'));
const ExplorerSnapshots = lazy(() => import('@studio/pages/Explorer/Snapshots'));
const ExplorerGraph = lazy(() => import('@studio/pages/Explorer/Graph'));

import { GraphTypeBuildMode } from './interfaces';

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
        subRoutes: [
          {
            key: 'graphtype',
            path: 'graphtype',
            subRoutes: [
              {
                key: 'graphTyleList',
                element: <GraphTypeList />,
                index: true,
              },
              {
                key: 'view/:graphTypeName',
                element: <GraphTypeBuilder mode={GraphTypeBuildMode.Readonly} />,
                path: 'view/:graphTypeName',
              },
              {
                key: 'edit/:graphTypeName',
                element: <GraphTypeBuilder mode={GraphTypeBuildMode.Edit} />,
                path: 'edit/:graphTypeName',
              },
              {
                key: 'create',
                element: <GraphTypeBuilder mode={GraphTypeBuildMode.Create} />,
                path: 'create',
              },
              {
                key: 'sketch',
                element: <SketchList />,
                path: 'sketch',
              },
              {
                key: 'sketch/:id',
                element: <GraphTypeBuilder mode={GraphTypeBuildMode.Sketch} />,
                path: 'sketch/:id',
              },
            ],
          },
          {
            key: 'graphs',
            path: 'graphs',
            subRoutes: [
              {
                key: 'graphList',
                element: <GraphList />,
                index: true,
              },
              {
                key: ':graphName',
                element: <GraphInfo />,
                path: ':graphName',
              },
            ],
          },
        ],
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
        element: <Explorer />,
        path: 'explorer/snapshots',
        subRoutes: [
          {
            key: 'explorer-snapshots',
            element: <ExplorerSnapshots />,
            index: true,
          },
          {
            key: 'explorer-snapshot',
            element: <ExplorerGraph />,
            path: ':snapshotId',
          },
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
