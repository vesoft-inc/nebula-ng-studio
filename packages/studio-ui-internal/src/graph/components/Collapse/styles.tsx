import { SxProps, Theme } from '@mui/material';

export const schemaTextSx: SxProps<Theme> = {
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const spinSx = {
  animation: 'spin 1.5s linear infinite',
  '@keyframes spin': {
    '0%': {
      transform: 'rotate(360deg)',
    },
    '100%': {
      transform: 'rotate(0deg)',
    },
  },
};
