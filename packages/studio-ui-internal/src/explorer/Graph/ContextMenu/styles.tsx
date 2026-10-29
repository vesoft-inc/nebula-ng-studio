import { ListItemIcon, ListItemText } from '@mui/material';
import { styled } from '@mui/material/styles';

export const MenuItemIcon = styled(ListItemIcon)`
  min-width: ${({ theme }) => theme.spacing(4)};
  display: flex;
  justify-content: center;
  font-size: 8px;
  color: inherit;
`;

export const MenuItemText = styled(ListItemText)`
  span {
    font-size: 14px;
    line-height: 14px;
  }
`;
