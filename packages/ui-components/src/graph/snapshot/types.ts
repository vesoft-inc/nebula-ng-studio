import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { DisplayedPropertyItem } from '../../contracts/graph';
import type { FilterDefinition, VertexFilterDisplay } from '../../contracts/filter';
import type { SnapshotMetadata } from '../../contracts/snapshot';

/** Internal state accepted by the graph store. Both plain and observable collections are supported. */
export interface GraphRuntimeState {
  nodes: Iterable<NodeObject>;
  links: Iterable<LinkObject>;
  nodesSelected: Iterable<NodeObject>;
  linksSelected: Iterable<LinkObject>;
  displayedNodePropertyItems: readonly DisplayedPropertyItem[];
  displayedEdgePropertyItems: readonly DisplayedPropertyItem[];
  filterList: readonly FilterDefinition[];
  filterType?: VertexFilterDisplay;
  nowDataMap: Map<string, NodeObject | LinkObject>;
  version?: string;
  imagesCache?: Iterable<readonly [string, string | HTMLImageElement]>;
}

export interface OpenedSnapshot extends SnapshotMetadata {
  data?: GraphRuntimeState;
}

/** History intentionally retains the existing shallow entity references and copied index. */
export interface GraphHistoryFrame {
  nodes: Iterable<NodeObject>;
  links: Iterable<LinkObject>;
  nodesSelected: Iterable<NodeObject>;
  linksSelected: Iterable<LinkObject>;
  nowDataMap: Map<string, NodeObject | LinkObject>;
}
