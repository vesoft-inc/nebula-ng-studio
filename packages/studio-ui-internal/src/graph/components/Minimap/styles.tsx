import Box from '@mui/material/Box';
import { styled, alpha } from '@mui/material/styles';

export const MinimapContainer = styled(Box)`
  position: absolute;
  bottom: 36px;
  right: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const MinimapBox = styled(Box)`
  background-color: ${({ theme: { palette } }) =>
    palette.mode === 'dark' ? palette.vesoft.bgColor1 : palette.vesoft.background.paper};
  border-radius: 5px;
  box-shadow: ${({ theme }) => theme.shadows[2]};
  position: relative;
`;

export const MinimapDragBox = styled(Box)`
  position: absolute;
  border: 2px solid ${({ theme }) => theme.palette.primary.light};
  background-color: ${({ theme }) => alpha(theme.palette.grey[200], 0.4)};
  min-width: 20px;
  min-height: 20px;
  left: 20px;
  top: 20px;
  cursor: move;
`;

export const MinimapDragPoint = styled(Box)`
  width: 10px;
  height: 10px;
  position: absolute;
  right: -5px;
  bottom: -5px;
  background-color: ${({ theme }) => theme.palette.grey[50]};
  cursor: se-resize;
  border: 2px solid ${({ theme }) => theme.palette.primary.light};
  border-radius: 10px;
`;

export const ActionGroup = styled(Box)`
  height: 100%;
  padding: 2px 0 4px 0;
  margin-left: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;
