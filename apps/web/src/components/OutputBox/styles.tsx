import { styled } from '@mui/material/styles';
import Box, { BoxProps } from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import { getVesoftBorder } from '@studio/utils';
import { css } from '@emotion/css';

export const OutputContainer = styled(Box)`
  padding: ${({ theme }) => theme.spacing(2, 2)};
  border-top: ${getVesoftBorder};
  border-bottom: ${getVesoftBorder};
  color: ${({ theme }) => theme.palette.vesoft.textColor1};
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
`;

export const OutputHeader = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const HeaderTitle = styled(Box, { shouldForwardProp: (propName) => propName !== 'success' })<
  BoxProps & { success?: boolean }
>(({ theme, success }) => {
  const { vesoft } = theme.palette;
  return {
    flex: 1,
    height: '42px',
    fontWeight: 500,
    backgroundColor: success ? vesoft.v2.success1 : vesoft.v2.error1,
    color: success ? vesoft.v2.text2 : vesoft.v2.text2,
    borderRadius: theme.shape.borderRadius,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    '& *': {
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    },
  };
});

export const HeaderAction = styled(Box)`
  width: 160px;
  flex: 0 0 160px;
  height: 100%;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  & > svg {
    cursor: pointer;
  }
`;

export const StyledIconButton = styled(IconButton)`
  color: ${({ theme }) => theme.palette.vesoft.v2.text3};
`;

export const OutputContent = styled(Box)`
  height: calc(100% - 60px);
  display: flex;
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
`;

export const OutputFooter = styled(Box)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor};
  color: ${({ theme }) => theme.palette.vesoft.v2.text3};
`;

export const ContentMain = styled(Box)`
  flex: 1;
  overflow: hidden;
`;

export const fullScreenCls = css`
  position: fixed;
  /* z-index: 9999; */
  width: 100vw;
  height: calc(100vh - 60px);
  left: 0;
  top: 0;
  margin: 0;
  padding: 0;
`;
