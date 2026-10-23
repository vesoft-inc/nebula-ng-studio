import { getVesoftBorder } from '../../shared/utilities';
import { Box, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';

export const FooterHeight = 70;

export const ContentContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(0, 3)};
  padding-bottom: ${FooterHeight + 10}px;
  overflow-y: auto;
`;

export const ActionContainer = styled(Box)`
  display: flex;
  align-items: center;
`;

export const MainContainer = styled(Box)`
  position: relative;
  width: 100%;
  flex: 1;
  margin-top: 20px;
  min-height: 660px;
`;

export const CreateGraphContainer = styled(Box)`
  position: relative;
  width: 100%;
  flex: 1;
  height: 100%;
`;

export const StepContainer = styled(Box)`
  width: 100%;
  height: calc(100% - 52px);
  flex-direction: column;
`;

export const TableContainer = styled(Box)`
  width: 100%;
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  padding-bottom: ${FooterHeight + 30}px;
`;

export const FooterContainer = styled(Box)`
  width: 100%;
  height: ${FooterHeight}px;
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  z-index: ${({ theme }) => theme.zIndex.appBar};
  justify-content: center;
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor};
  border-top: 1px solid ${({ theme }) => theme.palette.vesoft.bgColor11};
`;

export const TypeInfoContainer = styled(Box)`
  padding: 10px 16px;
`;

export const PropertyFormContainer = styled(Box)(({ theme }) => ({
  overflow: 'hidden',
  '& .MuiInputBase-root.Mui-disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    cursor: 'not-allowed',
    '& .MuiInputBase-input': {
      background: 'transparent',
      WebkitTextFillColor: theme.palette.text.disabled,
    },
    '& .MuiSvgIcon-root': { color: theme.palette.action.disabled },
    '& fieldset, &:hover fieldset': { borderColor: `${theme.palette.divider} !important` },
  },
  '& .MuiCheckbox-root.Mui-disabled, & .MuiIconButton-root.Mui-disabled': {
    color: theme.palette.action.disabled,
  },
}));

export const PropertyHeaderCell = styled(Box)`
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor2};
  padding: ${({ theme }) => theme.spacing(1)};
  padding-left: ${({ theme }) => theme.spacing(3)};
  text-align: left;
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  &:before {
    content: '';
    width: 2px;
    background-color: ${({ theme }) => theme.palette.vesoft.textColor6};
    height: 50%;
    position: absolute;
    top: 25%;
    left: ${({ theme }) => theme.spacing(1)};
  }
`;

export const PropertyBodyCell = styled(Box)`
  padding: ${({ theme }) => theme.spacing(1)};
  text-align: center;
  flex: 1;
  display: flex;
  align-items: center;
  min-height: 60px;
`;

export const PropertyHeaderDivider = styled(Divider)`
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor2};
  height: 50%;
  margin-top: 25%;
`;

export const EditorWrapper = styled(Box)`
  border: ${getVesoftBorder};
  position: relative;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  height: 400px;
  resize: vertical;
  overflow: hidden;
`;
