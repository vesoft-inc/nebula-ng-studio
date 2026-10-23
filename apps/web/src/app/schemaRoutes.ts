import { matchPath } from 'react-router-dom';
import type { SchemaView } from '@vesoft-inc/ui-components/schema';

export const schemaRoutePaths = {
  schemas: '/schema-list',
  'graph-types': '/schema-manager/graphtype',
  graphs: '/schema-manager/graphs',
  graph: '/schema-manager/graphs/:graphName',
  sketches: '/schema-manager/graphtype/sketch',
  sketch: '/schema-manager/graphtype/sketch/:sketchId',
  create: '/schema-manager/graphtype/create',
  edit: '/schema-manager/graphtype/edit/:graphTypeName',
  view: '/schema-manager/graphtype/view/:graphTypeName',
} as const;

export type SchemaRoute = keyof typeof schemaRoutePaths;

export function schemaRouteView(route: SchemaRoute, pathname: string): SchemaView | null {
  const match = matchPath(schemaRoutePaths[route], pathname);
  if (!match) return null;
  // Match the original URL and decode a parameter once. Decoding the whole pathname
  // would turn an encoded slash in a resource name into a route separator.
  try {
    const params = Object.fromEntries(
      Object.entries(match.params).map(([key, value]) => [key, decodeURIComponent(value ?? '')])
    );
    switch (route) {
      case 'graph':
        return params.graphName ? { type: 'graph', name: params.graphName } : null;
      case 'edit':
      case 'view':
        return params.graphTypeName
          ? { type: 'editor', mode: route === 'view' ? 'readonly' : 'edit', graphTypeName: params.graphTypeName }
          : null;
      case 'sketch': {
        const sketchId = Number(params.sketchId);
        return /^[1-9]\d*$/.test(params.sketchId) && Number.isSafeInteger(sketchId)
          ? { type: 'editor', mode: 'sketch', sketchId }
          : null;
      }
      case 'create':
        return { type: 'editor', mode: 'create' };
      default:
        return { type: route };
    }
  } catch {
    return null;
  }
}

export function schemaViewPath(view: SchemaView): string {
  switch (view.type) {
    case 'schemas':
    case 'graphs':
    case 'sketches':
    case 'graph-types':
      return schemaRoutePaths[view.type];
    case 'graph':
      return `/schema-manager/graphs/${encodeURIComponent(view.name)}`;
    case 'editor':
      return view.mode === 'create'
        ? schemaRoutePaths.create
        : view.mode === 'sketch'
          ? `/schema-manager/graphtype/sketch/${view.sketchId}`
          : `/schema-manager/graphtype/${view.mode === 'readonly' ? 'view' : 'edit'}/${encodeURIComponent(view.graphTypeName ?? '')}`;
  }
}
