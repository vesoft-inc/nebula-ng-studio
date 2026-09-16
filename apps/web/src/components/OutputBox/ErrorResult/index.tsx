import { Stack } from '@mui/material';
import Box from '@mui/material/Box';
import { CancelFilled } from '@vesoft-inc/icons';
import { ConsoleResult } from '@vesoft-inc/utils';

export default function ErrorResult({ result }: { result: ConsoleResult }) {
  const { message } = result;
  return (
    <Stack
      direction="row"
      gap={1}
      sx={{
        p: '0 4px',
      }}
    >
      <CancelFilled
        sx={{
          width: 16,
          height: 16,
          mt: '2px',
          color: (theme) => theme.palette.vesoft.v2.error2,
        }}
      />
      <Box
        sx={{
          height: '100%',
          overflowY: 'auto',
          fontSize: '12px',
          fontWeight: 400,
          color: (theme) => theme.palette.vesoft.v2.text2,
        }}
      >
        {message}
      </Box>
    </Stack>
  );
}
