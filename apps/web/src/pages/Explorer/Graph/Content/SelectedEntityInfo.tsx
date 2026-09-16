import { observer } from 'mobx-react-lite';
import { Box, Button, ButtonGroup, Chip, Collapse, List, ListItemButton, Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';
import { ChevronRightFilled, Minus, TrayArrowUp } from '@vesoft-inc/icons';
import { GraphEntityType } from '@vesoft-inc/utils';
import { GroupButton } from '@vesoft-inc/ui-components';
import CollapseItem from '@studio/components/GraphWorkbench/Collapse';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import Empty from '@studio/components/GraphWorkbench/Empty';
import { debounce } from 'lodash';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

const popoverId = 'selected-entity-info-popover';

const SelectedEntityInfo = observer(({ explorerItem }: { explorerItem: GraphWorkspaceStore }) => {
  const { t } = useTranslation(['explorer']);
  const { graph, nodeTypePrimaryKeysMap } = explorerItem;
  const {
    nodesSelected,
    linksSelected,
    selectedNodesTypeCountMap,
    selectedEdgesTypeCountMap,
    downloadSelectedEntityAsCsv,
  } = graph;
  const [curTab, setCurTab] = useState<GraphEntityType>(GraphEntityType.Node);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const open = Boolean(anchorEl);

  const FunctionTabs = [
    {
      name: t('nodeType', { ns: 'explorer' }),
      type: GraphEntityType.Node,
    },
    {
      name: t('edgeType', { ns: 'explorer' }),
      type: GraphEntityType.Edge,
    },
  ];

  const renderEntityLabel = (entityType: string) => {
    if (curTab === GraphEntityType.Node) {
      return (
        <Chip
          sx={{
            height: 20,
            width: 20,
            borderRadius: '50%',
            backgroundColor: graph.nodeColorPicker.whichColor(entityType),
          }}
          size="small"
        />
      );
    }
    return <Minus />;
  };

  const renderTitle = (entityType: string) => {
    return (
      <Box width="100%" display="flex" alignItems="center" justifyContent="space-between">
        <>
          {renderEntityLabel(entityType)}
          <Box
            component="span"
            sx={{
              color: (theme) => theme.palette.vesoft.v2.text2,
              ml: 1,
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {entityType}
          </Box>
        </>
      </Box>
    );
  };

  const handleHover = (entity?: NodeObject | LinkObject) => () => {
    if (curTab === GraphEntityType.Node) {
      graph.setHoveringNode(entity as NodeObject);
    } else {
      graph.setHoveringLink(entity as LinkObject);
    }
  };

  const renderContent = () => {
    const countMap = curTab === GraphEntityType.Node ? selectedNodesTypeCountMap : selectedEdgesTypeCountMap;
    const types = Array.from(countMap.keys());
    if (types.length === 0) {
      return (
        <Box width="100%" height="100%" display="flex" alignItems="center" mt="25%" justifyContent="center">
          <Empty
            sx={{
              width: '50%',
              height: '50%',
              backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
            }}
          />
        </Box>
      );
    }
    return types.map((itemType, index) => {
      const mapItem =
        curTab === GraphEntityType.Node
          ? selectedNodesTypeCountMap.get(itemType)!
          : selectedEdgesTypeCountMap.get(itemType)!;
      return (
        <Box
          key={index}
          sx={{
            border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
            borderRadius: '6px',
            mb: 1,
          }}
        >
          <CollapseItem
            slotProps={{
              subItemSx: {
                pl: 1,
                pr: 2,
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                backgroundColor: (theme) => theme.palette.vesoft.v2.bg6,
              },
            }}
            onlyIconToggle={false}
            title={renderTitle(itemType)}
            rightPart={<>{mapItem.count}</>}
          >
            <List sx={{ pt: 0.5, width: '100%', maxHeight: 200, overflowY: 'auto' }}>
              {mapItem.items.map((entity, index) => (
                <ListItemButton
                  key={index}
                  sx={{
                    py: 0.5,
                  }}
                  onMouseOver={debounce(handleHover(entity), 100)}
                  onMouseLeave={debounce(handleHover(), 100)}
                >
                  <Box
                    sx={{
                      width: '100%',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {curTab === GraphEntityType.Node
                      ? nodeTypePrimaryKeysMap
                          ?.get(entity.data.value.type)
                          ?.map((key) => entity.data.value.properties[key])
                          .join(' ')
                      : entity.id}
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </CollapseItem>
        </Box>
      );
    });
  };

  return (
    <>
      <Button
        aria-describedby={popoverId}
        onClick={handleClick}
        ref={btnRef}
        sx={{
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
          border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
          borderRadius: '6px',
          minWidth: 364,
          height: 32,
          position: 'absolute',
          bottom: 24,
          left: 24,
          justifyContent: 'space-between',
          color: (theme) => theme.palette.vesoft.v2.text2,
          fontSize: 14,
          px: 1.5,
          '&:hover': {
            cursor: 'pointer',
            backgroundColor: (theme) => theme.palette.vesoft.v2.bg2,
          },
        }}
      >
        <Box display="flex" alignItems="center">
          <Box>
            {t('seletedNodes', { ns: 'explorer' })}
            <Box component="span" ml={1}>
              {nodesSelected.size}
            </Box>
          </Box>
          <Box ml={3}>
            {t('seletedEdges', { ns: 'explorer' })}
            <Box component="span" ml={1}>
              {linksSelected.size}
            </Box>
          </Box>
        </Box>
        <ChevronRightFilled fontSize="medium" />
      </Button>
      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: -374,
          horizontal: 'left',
        }}
        container={graph.graphContainer}
        TransitionComponent={Collapse}
      >
        <Box
          sx={{
            width: btnRef.current?.clientWidth || 320,
            height: 364,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box p={2} pb={0}>
            <ButtonGroup fullWidth size="small">
              {FunctionTabs.map((tab) => (
                <GroupButton
                  key={tab.type}
                  active={curTab === tab.type}
                  onClick={() => setCurTab(tab.type)}
                  variant={curTab === tab.type ? 'contained' : 'outlined'}
                >
                  {tab.name}
                </GroupButton>
              ))}
            </ButtonGroup>
          </Box>
          <Box flex={1} p={2} height="clac(100% - 148px)" sx={{ overflowY: 'auto' }}>
            {renderContent()}
          </Box>
          <Box
            display="flex"
            width="100%"
            justifyContent="center"
            borderTop={(theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`}
            p={1.5}
          >
            <Button
              variant="outlined"
              size="small"
              fullWidth
              onClick={downloadSelectedEntityAsCsv}
              startIcon={<TrayArrowUp fontSize="medium" />}
            >
              {t('exportAsCsv', { ns: 'explorer' })}
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
});

export default SelectedEntityInfo;
