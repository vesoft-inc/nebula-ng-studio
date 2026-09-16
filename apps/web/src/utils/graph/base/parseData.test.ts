import { describe, expect, it } from 'vitest';

import { EdgeValue, GraphEdgeValue, RawEntityType } from '@studio/interfaces/explorer/gql';

import { parseEdgeValueToLinkObject } from './parseData';

const createEdge = (overrides: Partial<GraphEdgeValue> = {}): EdgeValue => ({
  raw: 'raw edge value',
  type: RawEntityType.EDGE,
  value: {
    srcId: 1,
    dstId: 2,
    graph: 'social',
    labels: [],
    properties: {},
    rank: 0,
    type: 'Friend',
    isDirected: false,
    ...overrides,
  },
});

const getEdgeId = (overrides: Partial<GraphEdgeValue> = {}) =>
  parseEdgeValueToLinkObject(createEdge(overrides), '#000').id;

describe('parseEdgeValueToLinkObject', () => {
  it('de-duplicates opposite representations of the same undirected edge', () => {
    expect(getEdgeId({ srcId: 1, dstId: 2 })).toBe(getEdgeId({ srcId: 2, dstId: 1 }));
  });

  it('preserves different undirected edge types between the same nodes', () => {
    const ids = ['Neighbour', 'Couple', 'Friend'].map((type) => getEdgeId({ type }));

    expect(new Set(ids).size).toBe(3);
  });

  it('preserves direction, rank and graph as parts of the edge identity', () => {
    const baseId = getEdgeId({ isDirected: true });

    expect(getEdgeId({ srcId: 2, dstId: 1, isDirected: true })).not.toBe(baseId);
    expect(getEdgeId({ rank: 1, isDirected: true })).not.toBe(baseId);
    expect(getEdgeId({ graph: 'another-graph', isDirected: true })).not.toBe(baseId);
  });

  it('does not sort rank together with undirected endpoints', () => {
    expect(getEdgeId({ srcId: 1, dstId: 2, rank: 3 })).not.toBe(getEdgeId({ srcId: 1, dstId: 3, rank: 2 }));
  });

  it('preserves uint64 endpoint precision', () => {
    const srcId = { toString: () => '288242354815500289' } as unknown as number;
    const dstId = { toString: () => '288472638077009921' } as unknown as number;
    const id = getEdgeId({ srcId, dstId });

    expect(id).toContain('288242354815500289');
    expect(id).toContain('288472638077009921');
  });
});
