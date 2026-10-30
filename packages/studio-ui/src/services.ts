import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { IconGroupRecord, IconGroupType, IconItemRecord, SnapshotRecord } from './contracts';

/**
 * Host request controls. Adapters forward them to their existing transport.
 * Workbenches provide some local error feedback, but no uniform error presenter or toast deduplication.
 */
export interface QueryOptions {
  /** Forward to the transport; aborting a request does not undo server-side operations. */
  signal?: AbortSignal;
  /** Request timeout in milliseconds, enforced by the host transport. Editor settings use seconds. */
  queryTimeout?: number;
}

/**
 * Preserve nonzero codes and messages for business failures instead of requiring them to throw.
 * Transport failures may reject; existing adapters that return normalized error responses remain supported.
 * A rejection does not guarantee user-visible feedback from every workbench.
 */
export type QueryExecutor = <T extends object>(gql: string, options?: QueryOptions) => Promise<ServerResponse<T>>;

export interface ConsoleServices {
  execute: QueryExecutor;
  query: QueryExecutor;
  /** Optional server-side query cancellation, distinct from aborting the client request. */
  cancelQuery?: (sessionId: string, options?: QueryOptions) => Promise<void>;
  getSessionId?: (options?: QueryOptions) => Promise<string | undefined>;
}

export interface SchemaServices {
  execute: QueryExecutor;
  /** Switch the remote session before reporting success; the host then reflects the selected schemaPath. */
  switchSchema?: (path: string, options?: QueryOptions) => Promise<ServerResponse<object>>;
  importDataset?: (dataset: string, options?: QueryOptions) => Promise<ServerResponse<object>>;
  sweepLayouts?: (schemaPath: string, graphTypeNames: string[], options?: QueryOptions) => Promise<void>;
}

export interface NodePosition {
  x: number;
  y: number;
}
export type NodeLayoutMap = Record<string, NodePosition>;
export interface SketchRecord {
  id?: number;
  name: string;
  ifNotExists?: boolean;
  schema: string;
  snapshot: string;
  createTime?: string;
  updateTime?: string;
}
export interface SketchPage {
  items: SketchRecord[];
  total: number;
  page: number;
  pageSize: number;
}
export interface SchemaLayoutServices {
  read: (graphTypeName: string, options?: QueryOptions) => Promise<NodeLayoutMap | null>;
  write: (graphTypeName: string, layout: NodeLayoutMap, options?: QueryOptions) => Promise<boolean>;
  migrate?: (from: string, to: string, layout: NodeLayoutMap, options?: QueryOptions) => Promise<void>;
}
export interface SketchServices {
  list: (
    filter: { keyword?: string; page?: number; pageSize?: number },
    options?: QueryOptions
  ) => Promise<ServerResponse<SketchPage>>;
  read: (id: number, options?: QueryOptions) => Promise<ServerResponse<{ item: SketchRecord }>>;
  create: (item: SketchRecord, options?: QueryOptions) => Promise<ServerResponse<{ id: number }>>;
  delete: (id: number, options?: QueryOptions) => Promise<ServerResponse<number>>;
}
export interface SchemaEditorServices {
  execute: QueryExecutor;
  layouts?: SchemaLayoutServices;
  sketches?: SketchServices;
}

export interface ConsoleSettings {
  /** Editor setting in seconds; converted to milliseconds for query requests. */
  queryTimeout?: number;
  maxNodesLimit4Graph: number;
  [key: string]: unknown;
}
export interface ExplorerSettings {
  appConfigForm: {
    /** Editor setting in seconds; converted to milliseconds for query requests. */
    queryTimeout: number;
    maxRowsLimit: number;
    maxNeighborsLimit: number;
    [key: string]: unknown;
  };
  personalConfigForm: {
    displayPropertiesOnHover: boolean;
    highlightNeighborsOnHover: boolean;
    [key: string]: unknown;
  };
}
export type ExplorerInitialSettings = Partial<
  ExplorerSettings['appConfigForm'] & ExplorerSettings['personalConfigForm']
>;
export interface SnapshotCreateInput {
  name: string;
  graph: string;
  graph_type: string;
  /** Creation uses snake_case; read and list records use schemaPath. */
  schema_path: string;
  data?: string;
  thumbnail?: string;
}
export interface SnapshotPage {
  total: number;
  page: number;
  pageSize: number;
  items: SnapshotRecord[];
}
export interface SnapshotServices {
  /** Honor JSON filter fields, including id and schema_path together for legacy ownership verification. */
  list: (
    filter: { page: number; pageSize: number; filter?: string },
    options?: QueryOptions
  ) => Promise<ServerResponse<SnapshotPage>>;
  create: (data: SnapshotCreateInput, options?: QueryOptions) => Promise<ServerResponse<{ id: string }>>;
  /**
   * Return the actual owning schemaPath whenever possible so direct links work without list context.
   * Its optional DTO field preserves legacy compatibility; see the README for the limited fallback.
   */
  read: (id: string, options?: QueryOptions) => Promise<ServerResponse<SnapshotRecord>>;
  update: (snapshot: SnapshotRecord, options?: QueryOptions) => Promise<ServerResponse<object>>;
  delete: (id: string, options?: QueryOptions) => Promise<ServerResponse<object>>;
}
export interface ExplorerServices {
  execute: QueryExecutor;
  snapshots: SnapshotServices;
  settings?: {
    load: (options?: QueryOptions) => Promise<Partial<ExplorerSettings>>;
    save: (settings: ExplorerSettings, options?: QueryOptions) => Promise<void>;
  };
  snapshotVersion?: string;
}
export interface IconServices {
  getIconGroupList: (
    type: IconGroupType,
    options?: QueryOptions
  ) => Promise<ServerResponse<{ items: IconGroupRecord[] }>>;
  getIconGroupItemList: (
    groupId: string,
    options?: QueryOptions
  ) => Promise<ServerResponse<{ items: IconItemRecord[] }>>;
  addIconGroup: (
    values: { name: string; type: IconGroupType },
    options?: QueryOptions
  ) => Promise<ServerResponse<{ id: string }>>;
  updateIconGroup: (
    values: { id: string; name: string },
    options?: QueryOptions
  ) => Promise<ServerResponse<{ id: string }>>;
  deleteIconGroup: (id: string, options?: QueryOptions) => Promise<ServerResponse<{ id: string }>>;
  addIconGroupItem: (
    values: { groupId: string; name: string; icon: string },
    options?: QueryOptions
  ) => Promise<ServerResponse<{ id: string }>>;
  deleteIconGroupItem: (
    values: { groupId: string; iconId: string },
    options?: QueryOptions
  ) => Promise<ServerResponse<{ id: string }>>;
}

/**
 * Identity-bound adapters. Keep each domain object stable until its service is intentionally replaced.
 * Replacing a domain rebuilds state that depends on it; recreating only this outer container does not.
 * Omit domains the host does not offer. Authentication and persistence scope belong to the host.
 */
export interface StudioServices {
  console?: ConsoleServices;
  schema?: SchemaServices;
  schemaEditor?: SchemaEditorServices;
  explorer?: ExplorerServices;
  icons?: IconServices;
}
