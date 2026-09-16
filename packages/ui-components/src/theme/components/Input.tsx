import type { Components } from '@mui/material';
import { themeStore, type VesoftColorPalette } from '..';

const getDisableBackground = (palette: VesoftColorPalette) => {
  return themeStore.mode === 'dark' ? palette.vesoft.v2.bg7 : palette.vesoft.v2.bg6;
};

const customizeMuiOutlinedInput = ({
  palette,
  spacing,
}: {
  palette: VesoftColorPalette;
  spacing: (value: number) => string;
}): Components['MuiOutlinedInput'] => ({
  styleOverrides: {
    root: {
      height: 32,
      borderRadius: 6,
      backgroundColor: palette.vesoft.v2.bg1,
      '& fieldset': {
        borderColor: palette.vesoft.v2.border1,
      },
      '&:hover fieldset': {
        borderColor: palette.vesoft.v2.primary3 + ' !important',
      },
      '&.Mui-focused fieldset': {
        borderColor: palette.vesoft.v2.primary3 + ' !important',
        borderWidth: 2,
      },
      '& .MuiSvgIcon-root': {
        fontSize: 20,
        color: palette.vesoft.v2.text4,
      },
      '& .MuiInputBase-input.MuiOutlinedInput-input:-webkit-autofill': {
        WebkitBoxShadow: `0 0 0 100px ${palette.vesoft.v2.bg1} inset`,
        WebkitTextFillColor: palette.vesoft.v2.text1,
        caretColor: palette.vesoft.v2.text1,
        borderRadius: 'inherit',
      },
    },
    input: {
      padding: `${spacing(1)} ${spacing(1.5)}`,
      color: palette.vesoft.v2.text2,
      '&::placeholder': {
        color: palette.vesoft.v2.text4,
        opacity: 1,
      },
    },
  },
  variants: [
    {
      props: { size: 'small' },
      style: {
        height: 32,
        '& .MuiInputBase-input.Mui-disabled': {
          cursor: 'not-allowed',
          height: 16,
          background: getDisableBackground(palette),
          borderRadius: 6,
        },
      },
    },
    {
      props: { size: 'medium' },
      style: {
        height: 40,
        '& .MuiInputBase-input.Mui-disabled': {
          cursor: 'not-allowed',
          height: 22,
          background: getDisableBackground(palette),
          borderRadius: 6,
        },
      },
    },
    {
      props: { size: 'medium', multiline: true },
      style: {
        height: 'auto',
        padding: `${spacing(0.75)} ${spacing(0.75)}`,
        '& .MuiInputBase-input.Mui-disabled': {
          cursor: 'not-allowed',
          height: 22,
          background: getDisableBackground(palette),
          borderRadius: 6,
        },
      },
    },
  ],
});

const customizeMuiTextField = ({ palette }: { palette: VesoftColorPalette }): Components['MuiTextField'] => ({
  styleOverrides: {
    root: {
      label: {
        color: palette.vesoft.v2.text4,
        '&[data-shrink=false]': {
          top: -5,
        },
      },
    },
  },
  variants: [
    {
      props: { size: 'small' },
      style: {
        label: {
          '&[data-shrink=false]': {
            top: -2,
          },
        },
      },
    },
    {
      props: { size: 'medium' },
      style: {
        label: {
          '&[data-shrink=false]': {
            top: -6,
          },
        },
      },
    },
  ],
});
// const customizeMuiInputLabel = ({
//   palette,
// }: {
//   palette: VesoftColorPalette;
//   spacing: (value: number) => string;
// }): Components['MuiInputLabel'] => ({
//   styleOverrides: {
//     root: {
//       top: -10,
//       transform: 'translate(14px, 100%) scale(1)',
//       // color: palette.vesoft.v2.text4,
//       color: palette.vesoft.v2.error3,
//     },
//     shrink: {
//       top: -10,
//       transform: 'translate(14px, 10%) scale(0.75)',
//     },
//   },
//   variants: [
//     {
//       props: { size: 'small' },
//       style: {
//         top: -15,
//         '&.MuiInputLabel-shrink': {
//           top: -8,
//           transform: 'translate(14px, 0) scale(0.75)',
//         },
//       },
//     },
//   ],
// });

export { customizeMuiOutlinedInput, customizeMuiTextField };
