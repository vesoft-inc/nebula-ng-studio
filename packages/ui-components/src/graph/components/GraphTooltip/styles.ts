import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { hexToRgba } from '@vesoft-inc/studio-core';

export const TooltipContainer = styled(Box)`
  position: absolute;
  background: ${({ theme }) => hexToRgba(theme.palette.vesoft.bgColor, 0.8)};
  box-shadow: 0px 2px 8px 0px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  border-radius: 6px;
  font-size: 12px;
  padding: 12px;
  text-align: left;
  z-index: 100;
  width: 300px;
  max-height: 250px;
  overflow: auto;
  transform: translate(16px, 16px);
`;

export const EntityBox = styled(Box)`
  display: inline-block;
  padding: 5px 10px;
  border-radius: 20px;
  margin: 10px 0;
`;

export const EdgeTypeBox = styled(Box)`
  margin: 10px 0 0;
  position: relative;
  display: flex;
  align-items: center;
`;

export const LineBox = styled(Box)`
  width: 8px;
  height: 3px;
  background-color: ${({ theme }) => theme.palette.grey[800]};
`;

export const EdgeBox = styled(Box)`
  margin: 0 5px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const PropertyBox = styled(Box)`
  line-height: ${({ theme }) => theme.spacing(2)};
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  display: flex;
  align-items: center;
`;
