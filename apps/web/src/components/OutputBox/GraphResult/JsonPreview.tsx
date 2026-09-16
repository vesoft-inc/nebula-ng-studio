import { Box, SxProps, Theme } from '@mui/material';
import { useTheme } from '@mui/material';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { stackoverflowDark, stackoverflowLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

const JsonPreview = ({ data, sx }: { data: string; sx?: SxProps<Theme> }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'relative',
        flex: 1,
        overflow: 'auto',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: '12px',
        padding: '0 0 4px 12px',

        '&::-webkit-scrollbar': {
          WebkitAppearance: 'none',
          width: '6px !important',
          height: '6px !important',
          backgroundColor: 'transparent !important',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg8,
          borderRadius: '3px !important',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent !important',
        },
        ...sx,
      }}
    >
      <SyntaxHighlighter
        language="json"
        style={theme.palette.mode === 'dark' ? stackoverflowDark : stackoverflowLight}
        customStyle={{
          background: 'transparent !important',
          margin: 0,
          padding: 0,
          fontSize: '12px',
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          overflow: 'visible',
        }}
        codeTagProps={{
          style: {
            paddingRight: '12px',
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: '12px',
            background: 'transparent',
          },
        }}
      >
        {data}
      </SyntaxHighlighter>
    </Box>
  );
};

export default JsonPreview;
