import { Card } from '@mui/material';
import { styled } from '@mui/material/styles';

export const GraphCard = styled(Card)`
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
  border: 1px solid ${({ theme }) => theme.palette.vesoft.v2.border2};
  height: 120px;
  border-radius: 10px;
  padding: 20px 30px;
  position: relative;
  &:hover {
    // box-shadow: 0px 2px 10px ${({ theme }) => theme.palette.vesoft.themeColor1};
    border: 1px solid ${({ theme }) => theme.palette.vesoft.v2.primary3};
    cursor: pointer;
  }
`;
