import { describe, expect, it, vi } from 'vitest';
import { RawEntityType, OperatorType, type SnapshotPayload } from '../../entries/contracts';
import { decodeSnapshotPayload, encodeSnapshotPayload } from './codec';
import { captureSnapshotPayload } from './capture';
import type { NodeObject, LinkObject } from '@vesoft-inc/force-graph';

// These pure paths must also work in a process that cannot load UI or reactive runtimes.
vi.mock('mobx', () => {
  throw new Error('Pure snapshot codecs must not load MobX');
});
vi.mock('@vesoft-inc/force-graph', () => {
  throw new Error('Pure snapshot codecs must not load a canvas');
});

function saved(): SnapshotPayload {
  return {
    nodes: ['1', '2'],
    links: ['old-edge'],
    nodesSelected: ['1'],
    linksSelected: ['old-edge'],
    nowDataMap: {
      '1': {
        id: '1',
        x: 10,
        data: {
          type: RawEntityType.NODE,
          raw: '',
          value: {
            id: 1,
            graph: 'people',
            type: 'Person',
            labels: [],
            properties: { external: '9223372036854775807' },
          },
        },
      },
      '2': {
        id: '2',
        data: {
          type: RawEntityType.NODE,
          raw: '',
          value: { id: 2, graph: 'people', type: 'Person', labels: [], properties: {} },
        },
      },
      'old-edge': {
        id: 'old-edge',
        source: '1',
        target: '2',
        data: {
          type: RawEntityType.EDGE,
          raw: '',
          value: {
            srcId: 1,
            dstId: 2,
            graph: 'people',
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
    displayedNodePropertyItems: [{ type_name: 'Person', properties: ['external'] }],
    displayedEdgePropertyItems: [],
    filterList: [{ operator: OperatorType.Equal, value: 'Alice', enable: true }],
  };
}

describe('snapshot codec without a DOM or MobX', () => {
  it('keeps the wire format, values and selections through migration and encoding', () => {
    const decoded = decodeSnapshotPayload(encodeSnapshotPayload(saved()))!;
    expect(decoded.nodes).toEqual(['1', '2']);
    expect(decoded.linksSelected).toEqual(decoded.links);
    expect(decoded.nowDataMap[decoded.links[0]].source).toBe('1');
    expect(decoded.nowDataMap['1'].data.value.properties.external).toBe('9223372036854775807');
    expect(decoded.imagesCache).toEqual(saved().imagesCache);
    expect(decodeSnapshotPayload(encodeSnapshotPayload(decoded))).toEqual(decoded);
  });

  it('retains the behavior for new explorations and unreadable JSON', () => {
    expect(decodeSnapshotPayload()).toBeUndefined();
    expect(decodeSnapshotPayload('')).toBeUndefined();
    expect(decodeSnapshotPayload('{')).toBeUndefined();
  });

  it('defaults omitted optional collections without inventing an entity index', () => {
    expect(decodeSnapshotPayload('{"nowDataMap":{}}')).toMatchObject({ nodes: [], links: [], filterList: [] });
    expect(() => decodeSnapshotPayload('{}')).toThrow('Invalid snapshot entity index');
  });

  it('captures engine endpoints as IDs and filter data without runtime methods', () => {
    const payload = saved();
    const source = payload.nowDataMap['1'] as NodeObject;
    const target = payload.nowDataMap['2'] as NodeObject;
    const link = { ...payload.nowDataMap['old-edge'], source, target } as LinkObject;
    const filter = { ...payload.filterList[0], isMeetCondition: () => true };
    const captured = captureSnapshotPayload({
      nodes: [source, target],
      links: [link],
      nodesSelected: [source],
      linksSelected: [link],
      nowDataMap: new Map<string, NodeObject | LinkObject>([
        ['1', source],
        ['2', target],
        ['old-edge', link],
      ]),
      displayedNodePropertyItems: [],
      displayedEdgePropertyItems: [],
      filterList: [filter],
      imagesCache: new Map([['person', 'data:image/png;base64,dGVzdA==']]),
    });
    expect(captured.nowDataMap['old-edge']).toMatchObject({ source: '1', target: '2' });
    expect('isMeetCondition' in captured.filterList[0]).toBe(false);
    expect(captured.imagesCache).toEqual(payload.imagesCache);
  });
});
