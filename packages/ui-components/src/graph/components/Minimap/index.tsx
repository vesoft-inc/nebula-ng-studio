import { ComponentProps, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClickAwayListener, List, ListItemButton, ListItemText, Popover, useTheme } from '@mui/material';
import PopupState, { bindPopover, bindTrigger } from 'material-ui-popup-state';
import Box from '@mui/material/Box';
import Button, { type ButtonProps } from '@mui/material/Button';
import {
  AddFilled,
  Minus,
  MonitorDashboard,
  Fullscreen,
  GraphView,
  FullscreenExit,
  TreeView,
  SphereView,
  GridView,
  RadialView,
  NeuralNetworkView,
  TreeHorizontalView,
  CommunityDiscovery,
} from '@vesoft-inc/icons';
import { ActionGroup, MinimapBox, MinimapContainer, MinimapDragBox, MinimapDragPoint } from './styles';
import { ITransform } from '../../types/explorer';
import { GraphLayoutType } from '../../constants';
import { useTranslation } from 'react-i18next';
import type { GraphWorkspaceStore } from '../../stores/workspace';

interface IBox {
  left: number;
  top: number;
  width: number;
  height: number;
  ratio: number;
}

export const ActionButton = ({ children, sx, ...props }: PropsWithChildren<ButtonProps>) => {
  const theme = useTheme();
  const defaultSx = {
    width: '24px',
    height: '24px',
    minWidth: 'unset',
    padding: 0,
    color: theme.palette.vesoft.v2.text2,
    backgroundColor: theme.palette.vesoft.background.paper,
    '&:hover': {
      backgroundColor: theme.palette.vesoft.v2.bg1,
    },
    borderColor: theme.palette.vesoft.v2.divider1,
  };
  return (
    <Button variant="outlined" sx={Array.isArray(sx) ? [defaultSx, ...sx] : [defaultSx, sx]} {...props}>
      {children}
    </Button>
  );
};

const MinimapAreaBox = observer(function AreaBox({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graph: graphStore, minimap: minimapStore } = explorerItem;
  const handleRef = useRef({
    startEvent: undefined as undefined | React.MouseEvent,
    startTransform: undefined as undefined | ITransform,
    box: undefined as undefined | IBox,
    startPos: undefined as undefined | Pick<IBox, 'left' | 'top'>,
    type: undefined as undefined | 'move' | 'resize',
    startWidth: undefined as undefined | number,
  });
  const { twoGraph } = graphStore;
  const onBoxResizeStart = useCallback((e: React.MouseEvent) => {
    const { twoGraph } = graphStore;
    e.preventDefault();
    e.stopPropagation();
    handleRef.current.startEvent = e;
    handleRef.current.startTransform = { ...twoGraph!.transform };
    handleRef.current.startWidth = handleRef.current?.box?.width;
    handleRef.current.type = 'resize';
  }, []);

  const onBoxMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const { left, top } = handleRef.current.box!;
    handleRef.current.startEvent = e;
    handleRef.current.startPos = { left, top };
    handleRef.current.type = 'move';
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const { startEvent, startTransform, startPos, type, box, startWidth = 0 } = handleRef.current;
    if (!type) {
      return;
    }
    const twoGraph = graphStore.twoGraph!;
    const minimapStore = explorerItem.minimap!;
    const { width, height, top, left, ratio } = box!;
    if (type === 'move') {
      const startEvent = handleRef.current.startEvent!;
      const offsetX = e.clientX - startEvent.clientX;
      const offsetY = e.clientY - startEvent.clientY;

      const coords = minimapStore.graph?.screen2GraphCoords(
        startPos!.left + offsetX + width / 2,
        startPos!.top + offsetY + height / 2
      );
      twoGraph!.instance.centerAt(coords!.x, coords!.y);
      return;
    }
    const offsetX = e.clientX - startEvent!.clientX;
    const offsetWidth = offsetX + startWidth;
    const newZoom = (startWidth / offsetWidth) * startTransform!.k;

    twoGraph.instance.zoom(newZoom);
    // get left top point that the d3zoom can set viewport to it
    const offsetCoords = minimapStore.graph!.screen2GraphCoords(left + offsetWidth / 2, top + offsetWidth / ratio / 2);
    twoGraph.instance.centerAt(offsetCoords.x, offsetCoords.y);
  }, []);

  const onMouseUp = useCallback(() => {
    handleRef.current = {
      ...handleRef.current,
      startEvent: undefined,
      startTransform: undefined,
      type: undefined,
    };
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  if (!twoGraph) return null;
  const text = twoGraph && (twoGraph.instance.zoom() * 100).toFixed(0);
  const ratio = graphStore.rect.width / graphStore.rect.height;
  const zoomScale = twoGraph.transform.k / minimapStore.transform.k;
  const width = graphStore.rect.width / zoomScale;
  const height = width / ratio;
  const left =
    (twoGraph.transform.x - minimapStore.transform.x) * minimapStore.transform.k + minimapStore.width / 2 - width / 2;
  const top =
    (twoGraph.transform.y - minimapStore.transform.y) * minimapStore.transform.k + minimapStore.height / 2 - height / 2;

  // keep box info
  handleRef.current.box = { left, top, width, height, ratio };
  const style = Object.fromEntries(
    Object.entries(handleRef.current.box).map(([key, value]) => [key, isNaN(value) ? undefined : value])
  );

  return (
    <>
      <Box position="absolute" bottom={0} left="5px">
        {text}%
      </Box>
      <MinimapDragBox onMouseDown={onBoxMoveStart} style={style}>
        <MinimapDragPoint onMouseDown={onBoxResizeStart} />
      </MinimapDragBox>
    </>
  );
});

