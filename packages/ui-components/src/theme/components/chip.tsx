import type { Components } from '@mui/material';
import type { VesoftColorPalette } from '..';

const customizeMuiChip = ({
  palette,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiChip'] => ({
  styleOverrides: {
    root: {
      borderRadius: 6,
      backgroundColor: palette.vesoft.v2.bg6,
    },
  },
  variants: [
    {
      props: { size: 'small' },
      style: {
        height: 20,
      },
    },
    {
      props: { size: 'medium' },
      style: {
        height: 24,
      },
    },
  ],
});

export { customizeMuiChip };
