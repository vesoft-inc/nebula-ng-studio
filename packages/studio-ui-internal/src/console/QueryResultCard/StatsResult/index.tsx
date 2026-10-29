import { Box, useTheme } from '@mui/material';
import { GraphDataTable } from '../../../graph/types/console';
import { ConsoleResult } from '../../types';

interface StatsResultProps {
  result: ConsoleResult<GraphDataTable>;
}

export default function StatsResult(props: StatsResultProps) {
  const { result } = props;
  const theme = useTheme();
  const stats = (result.queryStats || []).map((item) => item.trim()).filter(Boolean);

  if (!stats.length || result.code !== 0) {
    return null;
  }

  return (
    <Box
      p={1}
      px={1.5}
      height="100%"
      overflow="auto"
      sx={{
        border: `1px solid ${theme.palette.vesoft.v2.divider2}`,
        backgroundColor: theme.palette.vesoft.v2.bg2,
        color: theme.palette.vesoft.v2.text2,
        fontSize: 13,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {stats.join('\n\n')}
    </Box>
  );
}
