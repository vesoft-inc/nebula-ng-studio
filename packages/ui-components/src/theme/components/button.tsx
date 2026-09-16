import type { Components } from '@mui/material';
import type { VesoftColorPalette } from '..';

const customizeMuiButton = ({
  palette,
  spacing,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiButton'] => {
  return {
    styleOverrides: {
      root: {
        textTransform: 'capitalize',
        fontWeight: 'bold',
        fontSize: 14,
        borderRadius: 4,
        boxShadow: 'none',
        minWidth: 80,
      },
    },
    variants: [
      {
        props: { variant: 'text' },
        style: {
          color: palette.vesoft.v2.primary3,
          textDecoration: 'underline',
          textDecorationColor: palette.vesoft.v2.primary3,
          '&:hover': {
            color: palette.vesoft.v2.primary4,
            textDecoration: 'underline',
            textDecorationColor: palette.vesoft.v2.primary4,
            backgroundColor: 'transparent',
          },
        },
      },
      {
        props: { variant: 'contained' },
        style: {
          backgroundColor: palette.vesoft.v2.primary3,
          color: palette.vesoft.v2.text6,
          '&:hover': {
            backgroundColor: palette.vesoft.v2.primary4,
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: palette.vesoft.v2.bg9,
            color: 'white',
          },
        },
      },
      {
        props: { variant: 'outlined' },
        style: {
          borderColor: palette.vesoft.v2.border1,
          color: palette.vesoft.v2.text2,
          '&:hover': {
            backgroundColor: palette.vesoft.v2.bg4,
            boxShadow: 'none',
          },
          '&.Mui-disabled': {
            backgroundColor: 'transparent',
            color: palette.vesoft.v2.text5,
          },
        },
      },
      {
        props: { size: 'small' },
        style: {
          padding: `${spacing(0.5)} ${spacing(1.5)}`,
          height: 24,
        },
      },
      {
        props: { size: 'medium' },
        style: {
          padding: `${spacing(0.75)} ${spacing(2)}`,
          height: 32,
        },
      },
      {
        props: { size: 'large' },
        style: {
          padding: `${spacing(1)} ${spacing(2)}`,
          height: 40,
        },
      },
      {
        props: { color: 'error', variant: 'contained' },
        style: {
          color: palette.vesoft.v2.text6,
          backgroundColor: palette.vesoft.v2.error2,
          '&:hover': {
            backgroundColor: palette.vesoft.v2.error3,
          },
        },
      },
      {
        props: { color: 'error', variant: 'text' },
        style: {
          color: palette.vesoft.v2.error2,
          '&:hover': {
            color: palette.vesoft.v2.error3,
          },
        },
      },
      {
        props: { color: 'error', variant: 'outlined' },
        style: {
          borderColor: palette.vesoft.v2.error2,
          color: palette.vesoft.v2.error2,
          '&:hover': {
            borderColor: palette.vesoft.v2.error3,
            color: palette.vesoft.v2.error3,
          },
        },
      },
    ],
  };
};

const customizeMuiIconButton = ({
  palette,
  spacing,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiIconButton'] => ({
  defaultProps: {
    size: 'small',
  },
  styleOverrides: {
    root: {
      padding: spacing(0.75),
      borderRadius: 4,
      color: `${palette.vesoft.v2.text3}`,
      '&:hover': {
        backgroundColor: palette.vesoft.v2.bg4,
      },
    },
  },
  variants: [
    {
      props: { size: 'medium' },
      style: {
        height: 32,
        width: 32,
        '& .MuiSvgIcon-root': {
          fontSize: 24,
        },
      },
    },
    {
      props: { size: 'small' },
      style: {
        height: 24,
        width: 24,
        '& .MuiSvgIcon-root': {
          fontSize: 20,
        },
      },
    },
    {
      props: { size: 'large' },
      style: {
        height: 36,
        width: 36,
        '& .MuiSvgIcon-root': {
          fontSize: 30,
        },
      },
    },
  ],
});

export { customizeMuiButton, customizeMuiIconButton };
