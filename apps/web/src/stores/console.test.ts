import { describe, expect, it, vi } from 'vitest';

vi.mock('@studio/services', () => ({ execConsoleGql: vi.fn(), execGql: vi.fn() }));

describe('ConsoleStore result snapshot mapping', () => {
  it('keeps one snapshot reference per result and cleans it up on removal and clear', async () => {
    const { default: ConsoleStore } = await import('./console');
    const store = new ConsoleStore();

    store.setResultSnapshot('result-1', { snapshotId: 'snap-1', graph: 'graph_a' });
    store.setResultSnapshot('result-2', { snapshotId: 'snap-2', graph: 'graph_b' });
    expect(store.getResultSnapshot('result-1')).toEqual({ snapshotId: 'snap-1', graph: 'graph_a' });

    store.removeResult({ id: 'result-1' } as never);
    expect(store.getResultSnapshot('result-1')).toBeUndefined();
    expect(store.getResultSnapshot('result-2')).toEqual({ snapshotId: 'snap-2', graph: 'graph_b' });

    store.removeResultSnapshotsBySnapshotId('snap-2');
    expect(store.getResultSnapshot('result-2')).toBeUndefined();

    store.setResultSnapshot('result-3', { snapshotId: 'snap-3', graph: 'graph_c' });
    store.clearConsole();
    expect(store.getResultSnapshot('result-3')).toBeUndefined();
  });
});
