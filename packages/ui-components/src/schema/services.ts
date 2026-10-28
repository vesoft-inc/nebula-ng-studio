import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { QueryExecutor } from '../shared/query';

export interface SchemaServices {
  execute: QueryExecutor;
  /** Use when changing schema also updates a server session. Defaults to GQL. */
  switchSchema?: (path: string) => Promise<ServerResponse<object>>;
  importDataset?: (dataset: string) => Promise<ServerResponse<object>>;
  sweepLayouts?: (schemaPath: string, graphTypeNames: string[]) => Promise<void>;
}
