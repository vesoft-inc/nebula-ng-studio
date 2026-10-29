import type { DescEdgeTypeResult, DescGraphTypeResult, DescNodeTypeResult } from '@vesoft-inc/studio-core/contracts';

export enum OperatorType {
  Equal = '=',
  GreaterThan = '>',
  LessThan = '<',
  LessThanOrEqual = '<=',
  GreaterThanOrEqual = '>=',
  NotEqual = '!=',
  Contains = 'CONTAINS',
  StartsWith = 'STARTS WITH',
  EndsWith = 'ENDS WITH',
}

export enum VertexFilterDisplay {
  Hide = 'hide',
  Grayscale = 'grey',
}

/** Data only. Evaluation remains the responsibility of the runtime ConditionFilter. */
export interface FilterDefinition {
  property?: DescEdgeTypeResult | DescNodeTypeResult;
  property_name?: string;
  operator: OperatorType;
  entity?: DescGraphTypeResult;
  entity_name?: string;
  value: string;
  enable: boolean;
}
