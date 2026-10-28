import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

export * from '../../contracts/graph';

export interface IDataMap {
  [key: string]: NodeObject | LinkObject;
}

export interface Pointer {
  top: number;
  left: number;
  event?: unknown;
  node?: NodeObject;
  showContextMenu?: boolean;
  hideContextMenu?: boolean;
}
