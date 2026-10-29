import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { QueryExecutor } from '../shared/query';
import type { ISketchItem, SketchListItem, NodeLayoutMap } from '../schema/types';

/** The host binds storage to its account/schema; the editor only knows graph type names. */
export interface SchemaLayoutServices {
  read: (graphTypeName: string) => Promise<NodeLayoutMap | null>;
  write: (graphTypeName: string, layout: NodeLayoutMap) => Promise<boolean>;
  migrate?: (from: string, to: string, layout: NodeLayoutMap) => Promise<void>;
}

export interface SketchServices {
  list: (options: { keyword?: string; page?: number; pageSize?: number }) => Promise<ServerResponse<SketchListItem>>;
  read: (id: number) => Promise<ServerResponse<{ item: ISketchItem }>>;
  create: (item: ISketchItem) => Promise<ServerResponse<{ id: number }>>;
  delete: (id: number) => Promise<ServerResponse<number>>;
}

export interface SchemaEditorServices {
  execute: QueryExecutor;
  layouts?: SchemaLayoutServices;
  sketches?: SketchServices;
}
