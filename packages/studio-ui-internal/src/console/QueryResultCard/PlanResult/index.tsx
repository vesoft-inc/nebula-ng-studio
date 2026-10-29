import { Box } from '@mui/material';
import { GraphDataTable } from '../../../graph/types/console';
import { ConsoleResult } from '../../types';
import ExplainInfo from '../../ExecutionPlanView/index';

interface PlanResultProps {
  result: ConsoleResult<GraphDataTable>;
}

export default function PlanResult(props: PlanResultProps) {
  const { result } = props;
  const { summary } = result.data || {};

  if (!summary?.planInfo) {
    return <Box sx={{ p: 2, color: ({ palette }) => palette.vesoft.status4 }}>No plan info</Box>;
  }

  return <ExplainInfo summary={summary} />;
}
