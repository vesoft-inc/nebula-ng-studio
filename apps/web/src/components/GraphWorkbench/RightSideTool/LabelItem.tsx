import { Box, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import { EyeOffOutline, RemoveRedeyeOutlined } from '@vesoft-inc/icons';
import { observer } from 'mobx-react-lite';
import { SyntheticEvent, useState } from 'react';

export interface LabelTypeItem {
  label: string;
  count: number;
}

interface LabelItemProps {
  item: LabelTypeItem;
  onClick: () => void;
  selected?: boolean;
}

function LabelItem(props: LabelItemProps) {
  const { item, onClick, selected = false } = props;
  // const { graph } = useStore().explorerStore;
  // const {
  //   vertexFilterStore: { nodeTypeFilterAction },
  // } = graph;
  const [isHover, setIsHover] = useState<boolean>(false);
  const [show, setShow] = useState<boolean>(true);

  const handleToggleVisible = (visible: boolean) => (e: SyntheticEvent) => {
    e.stopPropagation();
    setShow(visible);
    if (visible) {
      setShow(true);
      // nodeTypeFilterAction([item.typeName], 'delete');
    } else {
      setShow(false);
      // nodeTypeFilterAction([item.typeName], 'add');
    }
  };

  const renderCount = () => {
    if (!show) {
      return (
        <IconButton size="small" onClick={handleToggleVisible(true)}>
          <EyeOffOutline sx={{ color: (theme) => theme.palette.vesoft.textColor2 }} />
        </IconButton>
      );
    }
    if (isHover) {
      return show ? (
        <IconButton size="small" onClick={handleToggleVisible(false)}>
          <RemoveRedeyeOutlined sx={{ color: (theme) => theme.palette.vesoft.textColor2 }} />
        </IconButton>
      ) : (
        <IconButton size="small" onClick={handleToggleVisible(true)}>
          <EyeOffOutline sx={{ color: (theme) => theme.palette.vesoft.textColor2 }} />
        </IconButton>
      );
    }
    return (
      <Typography component="span" sx={{ color: (theme) => theme.palette.vesoft.textColor2 }}>
        {item.count}
      </Typography>
    );
  };

  return (
    <Box
      height={32}
      width="100%"
      display="flex"
      justifyContent="space-between"
      alignItems={'center'}
      borderRadius="6px"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      onClick={onClick}
      sx={{
        backgroundColor: (theme) =>
          selected ? theme.palette.vesoft.bluegrey[9] : theme.palette.vesoft.background.secondaryBar,
        padding: '4px 12px',
        '&:not(:last-child)': {
          marginBottom: 1,
        },
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: (theme) => theme.palette.vesoft.bluegrey[9],
        },
      }}
    >
      <Box display="flex" alignItems="center">
        <Tooltip title={item.label} placement="right" arrow>
          <Chip
            sx={{
              // backgroundColor: item.color,
              borderRadius: '5px',
              width: (theme) => theme.spacing(8),
              height: 22,
              fontSize: 12,
            }}
            label={item.label}
          ></Chip>
        </Tooltip>
      </Box>
      <Box mr={isHover || !show ? 1 : 2} display="flex" alignItems="center">
        {renderCount()}
      </Box>
    </Box>
  );
}

export default observer(LabelItem);
