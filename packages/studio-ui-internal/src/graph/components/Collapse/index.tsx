import { MouseEventHandler, PropsWithChildren, useEffect, useState } from 'react';
import { Box, Collapse, type SxProps, type Theme, type BoxProps } from '@mui/material';
import { CachedFilled, ChevronRightFilled } from '@vesoft-inc/icons';

import SubItem from './SubItem';
import { spinSx } from './styles';

interface CollapseItemProps extends PropsWithChildren {
  icon?: React.ReactNode;
  title: string | React.ReactNode;
  rightPart?: React.ReactNode;
  defaultOpen?: boolean;
  level?: number;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLLIElement>;
  onToggle?: (open: boolean) => Promise<void> | void;
  slotProps?: Partial<{
    container: BoxProps;
    subItemSx: SxProps<Theme>;
  }>;
  onlyIconToggle?: boolean;
  unmountOnExit?: boolean;
}

function CollapseItem(props: CollapseItemProps) {
  const {
    title,
    rightPart,
    icon,
    defaultOpen = false,
    slotProps,
    onToggle,
    unmountOnExit = true,
    onlyIconToggle = true,
  } = props;
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const curOpen = !open;
    if (!onToggle) {
      setOpen(curOpen);
      return;
    }
    if (onToggle.constructor.name === 'AsyncFunction') {
      setLoading(true);
      await onToggle?.(curOpen);
      setLoading(false);
    } else {
      onToggle?.(curOpen);
    }
    setOpen(curOpen);
  };

  return (
    <Box {...slotProps?.container}>
      <SubItem
        icon={icon}
        title={title}
        onClick={(e) => {
          if (!onlyIconToggle) {
            handleToggle(e);
          }
          props?.onClick?.(e);
        }}
        rightPart={rightPart}
        onPrefixClick={handleToggle}
        selected={props.selected}
        prefix={
          loading ? (
            <CachedFilled sx={{ ...spinSx }} />
          ) : (
            <ChevronRightFilled
              sx={{
                transform: `rotate(${open ? 90 : 0}deg)`,
                transition: 'transform ease 0.25s',
              }}
            />
          )
        }
        sx={slotProps?.subItemSx}
      />
      <Collapse in={open} timeout="auto" unmountOnExit={unmountOnExit}>
        {props.children}
      </Collapse>
    </Box>
  );
}

export default CollapseItem;
