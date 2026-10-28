// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { isObservableArray, isObservableSet } from 'mobx';
import {
  RawEntityType,
  decodeSnapshotPayload,
  encodeSnapshotPayload,
  type SnapshotPayload,
} from '../../entries/contracts';
import { materializeSnapshot } from './runtime';
import { captureSnapshotPayload } from './capture';

function snapshot(edgeId: string | number = 'edge'): SnapshotPayload {
  return {
    nodes: ['1', '2'],
    links: [edgeId],
    nodesSelected: ['1'],
    linksSelected: [edgeId],
    nowDataMap: {
      '1': {
        id: '1',
        data: {
          type: RawEntityType.NODE,
          raw: '',
          value: { id: 1, graph: 'g', type: 'Person', labels: [], properties: { name: 'Alice' } },
        },
      },
      '2': {
        id: '2',
        data: {
          type: RawEntityType.NODE,
          raw: '',
          value: { id: 2, graph: 'g', type: 'Person', labels: [], properties: {} },
        },
      },
      [edgeId]: {
        id: edgeId,
        source: '1',
        target: '2',
        data: {
          type: RawEntityType.EDGE as const,
          raw: '',
          value: {
            srcId: 1,
            dstId: 2,
            graph: 'g',
            type: 'Knows',
            rank: 0,
            isDirected: true,
            labels: [],
            properties: {},
          },
        },
      },
    },
    imagesCache: [['person', 'data:image/png;base64,dGVzdA==']],
    displayedNodePropertyItems: [],
    displayedEdgePropertyItems: [],
    filterList: [],
  };
}

it('materializes one shared entity graph without changing the transport payload', () => {
  const payload = snapshot();
  const state = materializeSnapshot(payload);
  const link = [...state.links][0];
  const source = [...state.nodes][0];
  expect(link.source).toBe(source);
  expect([...state.nodesSelected][0]).toBe(source);
  expect([...state.linksSelected][0]).toBe(link);
  expect(state.nowDataMap.get('1')).toBe(source);
  expect(isObservableSet(state.nodes)).toBe(true);
  expect(isObservableArray(state.filterList)).toBe(true);
  expect(state.imagesCache[0][1]).toBeInstanceOf(HTMLImageElement);
  expect(captureSnapshotPayload(state)).toMatchObject(payload);

  source.data.value.properties.name = 'Changed';
  expect(payload.nowDataMap['1'].data.value.properties.name).toBe('Alice');
  expect(payload.nowDataMap.edge.source).toBe('1');
});

it.each([0, 42])('restores numeric edge ID %s and its selection after migration', (edgeId) => {
  const payload = snapshot(edgeId);
  payload.linksSelected = [edgeId, String(edgeId)];
  const decoded = decodeSnapshotPayload(encodeSnapshotPayload(payload))!;
  const state = materializeSnapshot(decoded);
  const links = [...state.links];
  expect(links).toHaveLength(1);
  expect([...state.linksSelected]).toEqual(links);
  expect(links[0].source).toBe(state.nowDataMap.get('1'));
  expect(links[0].target).toBe(state.nowDataMap.get('2'));
  expect(decoded.nowDataMap[decoded.links[0]]).toMatchObject({
    id: decoded.links[0],
    data: { value: { type: 'Knows', isDirected: true } },
  });
});

it('binds endpoints once when legacy undirected edge IDs converge', () => {
  const payload = snapshot();
  const forward = payload.nowDataMap.edge;
  if (forward.data.type !== RawEntityType.EDGE) throw new Error('Expected an edge fixture');
  forward.data = { ...forward.data, type: RawEntityType.EDGE, value: { ...forward.data.value, isDirected: false } };
  payload.nowDataMap.reversed = {
    ...forward,
    id: 'reversed',
    source: '2',
    target: '1',
    data: {
      ...forward.data,
      type: RawEntityType.EDGE,
      value: { ...forward.data.value, srcId: 2, dstId: 1 },
    },
  };
  payload.links = ['edge', 'reversed'];
  payload.linksSelected = ['edge', 'reversed'];
  const decoded = decodeSnapshotPayload(encodeSnapshotPayload(payload))!;
  expect(decoded.links[0]).toBe(decoded.links[1]);
  const state = materializeSnapshot(decoded);
  const links = [...state.links];
  expect(links).toHaveLength(1);
  expect([...state.linksSelected]).toEqual(links);
  expect(links[0].source).toBe(state.nowDataMap.get('2'));
  expect(links[0].target).toBe(state.nowDataMap.get('1'));
  const saved = decodeSnapshotPayload(encodeSnapshotPayload(captureSnapshotPayload(state)))!;
  expect(saved.links).toHaveLength(1);
  expect(saved.nowDataMap[saved.links[0]]).toMatchObject({ source: '2', target: '1' });
});
