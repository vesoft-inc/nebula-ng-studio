import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { SnapshotData } from '@studio/interfaces/explorer';
import { RawEntityType } from '@studio/interfaces/explorer/gql';

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

    const { ExplorerStore } = await import('./snapshot');
    const store = new ExplorerStore({
      rootStore: { schemaStore: { currentSchema: { path: '/schema/demo' } } } as never,
      settings: {},
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
});
