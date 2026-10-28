import type { EdgeValue, VertexValue, DisplayedPropertyItem } from './graph';
import type { FilterDefinition, VertexFilterDisplay } from './filter';

export interface SnapshotMetadata {
  id: string;
  name: string;
  graph: string;
  graph_type: string;
  thumbnail?: string;
  created_at: string;
  updated_at: string;
  schemaPath: string;
}

/** Raw API representation. Older servers omit schemaPath; data is serialized JSON. */
export interface SnapshotRecord extends Omit<SnapshotMetadata, 'schemaPath'> {
  schemaPath?: string;
  data?: string;
}

/** Rendering attributes are retained for compatibility, without referencing an engine type. */
export interface SerializedGraphEntity {
  id?: string | number;
  data: VertexValue | EdgeValue;
  source?: string | number;
  target?: string | number;
  [attribute: string]: unknown;
}

/** Existing wire format. Collections are IDs, image entries contain URLs, and filters have no methods. */
export interface SnapshotPayload {
  version?: string;
  nodes: (string | number)[];
  links: (string | number)[];
  nodesSelected: (string | number)[];
  linksSelected: (string | number)[];
  nowDataMap: Record<string, SerializedGraphEntity>;
  imagesCache?: [string, string][];
  displayedNodePropertyItems: DisplayedPropertyItem[];
  displayedEdgePropertyItems: DisplayedPropertyItem[];
  filterList: FilterDefinition[];
  filterType?: VertexFilterDisplay;
}
