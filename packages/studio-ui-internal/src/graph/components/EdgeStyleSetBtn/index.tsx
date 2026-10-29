import { Box, Popover, ClickAwayListener, ChipProps } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { bindPopover, bindTrigger } from 'material-ui-popup-state/hooks';
import PopupState from 'material-ui-popup-state';

import PopoverContent from './PopoverContent';
import { Minus } from '@vesoft-inc/icons';
import { GraphWorkspaceStore } from '../../stores/workspace';

interface IProps {
  title?: string;
  currentImage?: HTMLImageElement;
  disabled?: boolean;
  customIcon?: string | null;
  colorList: string[];
  mode?: string;
  size?: 'small' | 'medium' | 'large';
  popupId: string;
  chipProps?: ChipProps['sx'];
  explorerItem: GraphWorkspaceStore;
}

const sizeMap = {
  small: 18,
  medium: 24,
  large: 32,
};

export type StyleSetBtnAction = {
  openPopup: () => void;
};

const EdgeStyleSetBtn = (props: IProps) => {
  const { title, disabled, colorList, size = 'medium', popupId, explorerItem } = props;

  const currentSize = sizeMap[size];

  if (disabled) {
    return (
      <>
        <Box display="flex" alignItems="center">
          {colorList
            .filter(Boolean)
            .slice(0, 3)
            .map((color, index) => (
              <Minus
                key={index}
                sx={{
                  width: 24,
                  height: 24,
                  mr: 1,
                  color,
                }}
              />
            ))}
        </Box>
        {title && <Box component="span">{title}</Box>}
      </>
    );
  }

  return (
    <Box display="flex" alignItems="center">
      <PopupState variant="popper" popupId={popupId}>
        {(popupState) => {
          const trigger = bindTrigger(popupState);
          return (
            <Box display="inline-flex" width="100%" alignItems="center" position="relative">
              <Box {...trigger} display="inline-flex" position="relative">
                <Minus
                  sx={{
                    width: 36,
                    height: 24,
                    color: (theme) => theme.palette.vesoft.v2.text3,
                  }}
                />
              </Box>
              {title && (
                <Box
                  component="span"
                  fontWeight={500}
                  color={(theme) => theme.palette.vesoft.textColor2}
                  title={title}
                  sx={{
                    maxWidth: '220px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    display: 'inline-block',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {title}
                </Box>
              )}
              <Popover
                {...bindPopover(popupState)}
                anchorOrigin={{
                  vertical: -4,
                  horizontal: -currentSize,
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                onClose={(e: MouseEvent | TouchEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  popupState.close();
                }}
              >
                <ClickAwayListener onClickAway={() => popupState.close()}>
                  <Box>
                    <PopoverContent entityType={title!} currentColor={colorList[0]} explorerItem={explorerItem} />
                  </Box>
                </ClickAwayListener>
              </Popover>
            </Box>
          );
        }}
      </PopupState>
    </Box>
  );
};

export default observer(EdgeStyleSetBtn);
