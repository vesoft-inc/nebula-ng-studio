import type { ServerResponse } from '@vesoft-inc/studio-core/contracts';
import type { QueryExecutor, QueryOptions } from '../shared/query';
import type { SnapshotRecord } from '../contracts/snapshot';
import type { ExplorerSettings } from '../shared/Settings/constants';

export interface SnapshotServices {
  list: (
    options: { page: number; pageSize: number; filter?: string },
    request?: QueryOptions
  ) => Promise<ServerResponse<{ total: number; page: number; pageSize: number; items: SnapshotRecord[] }>>;
  create: (data: {
    name: string;
    graph: string;
    graph_type: string;
    schema_path: string;
    data?: string;
    thumbnail?: string;
  }) => Promise<ServerResponse<{ id: string }>>;
  read: (id: string, request?: QueryOptions) => Promise<ServerResponse<SnapshotRecord>>;
  update: (snapshot: SnapshotRecord) => Promise<ServerResponse<object>>;
  delete: (id: string) => Promise<ServerResponse<object>>;
}
export interface ExplorerServices {
  execute: QueryExecutor;
  snapshots: SnapshotServices;
  settings?: {
    load: () => Promise<Partial<ExplorerSettings>>;
    save: (settings: ExplorerSettings) => Promise<void>;
  };
  snapshotVersion?: string;
  onSnapshotDeleted?: (id: string) => void;
  onSchemaChanged?: (path: string) => void;
}

/** Routers may pass their blocked transition; standalone workbenches also use this contract. */
export interface ExplorerNavigationBlocker {
  state: string;
  proceed?: () => void;
  reset?: () => void;
}
