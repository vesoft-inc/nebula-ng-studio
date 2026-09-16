import { EdgeDirectionType, GraphEntityType, PropertyDataType } from './constant';

export interface DescGraphTypeResult {
  entity_type: GraphEntityType;
  type_name: string;
  labels: string[];
  'primary_key/multiedge_key': 'Unique' | string[] | 'Auto';
  properties: string[];
  propertyInfos: DescNodeTypeResult[] | DescEdgeTypeResult[];

  type_pattern?: string;
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

export interface HttpResponse<T> {
  code: number;
  message: string;
  details?: string;
  data: T;
}

export interface IDirectionInfo {
  direction?: EdgeDirectionType;
  srcNode?: DirectionalGraphTypeResult;
  dstNode?: DirectionalGraphTypeResult;
}

export interface DescGraphTypeWithDirectionResult extends DescGraphTypeResult {
  directionInfo?: IDirectionInfo;
  curFileName?: string;
}

export interface DirectionalGraphTypeResult extends DescGraphTypeResult {
  column_value?: number | undefined;
  curFileName?: string;
  propertyInfos: DescNodeTypeResult[];
}
