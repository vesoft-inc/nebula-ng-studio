import type { Components } from '@mui/material';
import type { VesoftColorPalette } from '..';

export const customizeMuiStepConnector = ({
  palette,
  spacing,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiStepConnector'] => ({
  styleOverrides: {
    line: {
      borderColor: palette.vesoft.v2.primary3,
      marginTop: spacing(-1.5),
      borderTopStyle: 'dashed',
    },
    root: {
      '&.Mui-disabled': {
        ' & .MuiStepConnector-line': {
          borderColor: palette.vesoft.v2.border1,
        },
      },
    },
  },
});

export const customizeMuiStepLabel = ({
  palette,
  spacing,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiStepLabel'] => ({
  styleOverrides: {
    root: {
      flexDirection: 'column',
    },
    label: {
      fontSize: 16,
      marginTop: spacing(-1),
    },
    iconContainer: {
      color: palette.vesoft.v2.primary3,
      '& .MuiSvgIcon-root': {
        width: 24,
        height: 24,
      },
      '&.Mui-disabled': {
        '& .MuiSvgIcon-root': {
          color: palette.vesoft.v2.border1,
        },
      },
    },
  },
});
