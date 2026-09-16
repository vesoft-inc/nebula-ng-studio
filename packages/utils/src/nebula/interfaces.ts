export interface IGraph {
  graph_type: string;
  name: string;
  schema: string;
  owner: string;
}

export interface GQLResult<T extends object = Record<string, unknown>> {
  headers: string[];
  latency: number;
  tables: T[];
  duration: number;
  summary: GQLResultSummary;
}

export interface GQLResultSummary {
  buildTimeUs: number;
  optimizeTimeUs: number;
  totalServerTimeUs: number;
  serializeTimeUs: number;
  explainType: '' | 'profile' | 'explain' | 'profile_verbose' | 'explain_verbose';
  queryStats?: GQLResultQueryStats;
  planInfo?: GQLResultPlanInfo;
  rowsCount: number;
}

export interface GQLResultQueryStats {
  numAffectedNodes: number;
  numAffectedEdges: number;
  exportedRowSize?: number;
  exportedPaths?: string[];
}

export interface GQLResultPlanInfo {
  id: string;
  name: string;
  groupId: string; // 由前端扩展， 原数据: [sp0] xxx
  unionGroupId?: string; // 由前端扩展，用于区分重复的 groupId，规则：父级unionGroupId + "-" + 当前groupId
  showName: string; // 由前端扩展， 原数据: [sp0] xxx
  timeMsPercent?: number; // 由前端扩展， 原数据: 0.12
  details: string;
  columns: string[];
  timeMs: number;
  rows: number;
  memoryKib: number;
  blockedMs: number; // 阻塞时间
  queuedMs: number; // 排队时间
  consumeMs: number; // 执行时间
  produceMs: number; // 生产时间
  finishMs: number; // 完成时间
  batches: number;
  concurrency: number;
  otherStatsJson: string;
  children: GQLResultPlanInfo[];
}

export type ConsoleResult<T extends object = Record<string, unknown>> = {
  id: string;
  gql: string;
  code: number;
  message: string;
  warnings?: { code?: string; message?: string }[];
  queryStats?: string[];
  data?: GQLResult<T>;
  destroy: () => void;
};
export interface ServerResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  msg?: string;
  model?: T;
}
