import dayjs from 'dayjs';

import { OperatorType } from '../contracts/filter';
export { OperatorType } from '../contracts/filter';
export { IconGroupType } from '../contracts/icons';

export const ConditionFactories: {
  operator: OperatorType;
  invoke: (args: {
    fieldValue: string | number | boolean | dayjs.Dayjs;
    value: string | number | boolean | dayjs.Dayjs;
  }) => boolean;
}[] = [
  {
    operator: OperatorType.Equal,
    invoke: ({ fieldValue, value }) => value.toString() === fieldValue.toString(),
  },
  {
    operator: OperatorType.GreaterThan,
    invoke: ({ fieldValue, value }) => fieldValue > value,
  },
  {
    operator: OperatorType.LessThan,
    invoke: ({ fieldValue, value }) => fieldValue < value,
  },
  {
    operator: OperatorType.LessThanOrEqual,
    invoke: ({ fieldValue, value }) => fieldValue <= value,
  },
  {
    operator: OperatorType.GreaterThanOrEqual,
    invoke: ({ fieldValue, value }) => fieldValue >= value,
  },
  {
    operator: OperatorType.NotEqual,
    invoke: ({ fieldValue, value }) => fieldValue.toString() !== value.toString(),
  },
  {
    operator: OperatorType.Contains,
    invoke: ({ fieldValue, value }) => typeof fieldValue === 'string' && fieldValue.includes(value as string),
  },
  {
    operator: OperatorType.StartsWith,
    invoke: ({ fieldValue, value }) => typeof fieldValue === 'string' && fieldValue.startsWith(value as string),
  },
  {
    operator: OperatorType.EndsWith,
    invoke: ({ fieldValue, value }) => typeof fieldValue === 'string' && fieldValue.endsWith(value as string),
  },
];

export enum PathType {
  All = 'All',
  AnyOne = 'AnyOne',
  AllShortest = 'AllShortest',
  OneShortest = 'OneShortest',
}

export enum PathFilterType {
  WALK = 'WALK',
  TRAIL = 'TRAIL',
  ACYCLIC = 'ACYCLIC',
  SIMPLE = 'SIMPLE',
}

export enum GraphLayoutType {
  Force = 'force',
  Dagre = 'dagre',
  DagreLR = 'dagreLR',
  Circular = 'circular',
  Radial = 'radial',
  Neural = 'neural',
  Concentric = 'concentric',
  Grid = 'grid',
}

export const DEFAULT_LINK_COLOR = 'default_link_color';

export const ALL_EDGE_TYPE_KEY = 'all_edge_type_key_$$';
