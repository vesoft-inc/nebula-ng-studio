import {
  Box,
  BoxProps,
  ListItemIcon,
  ListItemIconProps,
  ListItemText,
  ListItemTextProps,
  Menu,
  MenuItem,
  MenuItemProps,
  PopoverProps,
  SxProps,
  Theme,
} from '@mui/material';
import React, { PropsWithChildren, useId } from 'react';
import { bindMenu, bindTrigger } from 'material-ui-popup-state/hooks';
import PopupState, { type Props as PopupStateProps } from 'material-ui-popup-state';

export interface IDropdownMenuItem {
  label: React.ReactNode;
  key: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLLIElement, MouseEvent>) => void;
  sx?: SxProps<Theme>;
}

interface DropdownProps extends PropsWithChildren {
  items: IDropdownMenuItem[];
  variant?: PopupStateProps['variant'];
  trigger?: 'hover' | 'click';
  slotProps?: Partial<{
    container: BoxProps;
    popover: Partial<PopoverProps>;
    menuItem: MenuItemProps;
    menuIcon: ListItemIconProps;
    menuItemText: ListItemTextProps;
  }>;
}

function Dropdown(props: DropdownProps) {
  const { items, slotProps = {}, variant = 'popover', trigger } = props;

  const popupId = useId();

  const child = React.Children.only(props.children) as React.ReactElement;

  return (
    <PopupState variant={variant} popupId={popupId}>
      {(popupState) => {
        const { onClick, onTouchStart } = bindTrigger(popupState);
        return (
          <>
            {React.cloneElement(child, {
              // @ts-ignore
              onClick: (e: React.MouseEvent<HTMLElement>) => {
                onClick(e);
                // @ts-ignore
                child.props.onClick?.(e);
              },
              onMouseEnter:
                // @ts-ignore
                trigger === 'hover'
                  ? (e: React.MouseEvent<HTMLElement>) => {
                      onClick(e);
                      // @ts-ignore
                      child.props.onMouseEnter?.(e);
                    }
                  : undefined,
              onTouchStart,
            })}
            <Menu
              {...bindMenu(popupState)}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              {...slotProps.popover}
            >
              {items.map((item, index) => (
                <MenuItem
                  key={index}
                  disabled={item.disabled}
                  onClick={(event) => {
                    item?.onClick?.(event);
                    popupState.close();
                  }}
                  {...slotProps.menuItem}
                  sx={item.sx}
                >
                  {item.icon && <ListItemIcon {...slotProps.menuIcon}>{item.icon}</ListItemIcon>}
                  <ListItemText {...slotProps.menuItemText}>
                    <Box
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.label}
                    </Box>
                  </ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        );
      }}
    </PopupState>
  );
}

export default Dropdown;
