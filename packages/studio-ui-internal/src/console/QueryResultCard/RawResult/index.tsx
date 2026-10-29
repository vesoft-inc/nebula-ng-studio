import { useState } from 'react';
import { useTheme, Box } from '@mui/material';
import MonacoEditor from '../../../editor/MonacoEditor/index';
import { JSONBig, transformNebulaResult } from '../../../shared/utilities';
import { ConsoleResult } from '../../types';

export default function RawResult({ result }: { result: ConsoleResult }) {
  const themeMode = useTheme().palette.mode;
  const { headers = [], tables = [] } = result.data || {};
  const [dstStr] = useState(() => {
    const dst = tables.map((item) => {
      const obj = (headers || []).reduce(
        (acc, key) => {
          acc[key] = transformNebulaResult(item[key]);
          return acc;
        },
        {} as Record<string, unknown>
      );
      return obj;
    });
    return JSONBig.stringify(dst, null, 2);
  });

  return (
    <Box
      m={0}
      p={0}
      height="100%"
      overflow="auto"
      sx={{ position: 'relative', border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider2}` }}
    >
      <MonacoEditor value={dstStr} readOnly language="json" themeMode={themeMode} />
    </Box>
  );
}
