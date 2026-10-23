const basePrefix = (basename = '') => basename.replace(/\/+$/, '');

/** Convert a browser URL into the path consumed by React Router's navigate(). */
export function toAppPath(path: string, basename?: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) return '/console';
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
  if (!returnTo || /^\/login\/?(?:[?#]|$)/i.test(returnTo)) return '/login';
  return `/login?redirect=${encodeURIComponent(returnTo)}`;
}

export function loginReturnPath(search: string, basename?: string): string {
  const path = toAppPath(new URLSearchParams(search).get('redirect') || '/console', basename);
  return /^\/login\/?(?:[?#]|$)/i.test(path) ? '/console' : path;
}

export function toBrowserPath(path: string, basename?: string): string {
  return `${basePrefix(basename)}${path}`;
}
