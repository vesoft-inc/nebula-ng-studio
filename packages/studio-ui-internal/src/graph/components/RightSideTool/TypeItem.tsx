import EdgeStyleSetBtn from '../EdgeStyleSetBtn/index';
import NodeStylesSetBtn from '../NodeStylesSetBtn/index';
import type { GraphWorkspaceStore } from '../../stores/workspace';
import { Box, IconButton, Typography } from '@mui/material';
import { EyeOffOutline, RemoveRedeyeOutlined } from '@vesoft-inc/icons';
import { GraphEntityType } from '@vesoft-inc/studio-core/contracts';
import { observer } from 'mobx-react-lite';
import { SyntheticEvent, useState } from 'react';

export type EntityTypeItem = {
  type: GraphEntityType;
  count: number;
  color: string;
  typeName: string;
};

interface TypeItemProps {
  name: string;
  item: EntityTypeItem;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  selected?: boolean;
  explorerItem: GraphWorkspaceStore;
  allowRemoteIconManagement?: boolean;
}

function TypeItem(props: TypeItemProps) {
  const { name, item, onClick, selected = false, explorerItem, allowRemoteIconManagement } = props;
  const { graph } = explorerItem;
  const {
    vertexFilterStore: {
      nodeTypeGreyScaledSet,
      edgeTypeGreyScaledSet,
      nodeTypeGreyScaleAction,
      edgeTypeGreyScaleAction,
    },
  } = graph;
  const [isHover, setIsHover] = useState<boolean>(false);
  const isNodeType = item.type === GraphEntityType.Node;
  const isEdgeType = item.type === GraphEntityType.Edge;

  const getDefaultShow = () => {
    if (item.type === GraphEntityType.Node) {
      return !nodeTypeGreyScaledSet.has(item.typeName);
    }
    if (item.type === GraphEntityType.Edge) {
      return !edgeTypeGreyScaledSet.has(item.typeName);
    }
    return true;
  };

  const [show, setShow] = useState<boolean>(getDefaultShow());

  const handleToggleVisible = (visible: boolean) => (e: SyntheticEvent) => {
    e.stopPropagation();
    setShow(visible);
    if (visible) {
      setShow(true);
      isNodeType && nodeTypeGreyScaleAction(item.typeName, 'delete');
      isEdgeType && edgeTypeGreyScaleAction(item.typeName, 'delete');
    } else {
      setShow(false);
      isNodeType && nodeTypeGreyScaleAction(item.typeName, 'add');
      isEdgeType && edgeTypeGreyScaleAction(item.typeName, 'add');
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
          selected ? theme.palette.vesoft.v2.bg4 : theme.palette.vesoft.background.secondaryBar,
        padding: '4px 12px',
        '&:not(:last-child)': {
          marginBottom: 1,
        },
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg4,
        },
      }}
    >
      <Box display="flex" alignItems="center">
        {item.type === GraphEntityType.Node && (
          <NodeStylesSetBtn
            explorerItem={explorerItem}
            colorList={[item.color]}
            title={name}
            popupId="node-color-picker"
            allowRemoteIconManagement={allowRemoteIconManagement}
          />
        )}
        {item.type === GraphEntityType.Edge && (
          <EdgeStyleSetBtn
            explorerItem={explorerItem}
            colorList={[item.color]}
            title={name}
            popupId="edge-color-picker"
          />
        )}
      </Box>
      <Box mr={isHover || !show ? 1 : 2} display="flex" alignItems="center" justifyContent="center">
        {renderCount()}
      </Box>
    </Box>
  );
}

export default observer(TypeItem);
