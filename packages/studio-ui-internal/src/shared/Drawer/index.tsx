import isPropValid from '@emotion/is-prop-valid';
import type { StyledComponent } from '@emotion/styled';
import { Drawer as MuiDrawer, type DrawerProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export const Drawer: StyledComponent<DrawerProps & { openWidth?: number; closeWidth?: number }> = styled(MuiDrawer, {
  shouldForwardProp: (prop: string) => isPropValid(prop) || prop === 'variant',
})<DrawerProps & { openWidth?: number; closeWidth?: number }>(({ theme, open, openWidth, closeWidth }) => ({
  '& .MuiDrawer-paper': {
    position: 'relative',
    whiteSpace: 'nowrap',
    width: openWidth ? `${openWidth}px` : theme.spacing(28),
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    padding: '0 12px',
    boxSizing: 'border-box',
    backgroundColor: theme.palette.vesoft.bgColor,
    ...(!open && {
      overflowX: 'hidden',
      padding: 0,
      transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
      width: closeWidth !== undefined ? `${closeWidth}px` : theme.spacing(8),
      height: '100%',
    }),
  },
}));
