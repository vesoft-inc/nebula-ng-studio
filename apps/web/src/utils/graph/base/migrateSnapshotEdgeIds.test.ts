import { describe, expect, it } from 'vitest';

import { EdgeValue, GraphEdgeValue, RawEntityType } from '@studio/interfaces/explorer/gql';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

import { migrateSnapshotEdgeIds, SerializedSnapshotGraphData } from './migrateSnapshotEdgeIds';

const createLink = (id: string, overrides: Partial<GraphEdgeValue> = {}): LinkObject => {
  const data: EdgeValue = {
    raw: id,
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
  };

  return {
    id,
    source: String(data.value.srcId),
    target: String(data.value.dstId),
    data,
  } as LinkObject;
};

const removeDirectionMetadata = (link: LinkObject): LinkObject => {
  delete (link.data.value as Partial<GraphEdgeValue>).isDirected;
  delete link.isDirected;
  return link;
};

describe('migrateSnapshotEdgeIds', () => {
  it('re-keys saved links and collapses only duplicate representations of one undirected edge', () => {
    const first = createLink('legacy-forward');
    const reversed = createLink('legacy-reversed', { srcId: 2, dstId: 1 });
    const differentType = createLink('legacy-couple', { type: 'Couple' });
    const node = { id: '1', data: { type: RawEntityType.NODE } } as NodeObject;
    const data: SerializedSnapshotGraphData = {
      nowDataMap: {
        '1': node,
        'legacy-forward': first,
        'legacy-reversed': reversed,
        'legacy-couple': differentType,
      },
      links: ['legacy-forward', 'legacy-reversed', 'legacy-couple'],
      linksSelected: ['legacy-reversed'],
    };

    migrateSnapshotEdgeIds(data);

    const migratedLinkIds = data.links!;
    expect(migratedLinkIds[0]).toBe(migratedLinkIds[1]);
    expect(migratedLinkIds[2]).not.toBe(migratedLinkIds[0]);
    expect(data.linksSelected).toEqual([migratedLinkIds[0]]);
    expect(Object.keys(data.nowDataMap)).toHaveLength(3);
    expect(data.nowDataMap['1']).toBe(node);
    expect(data.nowDataMap[migratedLinkIds[0]].id).toBe(migratedLinkIds[0]);
    expect(data.nowDataMap[migratedLinkIds[2]].id).toBe(migratedLinkIds[2]);
  });

  it('preserves reciprocal directed edges from snapshots created before direction metadata existed', () => {
    const forward = removeDirectionMetadata(createLink('legacy-forward'));
    const backward = removeDirectionMetadata(createLink('legacy-backward', { srcId: 2, dstId: 1 }));
    const data: SerializedSnapshotGraphData = {
      nowDataMap: {
        'legacy-forward': forward,
        'legacy-backward': backward,
      },
      links: ['legacy-forward', 'legacy-backward'],
      linksSelected: ['legacy-forward', 'legacy-backward'],
    };

    migrateSnapshotEdgeIds(data);

    const [forwardId, backwardId] = data.links!;
    expect(forwardId).not.toBe(backwardId);
    expect(Object.keys(data.nowDataMap)).toHaveLength(2);
    expect(data.linksSelected).toEqual([forwardId, backwardId]);
    expect((data.nowDataMap[forwardId].data as EdgeValue).value.isDirected).toBe(true);
    expect((data.nowDataMap[backwardId].data as EdgeValue).value.isDirected).toBe(true);
  });
});
