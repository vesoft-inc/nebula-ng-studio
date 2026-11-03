export const routePaths = {
  login: '/login',
  console: '/console',
  schema: {
    schemas: '/schema-list',
    graphTypes: '/schema-manager/graphtype',
    graphs: '/schema-manager/graphs',
    sketches: '/schema-manager/graphtype/sketch',
    createGraphType: '/schema-manager/graphtype/create',
  },
  explorer: { snapshots: '/explorer/snapshots' },
} as const;

export const schemaGraphPath = (name: string): string => `${routePaths.schema.graphs}/${encodeURIComponent(name)}`;
export const schemaSketchPath = (sketchId: number): string => `${routePaths.schema.sketches}/${sketchId}`;
export const schemaGraphTypePath = (mode: 'edit' | 'readonly', name: string): string =>
  `${routePaths.schema.graphTypes}/${mode === 'readonly' ? 'view' : 'edit'}/${encodeURIComponent(name)}`;
export const explorerSnapshotPath = (snapshotId: string): string =>
  `${routePaths.explorer.snapshots}/${encodeURIComponent(snapshotId)}`;

const basePrefix = (basename = '') => basename.replace(/\/+$/, '');

/** Convert a browser URL into the path consumed by the application router. */
export function toAppPath(path: string, basename?: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) return routePaths.console;
  const prefix = basePrefix(basename);
  const pathnameEnd = path.search(/[?#]/);
  const pathname = pathnameEnd < 0 ? path : path.slice(0, pathnameEnd);
  const suffix = pathnameEnd < 0 ? '' : path.slice(pathnameEnd);
  if (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return `${pathname.slice(prefix.length) || '/'}${suffix}`;
  }
  return path;
}

export function loginPath(returnTo?: string): string {
  if (!returnTo || /^\/login\/?(?:[?#]|$)/i.test(returnTo)) return routePaths.login;
  return `${routePaths.login}?redirect=${encodeURIComponent(returnTo)}`;
}

export function loginReturnPath(search: string, basename?: string): string {
  const path = toAppPath(new URLSearchParams(search).get('redirect') || routePaths.console, basename);
  return /^\/login\/?(?:[?#]|$)/i.test(path) ? routePaths.console : path;
}

export function toBrowserPath(path: string, basename?: string): string {
  return `${basePrefix(basename)}${path}`;
}
