import { Box, Button } from '@mui/material';
import { styled } from '@mui/material/styles';

export const ScalesBtnContainer = styled(Box)`
  display: flex;
  flex-direction: column;
`;

export const ScaleButton = styled(Button)`
  width: 34px;
  height: 34px;
  min-width: 34px;
  color: ${({ theme }) => theme.palette.vesoft.textColor3};

  &:not(:last-child) {
    margin-bottom: 8px;
  }
`;
