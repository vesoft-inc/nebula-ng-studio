import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { SnapshotData } from '../graph/types/explorer';
import { RawEntityType } from '../graph/types/gql';

export const SNAPSHOT_SET_FIELDS = ['nodes', 'links', 'nodesSelected', 'linksSelected'] as const;
export const SNAPSHOT_ARRAY_FIELDS = [
  'displayedNodePropertyItems',
  'displayedEdgePropertyItems',
  'filterList',
] as const;

/** Serialize snapshot data without a controller or browser globals. */
export function exportSnapshotTransfer(data: SnapshotData, version = '1') {
  const ret: Record<string, unknown> = {
    version,
    filterType: data.filterType,
  };

  const { nowDataMap } = data;
  ret.nowDataMap = Array.from(nowDataMap.entries()).reduce(
    (dataMap: Record<string, NodeObject | LinkObject>, [key, value]) => {
      dataMap[key] = { ...value };
      if (value.data.type === RawEntityType.EDGE) {
        dataMap[key].target = (value.target as NodeObject).id;
        dataMap[key].source = (value.source as NodeObject).id;
      }
      return dataMap;
    },
    {} as Record<string, NodeObject | LinkObject>
  );

  if (data.imagesCache) {
    ret.imagesCache = Array.from(data.imagesCache).map(([key, img]) => [key, typeof img === 'string' ? img : img.src]);
  }

  SNAPSHOT_SET_FIELDS.forEach((key) => {
    ret[key] = [...data[key]].map((item) => item.id);
  });
  SNAPSHOT_ARRAY_FIELDS.forEach((key) => {
    ret[key] = [...data[key]];
  });

  return ret;
}
