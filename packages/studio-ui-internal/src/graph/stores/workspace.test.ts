import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { RawEntityType } from '../../contracts/graph';
import type { Snapshot } from '../types/explorer';
import { captureSnapshotPayload } from '../snapshot/capture';
import { decodeSnapshotPayload, encodeSnapshotPayload } from '../snapshot/codec';
import { materializeSnapshot } from '../snapshot/runtime';

vi.mock('@vesoft-inc/icons', () => ({}));
vi.mock('../utils/layouts', () => ({ default: {} }));

function restoredSnapshot(id: string, name = 'Same name'): Snapshot {
  const node = {
    id,
    data: {
      raw: '',
      type: RawEntityType.NODE,
      value: { id: Number(id), graph: 'g', type: 'Person', properties: {}, labels: [] },
    },
  } as NodeObject;
  return {
    id,
    name,
    graph: 'g',
    graph_type: 'people',
    schemaPath: '/demo',
    created_at: '',
    updated_at: '',
    data: {
      nodes: [node],
      links: [],
      nodesSelected: [node],
      linksSelected: [],
      nowDataMap: new Map([[id, node]]),
      displayedNodePropertyItems: [],
      displayedEdgePropertyItems: [],
      filterList: [],
      imagesCache: new Map(),
    },
  };
}

async function restoreWorkspace() {
  vi.stubGlobal('window', { removeEventListener: vi.fn() });
  vi.stubGlobal('self', {});
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() });
  const { GraphWorkspaceStore } = await import('./workspace');
  const query = vi.fn();
  const workspace = new GraphWorkspaceStore({ execGql: query });
  return { workspace, query };
}

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

  it('restores data explicitly even for equal names, while metadata changes leave data and history alone', async () => {
    const { workspace, query } = await restoreWorkspace();
    try {
      workspace.restoreSnapshot(restoredSnapshot('1'));
      const history = workspace.graph.historyLength;
      workspace.restoreSnapshot(restoredSnapshot('2'));
      expect(workspace.graph.selectedNodeIds).toEqual(['2']);
      expect(workspace.graph.nowDataMap.has('1')).toBe(false);
      expect(workspace.graph.historyLength).toBe(history + 1);

      workspace.updateSnapshotMetadata({ ...workspace.currentSnapshot!, name: 'Renamed' });
      expect(workspace.currentSnapshot?.name).toBe('Renamed');
      expect(workspace.graph.selectedNodeIds).toEqual(['2']);
      expect(workspace.graph.historyLength).toBe(history + 1);
      expect(query).not.toHaveBeenCalled();
    } finally {
      workspace.destroy();
    }
  });

  it('keeps the compatibility restore method and explicitly starts its metadata load once', async () => {
    const { workspace } = await restoreWorkspace();
    const load = vi.spyOn(workspace, 'getGraphTypeDetail').mockResolvedValue([]);
    try {
      workspace.initSnapShot(restoredSnapshot('1'));
      await vi.waitFor(() => expect(workspace.graphTypeDetails).toEqual([]));
      expect(load).toHaveBeenCalledOnce();
      expect(load).toHaveBeenCalledWith('people');
      expect(workspace.graph.selectedNodeIds).toEqual(['1']);
      workspace.updateCurrentSnapshot({ ...workspace.currentSnapshot!, name: 'Renamed' });
      expect(load).toHaveBeenCalledOnce();
    } finally {
      workspace.destroy();
    }
  });

  it.each([0, 1])('restores numeric node ID %s for selection and style commands', async (nodeId) => {
    const { workspace } = await restoreWorkspace();
    const id = String(nodeId);
    const opened = restoredSnapshot(id);
    const payload = captureSnapshotPayload(opened.data!);
    payload.nowDataMap[id].id = nodeId;
    payload.nowDataMap[id].color = '#ff5500';
    payload.nodes = [nodeId];
    payload.nodesSelected = [nodeId];
    const state = materializeSnapshot(decodeSnapshotPayload(encodeSnapshotPayload(payload))!);
    try {
      workspace.restoreSnapshot({ ...opened, data: state });
      workspace.graph.changeNodesSelectedColor({ color: '#00ff00' });
      expect(workspace.graph.nowDataMap.get(id)?.color).toBe('#00ff00');
      workspace.graph.clearNodesSelected();
      workspace.graph.setSelectedNodeIds([id]);
      expect(workspace.graph.selectedNodeIds).toEqual([id]);
      expect([...workspace.graph.nodesSelected][0]).toBe(workspace.graph.nowDataMap.get(id));
      expect([...workspace.graph.nodes][0].data.value.id).toBe(nodeId);
      expect(payload.nowDataMap[id].id).toBe(nodeId);
    } finally {
      workspace.destroy();
    }
  });

  it.each(['map values', 'generator'])('restores colors from %s for subsequent graph results', async (input) => {
    const { workspace } = await restoreWorkspace();
    const snapshot = restoredSnapshot('1');
    const data = snapshot.data!;
    const node = data.nowDataMap.get('1')! as NodeObject;
    node.color = '#ff5500';
    const link: LinkObject = {
      id: 'edge',
      source: node,
      target: node,
      color: '#22cc88',
      data: {
        raw: '',
        type: RawEntityType.EDGE,
        value: { srcId: 1, dstId: 1, rank: 0, graph: 'g', type: 'Knows', labels: [], properties: {}, isDirected: true },
      },
    };
    const once = <T>(items: T[]): Iterable<T> =>
      input === 'map values'
        ? new Map(items.map((item, index) => [index, item])).values()
        : (function* () {
            yield* items;
          })();
    data.nodes = once([node]);
    data.links = once([link]);
    data.nowDataMap.set('edge', link);
    try {
      workspace.restoreSnapshot(snapshot);
      expect([...workspace.graph.nodes]).toEqual([node]);
      expect([...workspace.graph.links]).toEqual([link]);
      const next = workspace.graph.parseSubGraph([
        {
          existingNode: node.data,
          node: { ...node.data, value: { ...node.data.value, id: 2 } },
          link: { ...link.data, value: { ...link.data.value, dstId: 2 } },
        },
      ]);
      expect(next.vertexes.map((item) => item.color)).toEqual([node.color, node.color]);
      expect(next.edges[0].color).toBe(link.color);
    } finally {
      workspace.destroy();
    }
  });

  it('ignores metadata from a previous restore on the same workspace', async () => {
    const { workspace } = await restoreWorkspace();
    let finish!: (details: []) => void;
    vi.spyOn(workspace, 'getGraphTypeDetail').mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    workspace.restoreSnapshot(restoredSnapshot('1'));
    const pending = workspace.loadGraphTypeDetails('old');
    workspace.restoreSnapshot(restoredSnapshot('2'));
    finish([]);
    await pending;
    expect(workspace.graphTypeDetails).toBeUndefined();
    expect(workspace.graph.selectedNodeIds).toEqual(['2']);
    workspace.destroy();
  });
});
