import type { ReactNode, ReactElement } from 'react';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import Tooltip, { type TooltipProps } from '@mui/material/Tooltip';
import ListItemText from '@mui/material/ListItemText';
import type { SxProps, Theme } from '@mui/material/styles';
import { StyledListItem } from './styles';

function TooltipWrapper(props: { tooltip?: Omit<TooltipProps, 'children'>; children: ReactElement }) {
  const { tooltip, children } = props;

  if (!tooltip) {
    return children;
  }

  return (
    <Tooltip placement="right" {...tooltip}>
      {children}
    </Tooltip>
  );
}

export interface SiderMenuItem {
  key: string;
  label?: ReactNode;
  icon?: ReactNode;
  /**
   * - placement - `right` by default
   */
  tooltip?: Omit<TooltipProps, 'children'>;
  sx?: SxProps<Theme>;
  disabled?: boolean;
}

export interface SiderMenuProps {
  items: SiderMenuItem[];
  mode?: 'normal' | 'tiny';
  activeKey?: string;
  onMenuClick?: (key: string, item: SiderMenuItem, event: React.MouseEvent) => void;
  onMenuChange?: (key: string, item: SiderMenuItem) => void;
  wrapSx?: SxProps<Theme>;
}

export default function SiderMenu(props: SiderMenuProps) {
  const { items, activeKey, onMenuClick, wrapSx, onMenuChange } = props;
  const defaultItemSx = {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    px: 1.5,
  };
  return (
    <List sx={wrapSx}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <StyledListItem key={item.key} disablePadding active={active}>
            <TooltipWrapper tooltip={item.tooltip}>
              <ListItemButton
                disabled={item.disabled}
                sx={Array.isArray(item.sx) ? [defaultItemSx, ...item.sx] : [defaultItemSx, item.sx]}
                onClick={(e) => {
                  onMenuClick?.(item.key, item, e);
                  !active && onMenuChange?.(item.key, item);
                }}
              >
                {!!item.icon && <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}>{item.icon}</ListItemIcon>}
                {!!item.label && <ListItemText primary={item.label} sx={{ ml: 1, color: 'inherit' }} />}
              </ListItemButton>
            </TooltipWrapper>
          </StyledListItem>
        );
      })}
    </List>
  );
}
