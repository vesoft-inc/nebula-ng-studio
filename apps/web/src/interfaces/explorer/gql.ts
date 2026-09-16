import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

export interface GraphElement {
  /** usignd int64 */
  id: string;
  type: string;
  labels: string[];
  graph: string;
  properties: Record<string, unknown>;
}

export interface IGraph {
  graph_type: string;
  name: string;
  schema: string;
  owner: string;
}

export enum RawEntityType {
  NODE = 'NODE',
  EDGE = 'EDGE',
  PATH = 'PATH',
}

export type GraphNodeValue = {
  graph: string;
  id: number;
  labels: string[];
  properties: Record<string, unknown>;
  type: string;
};

export type GraphEdgeValue = {
  dstId: number;
  graph: string;
  labels: string[];
  properties: Record<string, unknown>;
  rank: number;
  srcId: number;
  type: string;
  isDirected: boolean;
};

export type VertexValue = {
  raw: string;
  type: RawEntityType.NODE;
  value: GraphNodeValue;
};

export type EdgeValue = {
  raw: string;
  type: RawEntityType.EDGE;
  value: GraphEdgeValue;
};

export type PathValue<T = (GraphNodeValue | GraphEdgeValue)[]> = {
  raw: string;
  type: RawEntityType.PATH;
  value: T;
};

export type GraphDataTableValueType = VertexValue | EdgeValue | PathValue | null;

export type GraphDataTable = {
  [colName: string]: GraphDataTableValueType | GraphDataTableValueType[] | null;
};

export type IDataMap = Map<string, NodeObject | LinkObject>;

// export interface Pointer {
//   top: number;
//   left: number;
//   event?: unknown;
//   node?: NodeObject;
//   showContextMenu?: boolean;
//   hideContextMenu?: boolean;
// }
