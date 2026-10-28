// Keep the augmentation reachable in emitted declarations as well as source builds.
export type * from './force-graph';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

export * from '../../contracts/graph';

export type IDataMap = Map<string, NodeObject | LinkObject>;
