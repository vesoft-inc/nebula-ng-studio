import { PlanNodeData as GQLResultPlanInfo } from '../../types';
import { GQLResultSummary } from '@vesoft-inc/studio-core/contracts';

export interface PlanNodeDrawerProps {
  open: boolean;
  summary: GQLResultSummary;
  onClose: () => void;
  nodeData: GQLResultPlanInfo | null;
  allNodesData?: GQLResultPlanInfo[]; // 用于计算 Top 5
  onNodeFocus?: (nodeId: string) => void;
}

export type TabType = 'Time' | 'Memory' | 'Rows';
