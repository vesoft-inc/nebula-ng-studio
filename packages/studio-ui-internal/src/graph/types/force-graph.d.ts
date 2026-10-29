import type { EdgeValue, VertexValue } from './gql';

declare module '@vesoft-inc/force-graph' {
  export interface LinkObject {
    data: EdgeValue;
  }

  export interface NodeObject {
    data: VertexValue;
  }
}
