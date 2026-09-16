import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@studio/pages/Login', () => ({ default: () => null }));
vi.mock('@studio/components/PageLayout', () => ({ default: () => null }));
vi.mock('@vesoft-inc/icons', () => ({}));
vi.mock('./interfaces', () => ({
  GraphTypeBuildMode: { Readonly: 'Readonly', Edit: 'Edit', Create: 'Create', Sketch: 'Sketch' },
}));

describe('Explorer browser route contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers only the canonical snapshot list and detail routes', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const { routes } = await import('./routes');
    const pageLayout = routes.find((route) => route.key === 'page-layout');
    const explorer = pageLayout?.subRoutes?.find((route) => route.key === 'explorer');

    expect(explorer?.path).toBe('explorer/snapshots');
    expect(explorer?.subRoutes?.map((route) => route.path ?? '[index]')).toEqual(['[index]', ':snapshotId']);

    const registeredPaths = pageLayout?.subRoutes?.flatMap((route) => [
      route.path,
      ...(route.subRoutes ?? []).map((child) => child.path),
    ]);
    expect(registeredPaths).not.toContain('explorer');
    expect(registeredPaths).not.toContain('explorer/:snapshotId');
  });
});
