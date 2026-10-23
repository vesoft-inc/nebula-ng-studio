import { Box, Chip, Popover, ClickAwayListener, ChipProps, BoxProps } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { bindPopover, bindTrigger } from 'material-ui-popup-state/hooks';
import PopupState from 'material-ui-popup-state';

import { EmptyIcon } from './iconCfg';
import PopoverContent from './PopoverContent';
import type { GraphWorkspaceStore } from '../../stores/workspace';

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
  allowRemoteIconManagement?: boolean;
}

const sizeMap = {
  small: 18,
  medium: 24,
  large: 32,
};

export type StyleSetBtnAction = {
  openPopup: () => void;
};

const getChipSx = (index: number) => {
  const cls: BoxProps['sx'] = {
    width: 20,
    height: 20,
    borderRadius: '50%',
  };
  if (index === 1) {
    cls.position = 'absolute';
    cls.left = 5;
    cls.zIndex = 2;
  }
  if (index === 2) {
    cls.position = 'absolute';
    cls.left = 10;
    cls.zIndex = 1;
  }
  return cls;
};

const StyleSetBtn = (props: IProps) => {
  const {
    title,
    disabled,
    customIcon,
    currentImage,
    colorList,
    size = 'medium',
    popupId,
    chipProps,
    explorerItem,
    allowRemoteIconManagement,
  } = props;

  const { imagesCache } = explorerItem.graph;

  const currentSize = sizeMap[size];

  if (disabled) {
    return (
      <>
        <Box display="flex" alignItems="center">
          {colorList
            .filter(Boolean)
            .slice(0, 3)
            .map((color, index) => (
              <Chip
                component="span"
                sx={{
                  backgroundColor: color,
                  zIndex: 3,
                  mr: 1,
                  ...getChipSx(index),
                }}
                key={index}
              />
            ))}
        </Box>
        {title && <Box component="span">{title}</Box>}
      </>
    );
  }

  const bash64Icon = customIcon !== EmptyIcon ? (imagesCache.get(customIcon!) as HTMLImageElement)?.src : undefined;

  return (
    <Box display="flex" alignItems="center">
      <PopupState variant="popper" popupId={popupId}>
        {(popupState) => {
          const trigger = bindTrigger(popupState);
          return (
            <Box display="inline-flex" width="100%" alignItems="center" position="relative">
              <Box {...trigger} display="inline-flex" position="relative">
                {colorList
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((color, index) => (
                    <Chip
                      component="span"
                      key={index}
                      className="color-picker-item"
                      sx={{
                        backgroundColor: color,
                        zIndex: 3,
                        mr: 1,
                        ...getChipSx(index),
                        border: (theme) =>
                          popupState.isOpen ? `2px dashed ${theme.palette.vesoft.v2.primary3}` : undefined,
                        backgroundImage: currentImage
                          ? `url(${currentImage.src})`
                          : !!bash64Icon
                            ? `url(${bash64Icon})`
                            : undefined,
                        backgroundSize: currentImage ? 'contain' : undefined,
                        '&:hover': {
                          cursor: 'pointer',
                          backgroundColor: color,
                          border: (theme) => `2px dashed ${theme.palette.vesoft.v2.primary3}`,
                        },
                        ...chipProps,
                      }}
                    />
                  ))}
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
                // disablePortal
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
                    <PopoverContent
                      entityType={title!}
                      currentColor={colorList[0]}
                      explorerItem={explorerItem}
                      allowRemoteIconManagement={allowRemoteIconManagement}
                    />
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

export default observer(StyleSetBtn);
