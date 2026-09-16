import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import { getVesoftPaletteColor } from '@vesoft-inc/ui-components/theme';
import { getVesoftBorder } from '@studio/utils';
import { Button } from '@mui/material';

export const SiderItem = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  border-right: ${getVesoftBorder};
`;

export const SiderItemHeader = styled(Button)`
  flex: 0 0 50px;
  height: 50px;
  display: flex;
  align-items: center;
  color: ${getVesoftPaletteColor('textColor1')};
  border-bottom: ${getVesoftBorder};
  font-weight: 600;
`;

export const NonCollapsibleHeader = styled(Box)`
  height: 50px;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.palette.vesoft.v2.text2};
  border-bottom: ${getVesoftBorder};
  font-size: 16px;
  font-weight: 600;
  padding: ${({ theme }) => theme.spacing(2)};
`;
