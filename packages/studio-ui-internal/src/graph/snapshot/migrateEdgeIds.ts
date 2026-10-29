import { RawEntityType, type GraphEdgeValue } from '../../contracts/graph';
import { getGraphEdgeId } from '@vesoft-inc/studio-core/graph';

type SerializedGraphEdgeValue = Omit<GraphEdgeValue, 'isDirected'> & { isDirected?: boolean };

interface SnapshotIdentityEntry {
  id?: string | number;
  data?: { type?: RawEntityType; value?: unknown };
  isDirected?: boolean;
}

export interface SnapshotMigrationInput<T extends SnapshotIdentityEntry = SnapshotIdentityEntry> {
  nowDataMap: Record<string, T>;
  links?: (string | number)[];
  linksSelected?: (string | number)[];
}

/** Re-key persisted links after the edge identity format changes. */
export function migrateSnapshotEdgeIds<T extends SnapshotIdentityEntry>(data: SnapshotMigrationInput<T>): void {
  const edgeIdMap = new Map<string, string>();
  const migratedDataMap: Record<string, T> = {};

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

  const migrateIds = (ids?: (string | number)[]) => ids?.map((id) => edgeIdMap.get(String(id)) ?? id);

  data.links = migrateIds(data.links);
  data.linksSelected = migrateIds(data.linksSelected);
  data.nowDataMap = migratedDataMap;
}
