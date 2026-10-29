import { PropsWithChildren, useEffect, useState } from 'react';
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
  onClick?: () => void;
  onToggle?: (open: boolean) => Promise<void> | void;
  slots?: Partial<{
    container: BoxProps;
    subItemSx: SxProps<Theme>;
  }>;
}

function CollapseItem(props: CollapseItemProps) {
  const { title, rightPart, icon, defaultOpen = false, level, slots, onToggle } = props;
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
    <Box {...slots?.container}>
      <SubItem
        level={level}
        icon={icon}
        title={title}
        onClick={props.onClick}
        rightPart={rightPart}
        onPrefixClick={handleToggle}
        selected={props.selected}
        prefix={
          loading ? (
            <CachedFilled sx={{ ...spinSx }} />
          ) : (
            <ChevronRightFilled sx={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform ease 0.25s' }} />
          )
        }
        sx={slots?.subItemSx}
      />
      <Collapse in={open} timeout="auto" unmountOnExit>
        {props.children}
      </Collapse>
    </Box>
  );
}

export default CollapseItem;
