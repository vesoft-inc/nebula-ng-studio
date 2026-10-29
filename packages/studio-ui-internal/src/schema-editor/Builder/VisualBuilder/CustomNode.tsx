import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { alpha, Box, useTheme } from '@mui/material';
import { INodeTypeItem } from '../../../schema/types';

export const NODE_SIZE = 60;

interface CustomNodeData extends Record<string, unknown> {
  nodeTypeItem: INodeTypeItem;
  isActive: boolean;
  isReadonly: boolean;
}

interface BidirectionalHandleProps {
  position: Position;
  id: string;
  isReadonly: boolean;
}

function BidirectionalHandle({ position, id, isReadonly }: BidirectionalHandleProps) {
  const theme = useTheme();
  return (
    <>
      <Handle
        type="source"
        position={position}
        id={id}
        className="custom-node-handle"
        style={{
          width: 8,
          height: 8,
          backgroundColor: alpha(theme.palette.vesoft.v2.text1, 0.6),
          border: `2px solid ${alpha(theme.palette.vesoft.v2.bg1, 0.8)}`,
          cursor: isReadonly ? 'default' : 'crosshair',
          pointerEvents: 'all',
          transition: 'opacity 0.2s',
        }}
        isConnectable={!isReadonly}
      />
      <Handle
        type="target"
        position={position}
        id={id}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: 'all',
        }}
        isConnectable={!isReadonly}
      />
    </>
  );
}

function CustomNode({ data }: NodeProps) {
  const theme = useTheme();
  const { nodeTypeItem, isActive, isReadonly } = data as CustomNodeData;
  const style = nodeTypeItem.style || {};

  const strokeColor = style.strokeColor || theme.palette.vesoft.v2.text1;
  const shadow = style.shadow || theme.palette.vesoft.v2.text1;

  return (
    <>
      <Box
        className="custom-node"
        sx={{
          position: 'relative',
          boxSizing: 'border-box',
          width: NODE_SIZE,
          height: NODE_SIZE,
          borderRadius: '50%',
          backgroundColor: theme.palette.vesoft.v2.bg1,
          border: `2px solid ${alpha(strokeColor, 1)}`,
          boxShadow: isActive
            ? `0 0 24px 8px ${alpha(theme.palette.vesoft.v2.divider2, 0.5)}, 0 2px 8px ${shadow}`
            : `none`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isReadonly ? 'default' : 'grab',
          transition: 'all 0.2s',
          pointerEvents: 'all',
          '&:active': {
            cursor: isReadonly ? 'default' : 'grabbing',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: alpha(strokeColor, 0.2),
          }}
        />
        <Box
          sx={{
            fontSize: '12px',
            fontWeight: isActive ? 700 : 400,
            color: theme.palette.vesoft.v2.text1,
            textAlign: 'center',
            maxWidth: '48px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {nodeTypeItem.name || '[Node Name]'}
        </Box>
        {/* Handles that work as both source and target */}
        <BidirectionalHandle position={Position.Top} id="top" isReadonly={isReadonly} />
        <BidirectionalHandle position={Position.Right} id="right" isReadonly={isReadonly} />
        <BidirectionalHandle position={Position.Bottom} id="bottom" isReadonly={isReadonly} />
        <BidirectionalHandle position={Position.Left} id="left" isReadonly={isReadonly} />
      </Box>
    </>
  );
}

export default memo(CustomNode);
