import { css } from '@emotion/css';
import isPropValid from '@emotion/is-prop-valid';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { BoxProps } from '@mui/material';

export const GraphContainer = styled(Box)`
  position: relative;
  display: flex;
  flex: 1;
  height: 100%;
  min-height: 500px;
  border: ${({ theme }) => `1px solid ${theme.palette.vesoft.v2.divider2}`};
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
`;

export const TagItem = styled(Box)`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px dashed slategray;
  padding: 0 2px;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.palette.vesoft.textColor3};
  cursor: move;
  &:not(:last-child) {
    margin-bottom: 15px;
  }
`;

export const ScaleBtnContainer = styled(Box, {
  shouldForwardProp: (prop: string) => isPropValid(prop) || prop === 'variant',
})<BoxProps>(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  zIndex: 1,
  transition: theme.transitions.create('right', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
}));

export const ColorBox = styled(Box)`
  width: 24px;
  height: 20px;
  border-radius: 6px;
  margin-right: ${({ theme }) => theme.spacing(1)};
`;

export const fullScreenCls = css`
  position: fixed;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  left: 0;
  top: 0;
  margin: 0;
  padding: 0;
`;
