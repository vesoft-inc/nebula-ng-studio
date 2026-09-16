import { Box } from '@mui/material';
import { GraphDataTable } from '@studio/interfaces/console';
import { ConsoleResult } from '@vesoft-inc/utils';
import ExplainInfo from '@studio/components/ExplainInfo';

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
