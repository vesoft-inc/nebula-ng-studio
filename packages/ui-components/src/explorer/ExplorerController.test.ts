import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { SnapshotData } from '../graph/types/index';
import { RawEntityType } from '../graph/types/gql';
const deleteSnapshot = vi.fn();
const getSnapshotDetail = vi.fn();
const fetchSnapshots = vi.fn();
const services = {
  execute: vi.fn(),
  snapshots: {
    create: vi.fn(),
    delete: deleteSnapshot,
    list: fetchSnapshots,
    read: getSnapshotDetail,
    update: vi.fn(),
  },
};

it('keeps custom runtime settings when editing another field without persistence', async () => {
  const { ExplorerStore } = await import('./ExplorerController');
  const initialSettings = {
    queryTimeout: 45,
    maxRowsLimit: 500,
    maxNeighborsLimit: 800,
    displayPropertiesOnHover: false,
    highlightNeighborsOnHover: false,
  };
  const store = new ExplorerStore({ settings: initialSettings, schemaStore: {} as never, services });
  await store.loadSettings();
  store.setSettingsGroup('appConfigForm', { ...store.settingsGroups.appConfigForm, queryTimeout: 60 });
  expect(store.settings).toEqual({ ...initialSettings, queryTimeout: 60 });
  store.setSettingsGroup('personalConfigForm', {
    ...store.settingsGroups.personalConfigForm,
    displayPropertiesOnHover: true,
  });
  expect(store.settings).toEqual({ ...initialSettings, queryTimeout: 60, displayPropertiesOnHover: true });
  store.destroy();
});

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
    const { ExplorerStore } = await import('./ExplorerController');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      services,
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
      nowDataMap: new Map<string, NodeObject | LinkObject>([
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
    const { ExplorerStore } = await import('./ExplorerController');
    const removeResultSnapshotsBySnapshotId = vi.fn();
    const store = new ExplorerStore({
      settings: {},
      schemaStore: { currentSchema: { path: '/schema/demo' } } as never,
      services: { ...services, onSnapshotDeleted: removeResultSnapshotsBySnapshotId },
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
    const { ExplorerStore } = await import('./ExplorerController');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      services,
    });
    const workspace = { setRestoreState: vi.fn(), restoreSnapshot: vi.fn(), destroy: vi.fn() };
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
      data: { id: 'snap-1', schemaPath: '/schema/demo', data: JSON.stringify(emptySnapshotData) },
    } as never);

    await store.openSnapshot('snap-1', workspace as never);

    expect(workspace.setRestoreState.mock.calls.map(([state]) => state)).toEqual(['restoring', 'ready']);
    expect(workspace.restoreSnapshot).toHaveBeenCalledTimes(1);
    expect(store.loading).toBe(false);
  });

  it('releases the restoring gate when the snapshot detail is missing', async () => {
    const schemaStore = {
      currentSchema: { path: '/schema/demo' },
      updateSchemas: vi.fn(),
      updateCurrentSchame: vi.fn(),
      refreshCurrentSchema: vi.fn(),
    };
    const { ExplorerStore } = await import('./ExplorerController');
    const store = new ExplorerStore({
      settings: {},
      schemaStore: schemaStore as never,
      services,
    });
    const workspace = { setRestoreState: vi.fn(), restoreSnapshot: vi.fn(), destroy: vi.fn() };
    vi.mocked(getSnapshotDetail).mockResolvedValueOnce({ code: 1, data: undefined } as never);

    await store.openSnapshot('missing', workspace as never);

    expect(workspace.setRestoreState.mock.calls.map(([state]) => state)).toEqual(['restoring', 'ready']);
    expect(workspace.restoreSnapshot).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });
});

describe('snapshot request lifecycle', () => {
  it('keeps the newest filter result when older responses arrive later', async () => {
    const { ExplorerStore } = await import('./ExplorerController');
    let completeOld!: (value: unknown) => void;
    const list = vi
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          completeOld = resolve;
        })
      )
      .mockResolvedValueOnce({ code: 0, data: { items: [{ id: 'new' }], total: 1 } });
    const controller = new ExplorerStore({
      settings: {},
      services: { ...services, snapshots: { ...services.snapshots, list } },
      schemaStore: { currentSchema: { path: '/schema' } } as never,
    });
    const pending = controller.getSnapshots(1, { name: 'old' });
    await controller.getSnapshots(1, { name: 'new' });
    completeOld({ code: 0, data: { items: [{ id: 'old' }], total: 1 } });
    await pending;
    expect(controller.snapshots.map((item) => item.id)).toEqual(['new']);
    controller.destroy();
  });

  it('aborts requests and rejects late results after the workbench is destroyed', async () => {
    const { ExplorerStore } = await import('./ExplorerController');
    let complete!: (value: unknown) => void;
    const list = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      })
    );
    const controller = new ExplorerStore({
      settings: {},
      services: { ...services, snapshots: { ...services.snapshots, list } },
      schemaStore: { currentSchema: { path: '/schema' } } as never,
    });
    const pending = controller.getSnapshots(1);
    const signal = list.mock.calls[0][1].signal as AbortSignal;
    controller.destroy();
    complete({ code: 0, data: { items: [{ id: 'late' }], total: 1 } });
    await pending;
    expect(signal.aborted).toBe(true);
    expect(controller.snapshots).toHaveLength(0);
    expect(controller.loading).toBe(false);
  });
});
