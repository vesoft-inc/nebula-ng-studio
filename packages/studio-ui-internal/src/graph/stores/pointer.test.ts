import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vesoft-inc/icons', () => ({}));
vi.mock('../utils/layouts', () => ({ default: {} }));

describe('GraphStore.setPointer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the same pointer when a closed menu is closed again, and replaces it when coordinates change', async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn(), addEventListener: vi.fn() });
    vi.stubGlobal('self', {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const { GraphWorkspaceStore } = await import('./workspace');
    const workspace = new GraphWorkspaceStore({
      explorerId: 'snapshot-1',
      execGql: vi.fn() as unknown as ConstructorParameters<typeof GraphWorkspaceStore>[0]['execGql'],
    });
    const pointer = workspace.graph.pointer;

    workspace.graph.setPointer({ showContextMenu: false });
    expect(workspace.graph.pointer).toBe(pointer);

    workspace.graph.setPointer({ top: 12, left: 34 });
    expect(workspace.graph.pointer).not.toBe(pointer);
    expect(workspace.graph.pointer).toMatchObject({ top: 12, left: 34, showContextMenu: false });

    workspace.destroy();
  });
});
