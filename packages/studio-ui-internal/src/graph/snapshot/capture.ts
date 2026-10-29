import { RawEntityType } from '../../contracts/graph';
import type { SerializedGraphEntity, SnapshotPayload } from '../../contracts/snapshot';
import type { GraphRuntimeState } from './types';

/** Capture before any await: the live workspace may be changed or disposed while a request runs. */
export function captureSnapshotPayload(data: GraphRuntimeState, version = '1'): SnapshotPayload {
  const nowDataMap: SnapshotPayload['nowDataMap'] = {};
  for (const [key, value] of data.nowDataMap) {
    const entity = { ...value };
    if (value.data.type === RawEntityType.EDGE) {
      const { source, target } = value;
      entity.source = source && typeof source === 'object' ? (source as { id?: string | number }).id : source;
      entity.target = target && typeof target === 'object' ? (target as { id?: string | number }).id : target;
    }
    // Engine endpoints have been replaced by IDs. All other persisted rendering attributes stay intact.
    nowDataMap[key] = entity as SerializedGraphEntity;
  }
  const payload: SnapshotPayload = {
    version,
    filterType: data.filterType,
    nowDataMap,
    nodes: Array.from(data.nodes, (item) => item.id!),
    links: Array.from(data.links, (item) => item.id!),
    nodesSelected: Array.from(data.nodesSelected, (item) => item.id!),
    linksSelected: Array.from(data.linksSelected, (item) => item.id!),
    displayedNodePropertyItems: [...data.displayedNodePropertyItems],
    displayedEdgePropertyItems: [...data.displayedEdgePropertyItems],
    filterList: data.filterList.map(({ property, property_name, operator, entity, entity_name, value, enable }) => ({
      property,
      property_name,
      operator,
      entity,
      entity_name,
      value,
      enable,
    })),
  };
  if (data.imagesCache) {
    payload.imagesCache = Array.from(data.imagesCache, ([key, img]) => [key, typeof img === 'string' ? img : img.src]);
  }
  return payload;
}
