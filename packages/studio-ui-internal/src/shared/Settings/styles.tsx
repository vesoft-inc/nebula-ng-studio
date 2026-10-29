import { Box, styled } from '@mui/material';

export const CustomDrawer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'open',
})<{ open: boolean }>(({ open, theme }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  height: '100%',
  width: 480,
  background: theme.palette.vesoft.v2.bg1,
  borderLeft: `1px solid ${theme.palette.vesoft.v2.border2}`,
  boxShadow: open ? '-4px 0 16px 0 rgba(0,0,0,0.08)' : 'none',
  transform: open ? 'translateX(0)' : 'translateX(100%)',
  transition: 'transform 0.3s cubic-bezier(.4,0,.2,1)',
  zIndex: theme.zIndex.drawer + 2,
  display: 'flex',
  flexDirection: 'column',
  pointerEvents: open ? 'auto' : 'none',
  overflowY: 'auto',
}));

export const CustomBackdrop = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: 'rgba(0,0,0,0.25)',
}));
