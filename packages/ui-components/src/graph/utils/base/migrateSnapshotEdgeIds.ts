import { GraphEdgeValue, RawEntityType } from '../../types/gql';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { getGraphEdgeId } from '@vesoft-inc/utils';

type SerializedGraphEdgeValue = Omit<GraphEdgeValue, 'isDirected'> & { isDirected?: boolean };

export interface SerializedSnapshotGraphData {
  nowDataMap: Record<string, NodeObject | LinkObject>;
  links?: string[];
  linksSelected?: string[];
}

/** Re-key persisted links after the edge identity format changes. */
export function migrateSnapshotEdgeIds(data: SerializedSnapshotGraphData): void {
  const edgeIdMap = new Map<string, string>();
  const migratedDataMap: Record<string, NodeObject | LinkObject> = {};

  Object.entries(data.nowDataMap).forEach(([oldId, item]) => {
    if (item.data?.type !== RawEntityType.EDGE) {
      migratedDataMap[oldId] = item;
      return;
    }

    const value = item.data.value as SerializedGraphEdgeValue;
    // Snapshots created before undirected-edge support do not contain this field.
    // All edges from that format were directed, so preserve their original semantics.
    const isDirected = value.isDirected ?? true;
    value.isDirected = isDirected;
    item.isDirected = isDirected;

    const newId = getGraphEdgeId({ ...value, isDirected });
    item.id = newId;
    edgeIdMap.set(oldId, newId);
    migratedDataMap[newId] = item;
  });

  const migrateIds = (ids?: string[]) => ids?.map((id) => edgeIdMap.get(id) ?? id);

  data.links = migrateIds(data.links);
  data.linksSelected = migrateIds(data.linksSelected);
  data.nowDataMap = migratedDataMap;
}
