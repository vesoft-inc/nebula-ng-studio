import { Box, Card, Grid } from '@mui/material';
import { styled } from '@mui/material/styles';

export const ListCardContainer = styled(Card)`
  background-color: ${({ theme }) => theme.palette.vesoft.v2.bg1};
  border: 1px solid ${({ theme }) => theme.palette.vesoft.v2.border2};
  height: 116px;
  border-radius: 10px;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(2)};
  position: relative;

  display: flex;
  flex-direction: column;

  &:hover {
    border: 1px solid ${({ theme }) => theme.palette.vesoft.v2.primary3};
    cursor: pointer;
  }
`;

export const CardTitle = styled(Box)`
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.palette.vesoft.v2.text2};
`;

export const CardInfoContainer = styled(Grid)`
  flex: 1;
  margin-top: ${({ theme }) => theme.spacing(1.5)};
`;

export const CardInfoItem = styled(Grid)`
  display: flex;
  flex-direction: column;
  font-size: 14px;
  font-weight: 400;
  color: ${({ theme }) => theme.palette.vesoft.v2.text3};

  // gap: ${({ theme }) => theme.spacing(2)};
  // width: 100%;
`;
