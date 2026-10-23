import { Box, ListItem, ListItemText, SxProps, type Theme } from '@mui/material';

import { schemaTextSx } from './styles';
import { MouseEventHandler } from 'react';

interface ISubItemProps {
  level?: number;
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  onClick?: () => void;
  onPrefixClick?: MouseEventHandler<HTMLDivElement>;
  rightPart?: React.ReactNode;
  selected?: boolean;
  sx?: SxProps<Theme>;
}

function SubItem(props: ISubItemProps) {
  const { level = 1, prefix, rightPart, onClick, icon, title, selected, sx } = props;

  return (
    <ListItem
      onClick={onClick}
      sx={{
        padding: 0,
        pl: level * 1 + 1,
        display: 'flex',
        justifyContent: 'space-between',
        backgroundColor: selected ? (theme) => theme.palette.vesoft.v2.bg3 : 'transparent',
        alignItems: 'center',
        '&:hover': {
          cursor: 'pointer',
        },
        ...sx,
      }}
    >
      <Box display="flex" alignItems="center">
        <Box display="flex" alignItems="center" onClick={props.onPrefixClick}>
          {prefix}
        </Box>
        {icon}
        <ListItemText
          primaryTypographyProps={{
            sx: schemaTextSx,
            ml: 1,
          }}
          primary={title}
        />
      </Box>

      {rightPart && <Box onClick={(e) => e.stopPropagation()}>{rightPart}</Box>}
    </ListItem>
  );
}

export default SubItem;
