export enum RawEntityType {
  NODE = 'NODE',
  EDGE = 'EDGE',
  PATH = 'PATH',
}

export interface GraphElement {
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

export type VertexValue = { raw: string; type: RawEntityType.NODE; value: GraphNodeValue };

export type EdgeValue = { raw: string; type: RawEntityType.EDGE; value: GraphEdgeValue };

export type PathValue<T = (GraphNodeValue | GraphEdgeValue)[]> = { raw: string; type: RawEntityType.PATH; value: T };

export type GraphDataTableValueType = VertexValue | EdgeValue | PathValue | null;

export type GraphDataTable = Record<string, GraphDataTableValueType | GraphDataTableValueType[] | null>;
