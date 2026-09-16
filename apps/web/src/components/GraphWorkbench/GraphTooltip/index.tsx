import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { onPointerMove } from '@studio/utils/graph/helpers';
import { removeNullCharacters } from '@studio/utils/graph/helpers';
import { EdgeValue, VertexValue } from '@studio/interfaces/explorer';
import { Box, Typography } from '@mui/material';
import EntityTypeLabel from '@studio/components/GraphWorkbench/EntityTypeLabel';
import { PropertyBox, TooltipContainer } from './styles';
import EntityLabelList from '../EntityLabelList';
import { KeyVariant } from '@vesoft-inc/icons';
import { debounce, throttle } from 'lodash';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

const NodeTooltip = observer(
  ({ node, style, primaryKeys }: { node?: NodeObject; style: React.CSSProperties; primaryKeys: string[] }) => {
    if (!node) {
      return null;
    }
    const data = node.data as VertexValue;
    const { properties } = data.value;
    const propertyElement = Object.keys(properties)
      .sort((a, b) => {
        if (primaryKeys?.includes(a) && !primaryKeys?.includes(b)) {
          return -1;
        }
        if (!primaryKeys?.includes(a) && primaryKeys?.includes(b)) {
          return 1;
        }
        return a.localeCompare(b);
      })
      .reduce((ret, propertyKey) => {
        const valueObj = properties[propertyKey]!;
        const key = `${propertyKey}`;
        const isPrimaryKey = primaryKeys?.includes(propertyKey);
        ret.push(
          <PropertyBox key={key} mt={0.5}>
            <Box display="flex" alignItems="flex-start" flexWrap="wrap" sx={{ maxWidth: '280px', gap: 0.5 }}>
              <Typography
                component="span"
                fontSize={12}
                sx={{
                  fontWeight: isPrimaryKey ? 'bold' : 'normal',
                  whiteSpace: 'wrap',
                  wordBreak: 'break-all',
                  color: (theme) => theme.palette.vesoft.v2.text3,
                }}
              >{`${key}: `}</Typography>
              <Typography
                fontSize={12}
                sx={{
                  fontWeight: isPrimaryKey ? 'bold' : 'normal',
                  whiteSpace: 'wrap',
                  wordBreak: 'break-all',
                  color: (theme) => theme.palette.vesoft.v2.text1,
                }}
              >
                {JSON.stringify(valueObj, (_, v) => (typeof v === 'string' ? removeNullCharacters(v) : v))}
              </Typography>
            </Box>
            {isPrimaryKey && (
              <KeyVariant
                fontSize="small"
                sx={{
                  ml: 1,
                  color: (theme) => theme.palette.vesoft.v2.text3,
                  fontSize: 14,
                }}
              />
            )}
          </PropertyBox>
        );
        return ret;
      }, [] as React.JSX.Element[]);

    return (
      <TooltipContainer sx={style}>
        <EntityTypeLabel item={node} />
        <Box display="flex" alignItems="center" flexWrap={'wrap'} mt={1}>
          <EntityLabelList mb={1} labels={node.data.value.labels} />
        </Box>
        {propertyElement}
      </TooltipContainer>
    );
  }
);

const LinkTooltip = observer(({ link, style }: { link?: LinkObject; style: React.CSSProperties }) => {
  if (!link) {
    return null;
  }
  const data = link.data as EdgeValue;
  const { properties } = data.value;
  const propertyElement = Object.keys(properties).map((property) => (
    <PropertyBox key={property?.toString()} mt={0.5}>
      <Box display="flex" alignItems="flex-start" flexWrap="wrap" sx={{ maxWidth: '280px', gap: 0.5 }}>
        <Typography
          component="span"
          fontSize={12}
          sx={{
            whiteSpace: 'wrap',
            wordBreak: 'break-all',
            color: (theme) => theme.palette.vesoft.v2.text3,
          }}
        >
          {`${property}: `}
        </Typography>
        <Typography
          fontSize={12}
          ml={1}
          sx={{
            whiteSpace: 'wrap',
            wordBreak: 'break-all',
            color: (theme) => theme.palette.vesoft.v2.text1,
          }}
        >
          {properties[property]?.toString()}
        </Typography>
      </Box>
    </PropertyBox>
  ));

  return (
    <TooltipContainer sx={style}>
      <EntityTypeLabel item={link} />
      <Box display="flex" alignItems="center" flexWrap={'wrap'} mt={1}>
        <EntityLabelList mb={1} labels={link.data.value.labels} />
      </Box>
      {propertyElement}
    </TooltipContainer>
  );
});

const Tooltip = observer(function Tooltip({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { nodeHovering, linkHovering, pointer } = explorerItem.graph;
  const { showContextMenu } = pointer;
  const [visible, setVisible] = useState<'node' | 'link' | 'none'>('none');
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: pointer.top,
    left: pointer.left,
  });
  const getVisible = () => {
    if (showContextMenu) {
      return 'none';
    }
    const res = nodeHovering ? 'node' : linkHovering ? 'link' : 'none';
    return res;
  };

  useEffect(
    debounce(() => {
      setVisible(getVisible());
    }, 100),
    [nodeHovering, linkHovering, showContextMenu]
  );

  useEffect(
    debounce(() => {
      setPosition({ top: pointer.top, left: pointer.left });
    }, 200),
    [pointer]
  );

  return (
    <>
      <NodeTooltip
        node={nodeHovering}
        style={{ ...position, display: visible === 'node' ? 'block' : 'none' }}
        primaryKeys={
          (nodeHovering?.data.value.type && explorerItem.nodeTypePrimaryKeysMap.get(nodeHovering?.data.value.type)) ||
          []
        }
      />
      <LinkTooltip link={linkHovering} style={{ ...position, display: visible === 'link' ? 'block' : 'none' }} />
    </>
  );
});

export default Tooltip;

export function initTooltip({
  container,
  explorerItem,
}: {
  container: HTMLElement;
  explorerItem: GraphWorkspaceStore;
}) {
  const { graph } = explorerItem;
  const { setPointer } = graph!;
  const disposer = onPointerMove(container, throttle(setPointer, 100));
  return () => {
    disposer();
  };
}
