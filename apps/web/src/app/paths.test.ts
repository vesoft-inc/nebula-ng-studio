import { describe, expect, it } from 'vitest';
import { createMemoryRouter } from 'react-router-dom';
import { loginPath, loginReturnPath, toAppPath, toBrowserPath } from './paths';

describe('login return location', () => {
  it.each(['', '/', '/studio', '/studio/'])('round-trips query and hash under basename %j', async (basename) => {
    const prefix = basename.replace(/\/$/, '');
    const returnTo = `${prefix}/explorer/snapshots/example?mode=test#node-1`;
    const path = loginPath(toAppPath(returnTo, basename));
    const router = createMemoryRouter([{ path: '*' }], {
      basename: basename || '/',
      initialEntries: [toBrowserPath(path, basename)],
    });
    try {
      await router.navigate(loginReturnPath(router.state.location.search, basename), { replace: true });
      const { pathname, search, hash } = router.state.location;
      expect(`${pathname}${search}${hash}`).toBe(returnTo);
    } finally {
      router.dispose();
    }
  });

  it('accepts old redirects that include the deployment prefix without duplicating it', () => {
    expect(loginReturnPath('?redirect=%2Fstudio%2Fconsole', '/studio')).toBe('/console');
    expect(toAppPath('/studio-other/console', '/studio')).toBe('/studio-other/console');
  });

  it.each(['https://other.example/path', '//other.example/path', '/\\other.example/path', '/login?redirect=/'])(
    'falls back to Console for a non-application or login target %j',
    (path) => expect(loginReturnPath(`?redirect=${encodeURIComponent(path)}`, '/studio')).toBe('/console')
  );

  it('does not wrap a login page in another login redirect', () => {
    expect(loginPath('/login?redirect=%2Fconsole')).toBe('/login');
    expect(loginPath('/LOGIN/')).toBe('/login');
  });
});
