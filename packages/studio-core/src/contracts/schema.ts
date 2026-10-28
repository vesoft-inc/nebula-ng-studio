import type { GraphEntityType, PropertyDataType } from './constants.js';

export interface RawGraphTypeDescription {
  labels: string[];
  properties: string[];
  entity_type: GraphEntityType;
  type_name: string;
  type_pattern?: string;
  'primary_key/multiedge_key'?: 'Unique' | string[] | 'Auto';
}

export interface DescTypeItemResult {
  type_name: string;
  type: GraphEntityType;
}

export interface DescNodeTypeResult extends DescTypeItemResult {
  property_name: string;
  data_type: PropertyDataType;
  primary_key: 'Y' | '';
  nullable: boolean;
  default: string;
  column_value?: number | undefined;
  type_role?: string;
}

export interface DescEdgeTypeResult extends DescTypeItemResult {
  property_name: string;
  data_type: PropertyDataType;
  multi_edge_key: 'Y' | '';
  nullable: boolean;
  default: string;
  column_value?: number | undefined;
  type_role?: string;
}

export interface DescGraphTypeResult extends RawGraphTypeDescription {
  'primary_key/multiedge_key': 'Unique' | string[] | 'Auto';
  propertyInfos: DescNodeTypeResult[] | DescEdgeTypeResult[];
}

export interface ISchemaItem {
  name: string;
  path: string;
  owner: string;
}

export interface NebulaSchema extends ISchemaItem {
  graphTypes: GraphType[];
  graphs: GraphItem[];
}

export interface GraphType {
  schema: string;
  graph_type: string;
  owner: string;
  entities: GraphTypeElement[];
}

export interface GraphItem {
  graph: string;
  graph_type: string;
  owner: string;
  schema: string;
  index_cnt: number;
}

export interface GraphTypeElement {
  entity_type: GraphEntityType;
  type_name: string;
  graph_type_name: string;
  labels: string[];
  type_pattern?: string;
  'primary_key/multiedge_key': 'Unique' | string[] | 'Auto';
  /** currently `string[]` is used for `properties` field, but it should be `Property[]` */
  properties: string[];
  propertyInfos?: DescNodeTypeResult[] | DescEdgeTypeResult[];
}

export interface ILabelItem {
  name: string;
  entity_type: GraphEntityType;
}

export interface IGraphIndex {
  name: string;
  state: 'Valid' | 'Building';
  index_type: string;
  schema: string;
  graph_name: string;
  entity_type: GraphEntityType;
  element_type: string;
  properties: string[];
}

export interface IGraphStats {
  entry_name: string;
  element_type: string;
  total_num: number;
}

export const EdgeStatsEntryName = 'Edge Total';

export const NodeStatsEntryName = 'Node Total';
