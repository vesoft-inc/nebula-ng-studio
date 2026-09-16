import { styled } from '@mui/material/styles';
import Chip from '@mui/material/Chip';
import { css } from '@emotion/css';
import { brandConfig } from '@studio/utils';

export const StyledChip = styled(Chip)`
  opacity: ${({ theme }) => (theme.palette.mode === 'dark' ? 0.5 : 0.7)};
`;

export const CursorPrefix = css`
  '&::before' {
    content: '${brandConfig.consoleName}> ';
    color: #00ff00;
  }
`;
