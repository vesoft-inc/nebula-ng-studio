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
