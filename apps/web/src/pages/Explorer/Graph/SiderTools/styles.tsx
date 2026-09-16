import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

export const SiderDrawerWrapper = styled(Box)`
  position: absolute;
  left: 100%;
  bottom: 0;
  top: 0;
  overflow: hidden;
  border-left: ${({ theme }) => `${theme.palette.vesoft.textColor6} 1px solid`};
  z-index: ${({ theme }) => theme.zIndex.drawer};
`;

export const SiderDrawer = styled(Box)`
  height: 100%;
  border-right: ${({ theme }) => `${theme.palette.vesoft.textColor6} 1px solid`};
  min-width: 280px;
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor};
`;
