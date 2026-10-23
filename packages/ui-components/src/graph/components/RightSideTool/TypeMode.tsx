import { observer } from 'mobx-react-lite';
import { GraphEntityType } from '@vesoft-inc/utils';
import { List } from '@mui/material';

import { useState } from 'react';
import { EdgeValue, VertexValue } from '../../types/gql';
import TypeItem, { type EntityTypeItem } from './TypeItem';
import type { GraphWorkspaceStore } from '../../stores/workspace';

function TypeMode({
  entityType,
  explorerItem,
  allowRemoteIconManagement,
}: {
  entityType: GraphEntityType | 'all';
  explorerItem: GraphWorkspaceStore;
  allowRemoteIconManagement?: boolean;
}) {
  const { graph } = explorerItem;
  const [selectedItem, setSelectedItem] = useState<EntityTypeItem>();
  const entityInfo = new Map<string, EntityTypeItem>();
  if (entityType === 'all' || entityType === GraphEntityType.Node) {
    graph.nodes.forEach((node) => {
      const typeName = (node.data as VertexValue).value.type;
      const current = entityInfo.get(typeName);
      if (current) {
        current.count++;
      } else {
        entityInfo.set(typeName, {
          typeName,
          type: GraphEntityType.Node,
          count: 1,
          color: node.color as string,
        });
      }
    });
  }
  if (entityType === 'all' || entityType === GraphEntityType.Edge) {
    graph.links.forEach((link) => {
      const typeName = (link.data as EdgeValue).value.type;
      const current = entityInfo.get(typeName);
      if (current) {
        current.count++;
      } else {
        entityInfo.set(typeName, {
          typeName,
          type: GraphEntityType.Edge,
          count: 1,
          color: link.color as string,
        });
      }
    });
  }

  const handleItemClick = (item: EntityTypeItem) => (e: React.SyntheticEvent<HTMLDivElement>) => {
    const isColorPickerClick = (e.target as HTMLElement).classList.contains('color-picker-item');
    const isCurrentlySelected = selectedItem?.typeName === item.typeName && selectedItem.type === item.type;

    const handleNodeSelection = (select: boolean) => {
      if (item.type === GraphEntityType.Node) {
        select ? graph.setSelectedNodesByType(item.typeName) : graph.setUnSelectedNodesByType(item.typeName);
      }
    };

    const handleEdgeSelection = (select: boolean) => {
      if (item.type === GraphEntityType.Edge) {
        select ? graph.setSelectedEdgesByType(item.typeName) : graph.setUnSelectedEdgesByType(item.typeName);
      }
    };

    if (isColorPickerClick) {
      setSelectedItem(item);
      handleNodeSelection(true);
      handleEdgeSelection(true);
    } else if (isCurrentlySelected) {
      setSelectedItem(undefined);
      handleNodeSelection(false);
      handleEdgeSelection(false);
    } else {
      setSelectedItem(item);
      handleNodeSelection(true);
      handleEdgeSelection(true);
    }
  };

  return (
    <List sx={{ width: '100%', overflowY: 'auto', paddingTop: 0 }} component="nav">
      {Array.from(entityInfo).map(([entityName, item], index) => (
        <TypeItem
          key={index}
          name={entityName}
          item={item}
          selected={selectedItem?.typeName === entityName}
          onClick={handleItemClick(item)}
          explorerItem={explorerItem}
          allowRemoteIconManagement={allowRemoteIconManagement}
        />
      ))}
    </List>
  );
}

export default observer(TypeMode);
