import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vesoft-inc/icons', () => ({}));
vi.mock('@studio/utils/graph/layouts', () => ({ default: {} }));

describe('GraphWorkspaceStore lifecycle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('destroys graph resources once and ignores later requests', async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
    vi.stubGlobal('self', {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const { GraphWorkspaceStore } = await import('./workspace');
    const execGql = vi.fn(async () => ({ code: 0, message: '', data: { tables: [] } }));
    const workspace = new GraphWorkspaceStore({
      explorerId: 'snapshot-1',
      execGql: execGql as unknown as ConstructorParameters<typeof GraphWorkspaceStore>[0]['execGql'],
    });
    expect(() => {
      workspace.destroy();
      workspace.destroy();
    }).not.toThrow();
    expect(await workspace.execGqlBySerial('RETURN 1')).toBeUndefined();
    expect(execGql).not.toHaveBeenCalled();
  });

  it('tracks the snapshot restore state and resets it on destroy', async () => {
    vi.stubGlobal('window', { removeEventListener: vi.fn() });
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

    expect(workspace.restoreState).toBe('idle');
    workspace.setRestoreState('restoring');
    expect(workspace.restoreState).toBe('restoring');
    workspace.setRestoreState('ready');
    expect(workspace.restoreState).toBe('ready');

    workspace.destroy();
    expect(workspace.restoreState).toBe('idle');
  });
});
