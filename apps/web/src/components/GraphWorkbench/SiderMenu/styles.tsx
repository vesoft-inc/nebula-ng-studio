import ListItem, { type ListItemProps } from '@mui/material/ListItem';
import { styled } from '@mui/material/styles';

export const StyledListItem = styled(ListItem, {
  shouldForwardProp: (propName) => propName !== 'active',
})<ListItemProps & { active?: boolean }>(({ theme: { palette }, active }) => ({
  display: 'block',
  color: palette.vesoft.textColor1,
  ...(active && {
    backgroundColor: palette.vesoft.themeColor1,
    color: palette.vesoft.textColor8,
    '&:hover': {
      backgroundColor: palette.vesoft.themeColor1,
    },
  }),
}));