export const MinimapActionButtonGraphLayout = observer(function ({
  explorerItem,
}: {
  explorerItem: GraphWorkspaceStore;
}) {
  const { t } = useTranslation(['explorer']);

  const layoutList = useMemo(
    () => [
      {
        type: GraphLayoutType.Force,
        label: t('graphLayout.force', { ns: 'explorer' }),
        icon: <GraphView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Dagre,
        label: t('graphLayout.dagre', { ns: 'explorer' }),
        icon: <TreeView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.DagreLR,
        label: t('graphLayout.dagreLR', { ns: 'explorer' }),
        icon: <TreeHorizontalView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Circular,
        label: t('graphLayout.circular', { ns: 'explorer' }),
        icon: <SphereView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Grid,
        label: t('graphLayout.grid', { ns: 'explorer' }),
        icon: <GridView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Radial,
        label: t('graphLayout.radial', { ns: 'explorer' }),
        icon: <RadialView fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Concentric,
        label: t('graphLayout.concentric', { ns: 'explorer' }),
        icon: <CommunityDiscovery fontSize="medium" />,
      },
      {
        type: GraphLayoutType.Neural,
        label: t('graphLayout.neuralNetwork', { ns: 'explorer' }),
        icon: <NeuralNetworkView fontSize="medium" />,
      },
    ],
    [t]
  );

  return (
    <PopupState variant="popper" popupId="layout-selector">
      {(popupState) => (
        <>
          <ActionButton {...bindTrigger(popupState)}>
            <GraphView sx={{ width: '16px', height: '16px' }} />
          </ActionButton>
          <Popover
            {...bindPopover(popupState)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: -10,
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            onClose={(e: MouseEvent | TouchEvent) => {
              e.stopPropagation();
              e.preventDefault();
              popupState.close();
            }}
          >
            <ClickAwayListener onClickAway={() => popupState.close()}>
              <Box width={174} padding={0.5}>
                <List sx={{ py: 0 }}>
                  {layoutList.map((layout, index) => (
                    <ListItemButton
                      key={index}
                      sx={{ p: 0.5 }}
                      onClick={() => {
                        explorerItem.graph.setLayout(layout.type);
                        popupState.close();
                      }}
                    >
                      {layout.icon}
                      <ListItemText sx={{ ml: 1.5 }}>{layout.label}</ListItemText>
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            </ClickAwayListener>
          </Popover>
        </>
      )}
    </PopupState>
  );
});

export const MinimapActionButtonZoomIn = observer(function ({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graph } = explorerItem;
  return (
    <ActionButton onMouseDown={() => graph.twoGraph?.zoom('in')}>
      <AddFilled sx={{ width: '16px', height: '16px' }} />
    </ActionButton>
  );
});

export const MinimapActionButtonZoomOut = observer(function ({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graph } = explorerItem;
  return (
    <ActionButton onMouseDown={() => graph.twoGraph?.zoom('out')}>
      <Minus sx={{ width: '16px', height: '16px' }} />
    </ActionButton>
  );
});

export const MinimapActionButtonFullScreen = observer(function ({
  explorerItem,
}: {
  explorerItem: GraphWorkspaceStore;
}) {
  const isFullScreen = explorerItem.isFullScreen;

  const handleFullScreen = () => {
    explorerItem.setIsFullScreen(!isFullScreen);
    explorerItem.graph.resize();
  };

  return (
    <ActionButton onClick={handleFullScreen}>
      {isFullScreen ? (
        <FullscreenExit fontSize="medium" sx={{ width: '16px', height: '16px' }} />
      ) : (
        <Fullscreen fontSize="medium" sx={{ width: '16px', height: '16px' }} />
      )}
    </ActionButton>
  );
});

function MinimapActionGroup({ children, ...props }: PropsWithChildren<ComponentProps<typeof ActionGroup>>) {
  return (
    <ActionGroup
      {...props}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.8,
        ...props.sx,
      }}
    >
      {children}
    </ActionGroup>
  );
}

function Minimap({
  children,
  explorerItem,
}: {
  children: (arg0: { Wrapper: typeof MinimapActionGroup; minimapToggleButton: React.ReactNode }) => React.ReactNode;
  explorerItem: GraphWorkspaceStore;
}) {
  const minimapDomRef = useRef<HTMLElement | undefined>(undefined);
  const { minimap } = explorerItem;
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (!minimapDomRef.current || !isOpen) {
      return;
    }
    minimap.initGraph({ dom: minimapDomRef.current, width: 320, height: 240 });
    return () => minimap.destroy();
  }, [explorerItem.explorerId, isOpen]);

  const onCenter = useCallback(
    (event: React.MouseEvent) => {
      const {
        minimap,
        graph: { twoGraph },
      } = explorerItem;
      const offsetCoords = minimap.graph!.screen2GraphCoords(event.nativeEvent.offsetX, event.nativeEvent.offsetY);
      twoGraph?.instance.centerAt(offsetCoords.x, offsetCoords.y);
    },
    [explorerItem.explorerId]
  );

  return (
    <MinimapContainer>
      {isOpen && (
        <MinimapBox overflow="hidden">
          <Box
            ref={minimapDomRef}
            width="320px"
            height="240px"
            overflow="hidden"
            sx={{ transition: 'with 200ms' }}
            onClick={onCenter}
          />
          <MinimapAreaBox explorerItem={explorerItem} />
        </MinimapBox>
      )}
      {children({
        Wrapper: MinimapActionGroup,
        minimapToggleButton: (
          <ActionButton
            sx={{
              bgcolor: ({ palette }) => (isOpen ? palette.action.selected : undefined),
            }}
            onClick={() => setOpen((isOpen) => !isOpen)}
          >
            <MonitorDashboard sx={{ width: '16px', height: '16px' }} />
          </ActionButton>
        ),
      })}
    </MinimapContainer>
  );
}

const observedMinimap = observer(Minimap);

export default observedMinimap;
