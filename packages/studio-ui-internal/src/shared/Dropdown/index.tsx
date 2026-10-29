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
import React, { PropsWithChildren, useEffect, useId, useRef } from 'react';
import { bindMenu, bindTrigger, type PopupState as PopupStateInjected } from 'material-ui-popup-state/hooks';
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
  /**
   * Notifies the parent whenever the menu opens or closes, so it can react to the popup
   * taking over the trigger (e.g. hiding a tooltip anchored to the trigger).
   */
  onOpenChange?: (open: boolean) => void;
  slotProps?: Partial<{
    container: BoxProps;
    popover: Partial<PopoverProps>;
    menuItem: MenuItemProps;
    menuIcon: ListItemIconProps;
    menuItemText: ListItemTextProps;
  }>;
}

interface DropdownPopupProps {
  popupState: PopupStateInjected;
  child: React.ReactElement;
  items: IDropdownMenuItem[];
  trigger: DropdownProps['trigger'];
  slotProps: NonNullable<DropdownProps['slotProps']>;
  onOpenChange?: DropdownProps['onOpenChange'];
}

function DropdownPopup({ popupState, child, items, trigger, slotProps, onOpenChange }: DropdownPopupProps) {
  const { isOpen } = popupState;
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (wasOpen.current === isOpen) return;
    wasOpen.current = isOpen;
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const { onClick, onTouchStart } = bindTrigger(popupState);

  return (
    <>
      {React.cloneElement(child, {
        // @ts-expect-error
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          onClick(e);
          // @ts-expect-error
          child.props.onClick?.(e);
        },
        onMouseEnter:
          trigger === 'hover'
            ? (e: React.MouseEvent<HTMLElement>) => {
                onClick(e);
                // @ts-expect-error
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
}

function Dropdown(props: DropdownProps) {
  const { items, slotProps = {}, variant = 'popover', trigger, onOpenChange } = props;

  const popupId = useId();

  const child = React.Children.only(props.children) as React.ReactElement;

  return (
    <PopupState variant={variant} popupId={popupId}>
      {(popupState) => (
        <DropdownPopup
          popupState={popupState}
          child={child}
          items={items}
          trigger={trigger}
          slotProps={slotProps}
          onOpenChange={onOpenChange}
        />
      )}
    </PopupState>
  );
}

export default Dropdown;
