import { Card } from '@mui/material';
import { styled } from '@mui/material/styles';

export const SketchItemCard = styled(Card)`
  background-color: ${({ theme }) => theme.palette.vesoft.bgColor};
  border-color: ${({ theme }) => theme.palette.vesoft.bgColor11};
  border-radius: 10px;
  &:hover {
    box-shadow: 0px 2px 10px ${({ theme }) => theme.palette.vesoft.themeColor1};
    cursor: pointer;
  }
`;
