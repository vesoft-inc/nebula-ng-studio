import { afterEach, describe, expect, it, vi } from 'vitest';
import { matchRoutes } from 'react-router-dom';

vi.mock('@studio/pages/Login', () => ({ default: () => null }));
vi.mock('@studio/components/PageLayout', () => ({ default: () => null }));
vi.mock('@vesoft-inc/ui-components', () => ({ PageLoading: () => null }));
vi.mock('@studio/app/SessionGate', () => ({ SessionGate: () => null }));
vi.mock('@studio/app/PageError', () => ({ PageError: () => null }));
vi.mock('@vesoft-inc/icons', () => ({}));

describe('Explorer browser route contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers only the canonical snapshot list and detail routes', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const { routes } = await import('./routes');
    const pageLayout = routes.find((route) => route.id === 'page-layout');
    const pages = pageLayout?.children?.find((route) => route.id === 'pages');
    const explorer = pages?.children?.find((route) => route.id === 'explorer');

    expect(explorer?.path).toBe('explorer/snapshots');
    expect(explorer?.children?.map((route) => route.path ?? '[index]')).toEqual(['[index]', ':snapshotId']);

    const registeredPaths = pages?.children?.flatMap((route) => [
      route.path,
      ...(route.children ?? []).map((child) => child.path),
    ]);
    expect(registeredPaths).not.toContain('explorer');
    expect(registeredPaths).not.toContain('explorer/:snapshotId');
    expect(matchRoutes(routes, '/explorer/snapshots')?.at(-1)?.route.id).toBe('explorer-snapshots');
    expect(matchRoutes(routes, '/explorer/snapshots/example')?.at(-1)?.route.id).toBe('explorer-snapshot');
  });

  it('only accepts the explicit Schema routes and gives unknown sections a fallback', async () => {
    const { routes } = await import('./routes');
    expect(matchRoutes(routes, '/schema-manager/graphtype/edit/books')?.at(-1)?.route.id).toBe('schema-edit');
    expect(matchRoutes(routes, '/schema-list')?.at(-1)?.route.id).toBe('schema-schemas');
    expect(matchRoutes(routes, '/schema-manager/unknown/edit/books')?.at(-1)?.route.path).toBe('schema-manager/*');
    expect(matchRoutes(routes, '/schema-manager/graphtype/create/extra')?.at(-1)?.route.path).toBe('schema-manager/*');
  });
});
