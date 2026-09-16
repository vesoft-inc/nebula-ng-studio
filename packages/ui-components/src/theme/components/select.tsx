import type { Components } from '@mui/material';

const DropDownHeight = 300;

const customizeMuiSelect = (): Components['MuiSelect'] => ({
  defaultProps: {
    size: 'small',
    MenuProps: {
      PaperProps: {
        sx: {
          maxHeight: DropDownHeight,
          maxWidth: 300,
        },
      },
      MenuListProps: {
        component: 'div',
        sx: {
          display: 'flex',
          flexDirection: 'column',
          height: 'auto',
          maxHeight: DropDownHeight,
        },
      },
    },
  },
});

export { customizeMuiSelect };
