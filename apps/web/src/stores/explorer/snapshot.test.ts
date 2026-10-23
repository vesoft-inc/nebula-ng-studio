import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { SnapshotData } from '@studio/interfaces/explorer';
import { RawEntityType } from '@studio/interfaces/explorer/gql';
import { deleteSnapshot, getSnapshotDetail } from '@studio/services/explorer';

vi.mock('@studio/services/explorer', () => ({
  addSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  fetchSnapshots: vi.fn(),
  getSnapshotDetail: vi.fn(),
  updateSnapShot: vi.fn(),
}));
vi.mock('@studio/services', () => ({ execGql: vi.fn() }));
vi.mock('@vesoft-inc/icons', () => ({}));

describe('Explorer snapshot serialization', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips graph identities, selections and image cache', async () => {
    class TestImage {
      src = '';
    }
    vi.stubGlobal('Image', TestImage);
    vi.stubGlobal('HTMLImageElement', TestImage);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    const schemaStore = {
      currentSchema: { path: '/schema/demo' },
      updateSchemas: vi.fn(),
      updateCurrentSchame: vi.fn(),
      refreshCurrentSchema: vi.fn(),
    };
    const { ExplorerStore } = await import('./snapshot');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      consoleStore: { removeResultSnapshotsBySnapshotId: vi.fn() } as never,
    });

    const source = {
      id: '1',
      data: {
        raw: '1',
        type: RawEntityType.NODE,
        value: { graph: 'demo', id: 1, labels: [], properties: {}, type: 'Person' },
      },
    } as NodeObject;
    const target = {
      id: '2',
      data: {
        raw: '2',
        type: RawEntityType.NODE,
        value: { graph: 'demo', id: 2, labels: [], properties: {}, type: 'Person' },
      },
    } as NodeObject;
    const link = {
      id: 'legacy-edge',
      source,
      target,
      data: {
        raw: 'legacy-edge',
        type: RawEntityType.EDGE,
        value: {
          srcId: 1,
          dstId: 2,
          graph: 'demo',
          labels: [],
          properties: {},
          rank: 0,
          type: 'Knows',
          isDirected: true,
        },
      },
    } as LinkObject;
    const data = {
      nodes: new Set([source, target]),
      links: new Set([link]),
      nodesSelected: new Set([source]),
      linksSelected: new Set([link]),
      nowDataMap: new Map([
        [source.id!, source],
        [target.id!, target],
        [link.id!, link],
      ]),
      imagesCache: new Map([['person', 'data:image/png;base64,dGVzdA==']]),
      displayedNodePropertyItems: [],
      displayedEdgePropertyItems: [],
      filterList: [],
    } as unknown as SnapshotData;

    const serialized = store.exportSnapshotTransfer(data);
    const restored = store.importSnapshotTransfer(JSON.stringify(serialized));

    expect((restored?.nodes as unknown as Set<NodeObject>).size).toBe(2);
    expect((restored?.links as unknown as Set<LinkObject>).size).toBe(1);
    expect(restored?.nodesSelected.size).toBe(1);
    expect(restored?.linksSelected.size).toBe(1);
    expect(restored?.nowDataMap.size).toBe(3);
    const restoredImages = restored?.imagesCache as unknown as [string, TestImage][];
    expect(restoredImages[0][0]).toBe('person');
    expect(restoredImages[0][1]).toBeInstanceOf(TestImage);
    const restoredLink = Array.from(restored?.links ?? [])[0];
    expect((restoredLink?.source as NodeObject).id).toBe('1');
    expect((restoredLink?.target as NodeObject).id).toBe('2');
  });

  it('purges the Console result mapping when a snapshot is deleted', async () => {
    const { ExplorerStore } = await import('./snapshot');
    const removeResultSnapshotsBySnapshotId = vi.fn();
    const store = new ExplorerStore({
      settings: {},
      schemaStore: { currentSchema: { path: '/schema/demo' } } as never,
      consoleStore: { removeResultSnapshotsBySnapshotId } as never,
    });

    vi.mocked(deleteSnapshot).mockResolvedValueOnce({ code: 0 } as never);
    await expect(store.deleteSnapshot('snap-1')).resolves.toBe(true);
    expect(removeResultSnapshotsBySnapshotId).toHaveBeenCalledWith('snap-1');

    vi.mocked(deleteSnapshot).mockResolvedValueOnce({ code: 1 } as never);
    await expect(store.deleteSnapshot('snap-2')).resolves.toBe(false);
    expect(removeResultSnapshotsBySnapshotId).toHaveBeenCalledTimes(1);
  });

  it('keeps the canvas restoring until the snapshot payload is applied', async () => {
    const schemaStore = {
      currentSchema: { path: '/schema/demo' },
      updateSchemas: vi.fn(),
      updateCurrentSchame: vi.fn(),
      refreshCurrentSchema: vi.fn(),
    };
    const { ExplorerStore } = await import('./snapshot');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      consoleStore: { removeResultSnapshotsBySnapshotId: vi.fn() } as never,
    });
    const workspace = { setRestoreState: vi.fn(), initSnapShot: vi.fn(), destroy: vi.fn() };
    const emptySnapshotData = {
      nodes: [],
      links: [],
      nodesSelected: [],
      linksSelected: [],
      displayedNodePropertyItems: [],
      displayedEdgePropertyItems: [],
      filterList: [],
      imagesCache: [],
      nowDataMap: {},
    };
    vi.mocked(getSnapshotDetail).mockResolvedValueOnce({
      code: 0,
      data: { id: 'snap-1', data: JSON.stringify(emptySnapshotData) },
    } as never);

    await store.openSnapshot('snap-1', workspace as never);

    expect(workspace.setRestoreState.mock.calls.map(([state]) => state)).toEqual(['restoring', 'ready']);
    expect(workspace.initSnapShot).toHaveBeenCalledTimes(1);
    expect(store.loading).toBe(false);
  });

  it('releases the restoring gate when the snapshot detail is missing', async () => {
    const schemaStore = {
      currentSchema: { path: '/schema/demo' },
      updateSchemas: vi.fn(),
      updateCurrentSchame: vi.fn(),
      refreshCurrentSchema: vi.fn(),
    };
    const { ExplorerStore } = await import('./snapshot');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      consoleStore: { removeResultSnapshotsBySnapshotId: vi.fn() } as never,
    });
    const workspace = { setRestoreState: vi.fn(), initSnapShot: vi.fn(), destroy: vi.fn() };
    vi.mocked(getSnapshotDetail).mockResolvedValueOnce({ code: 1, data: undefined } as never);

    await store.openSnapshot('missing', workspace as never);

    expect(workspace.setRestoreState.mock.calls.map(([state]) => state)).toEqual(['restoring', 'ready']);
    expect(workspace.initSnapShot).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });
});
