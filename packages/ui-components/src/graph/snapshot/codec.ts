import type { SnapshotPayload } from '../../contracts/snapshot';
import { migrateSnapshotEdgeIds } from './migrateEdgeIds';

const COLLECTIONS = [
  'nodes',
  'links',
  'nodesSelected',
  'linksSelected',
  'displayedNodePropertyItems',
  'displayedEdgePropertyItems',
  'filterList',
] as const;

/** Parse the existing wire format without constructing stores, images or graph instances. */
export function decodeSnapshotPayload(serialized?: string): SnapshotPayload | undefined {
  if (!serialized) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized.replace('\t', ' '));
  } catch {
    // Preserve the existing behavior for empty/new snapshots and unreadable JSON.
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid snapshot payload');
  }
  const value = parsed as Record<string, unknown>;
  if (!value.nowDataMap || typeof value.nowDataMap !== 'object' || Array.isArray(value.nowDataMap)) {
    throw new Error('Invalid snapshot entity index');
  }
  for (const key of COLLECTIONS) {
    if (value[key] == null) value[key] = [];
    if (!Array.isArray(value[key])) throw new Error(`Invalid snapshot collection: ${key}`);
  }
  if (value.imagesCache != null && !Array.isArray(value.imagesCache)) {
    throw new Error('Invalid snapshot image cache');
  }
  // JSON has been parsed and its collection boundaries checked. Entity attributes retain their
  // existing encoding; in particular, this codec does not coerce property values or numeric IDs.
  const payload = value as unknown as SnapshotPayload;
  migrateSnapshotEdgeIds(payload);
  return payload;
}

export function encodeSnapshotPayload(payload: SnapshotPayload): string {
  return JSON.stringify(payload);
}
