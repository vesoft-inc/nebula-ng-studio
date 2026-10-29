import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

export { migrateSnapshotEdgeIds } from '../../snapshot/migrateEdgeIds';

/** Compatibility shape for existing graph utility consumers. */
export interface SerializedSnapshotGraphData {
  nowDataMap: Record<string, NodeObject | LinkObject>;
  links?: string[];
  linksSelected?: string[];
}
