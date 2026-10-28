import type { GraphRuntimeState } from '../graph/snapshot/types';
import { captureSnapshotPayload } from '../graph/snapshot/capture';

export const SNAPSHOT_SET_FIELDS = ['nodes', 'links', 'nodesSelected', 'linksSelected'] as const;
export const SNAPSHOT_ARRAY_FIELDS = [
  'displayedNodePropertyItems',
  'displayedEdgePropertyItems',
  'filterList',
] as const;

/** Compatibility entry: capture runtime state without a controller or browser globals. */
export function exportSnapshotTransfer(data: GraphRuntimeState, version = '1') {
  return captureSnapshotPayload(data, version);
}
