import type { GQLResult, GQLResultPlanInfo } from '@vesoft-inc/studio-core/contracts';

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

/** Presentation fields are populated by the plan view, not returned by the query protocol. */
export interface PlanNodeData extends Omit<GQLResultPlanInfo, 'children'> {
  groupId: string;
  unionGroupId?: string;
  showName: string;
  timeMsPercent?: number;
  children: PlanNodeData[];
}

export function toPlanNodeData(node: GQLResultPlanInfo): PlanNodeData {
  return { ...node, groupId: '', showName: node.name, children: (node.children ?? []).map(toPlanNodeData) };
}
