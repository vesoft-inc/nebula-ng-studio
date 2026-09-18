import { observer } from 'mobx-react-lite';
import { List, MenuItem } from '@mui/material';
import { Delete, EditOutlined, EyeOff, GraphExpand, SwapHorizontal } from '@vesoft-inc/icons';

import { IContextMenuItem } from '@studio/interfaces/explorer';
import { useTranslation } from 'react-i18next';
import NodeStylesSetBtn from '@studio/components/GraphWorkbench/NodeStylesSetBtn';
import { TooltipContainer } from '@studio/components/GraphWorkbench/GraphTooltip/styles';
import { EdgeDirectionType } from '@vesoft-inc/utils';
import { useMemo } from 'react';
import EdgeStyleSetBtn from '@studio/components/GraphWorkbench/EdgeStyleSetBtn';
import { ALL_EDGE_TYPE_KEY } from '@studio/utils/explorer/constant';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';
import { MenuItemIcon, MenuItemText } from './styles';

function Menu({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const { graph } = explorerItem;
  const { nodesSelected, selectedNodeIds, linksSelected, selectedLinkIds, setSelectedNodeIds, closeContextMenu } =
    graph;
  const { left: x, top: y, showContextMenu } = graph.pointer;
  const { t } = useTranslation(['explorer']);
  const hasNodeSelected = nodesSelected.size > 0;
  const hasLinkSelected = linksSelected.size > 0;
  const getColorList = (type: 'node' | 'edge'): string[] => {
    const colorList = new Set<string>();
    if (type === 'node') {
      nodesSelected.forEach((node) => {
        colorList.add(node.color! as string);
      });
    } else if (type === 'edge') {
      linksSelected.forEach((link) => {
        colorList.add(link.color! as string);
      });
    }
    return Array.from(colorList);
  };

  const getMenuItems = (): IContextMenuItem[] => {
    let menuItems: IContextMenuItem[] = [];
    let selectedIds: string[] = [];

    if (hasNodeSelected) {
      selectedIds = selectedIds.concat(selectedNodeIds);
      menuItems = menuItems.concat([
        {
          title: t('findNeighbors', { ns: 'explorer' }),
          icon: <GraphExpand />,
          key: 'findNeighbors',
          disabled: nodesSelected.size === 0,
          onClick: async () => {
            await graph.queryRelation(ALL_EDGE_TYPE_KEY, EdgeDirectionType.AnyDirection, 1);
            closeContextMenu();
          },
        },
        {
          title: (
            <NodeStylesSetBtn
              explorerItem={explorerItem}
              size="small"
              colorList={getColorList('node')}
              popupId="context-node-color-picker"
              allowRemoteIconManagement
              chipProps={{
                mx: 1,
              }}
              title={t('style', { ns: 'explorer' })}
            />
          ),
          key: 'style',
          onClick: () => {},
        },
        {
          title: t('invertSelection', { ns: 'explorer' }),
          key: 'invertSelection',
          icon: <SwapHorizontal />,
          disabled: nodesSelected.size === 0,
          onClick: () => {
            const _selectedIds: string[] = [];
            graph.nodes.forEach((vertex) => {
              const id = vertex.id!;
              if (!selectedNodeIds.includes(id)) {
                _selectedIds.push(id);
              }
            });
            setSelectedNodeIds(_selectedIds);
            closeContextMenu();
          },
        },
      ]);
    }
    if (!hasNodeSelected && hasLinkSelected) {
      selectedIds = selectedIds.concat(selectedLinkIds);
      menuItems.push({
        title: (
          <EdgeStyleSetBtn
            explorerItem={explorerItem}
            size="small"
            colorList={getColorList('edge')}
            popupId="context-node-color-picker"
            chipProps={{
              mx: 1,
            }}
            title={t('style', { ns: 'explorer' })}
          />
        ),
        key: 'style',
        onClick: () => {},
      });
    }
    // 所有选中的点都是置灰状态，则暂时 取消置灰
    if (selectedIds.every((id) => graph.vertexFilterStore.entityIdsGreyScaledSet.has(id))) {
      menuItems.push({
        title: t('cancelDismiss', { ns: 'explorer' }),
        key: 'cancelDismiss',
        icon: <EyeOff />,
        onClick: () => {
          selectedIds.forEach((id) => {
            graph.vertexFilterStore.entityIdsGreyScaledSet.delete(id);
          });
          graph.nodesSelected.clear();
          graph.linksSelected.clear();
          closeContextMenu();
        },
      });
    } else {
      menuItems.push({
        title: t('dismiss', { ns: 'explorer' }),
        key: 'dismiss',
        icon: <EyeOff />,
        onClick: () => {
          selectedIds.forEach((id) => {
            graph.vertexFilterStore.entityIdsGreyScaledSet.add(id);
          });
          graph.nodesSelected.clear();
          graph.linksSelected.clear();
          closeContextMenu();
        },
      });
    }
    if (explorerItem.graphEdit.editMode) {
      const entities: (NodeObject | LinkObject)[] = [...Array.from(nodesSelected), ...Array.from(linksSelected)];
      if (entities.length) {
        menuItems = [
          {
            title: t('editProperties', { ns: 'explorer' }),
            key: 'editProperties',
            icon: <EditOutlined />,
            disabled: entities.length !== 1,
            onClick: () => {
              explorerItem.graphEdit.openEditEntity(entities[0]);
              closeContextMenu();
            },
          },
          {
            title: t('delete', { ns: 'explorer' }),
            key: 'deleteEntity',
            icon: <Delete />,
            onClick: () => {
              explorerItem.graphEdit.openDeleteConfirm(entities);
              closeContextMenu();
            },
          },
          ...menuItems,
        ];
      }
    }
    return menuItems;
  };

  const menuItems = useMemo(() => getMenuItems(), [showContextMenu]);
  const containerWidth = 236;
  const containerHeight = menuItems.length * 32; // size is fixed in css
  const style = { left: 0, top: 0, display: 'block' };
  style.left = x > window.innerWidth - 50 - containerWidth ? x - containerWidth : x;
  style.top = containerHeight - y > 0 ? y - containerHeight : y;
  return (
    <TooltipContainer
      sx={{
        width: containerWidth,
        minHeight: containerHeight,
        padding: 0,
        transition: 'all 0.1ms ease-in',
      }}
      style={{
        ...style,
        display: showContextMenu ? 'block' : 'none',
      }}
    >
      <List component="nav">
        {menuItems.map((item) => (
          <MenuItem sx={{ px: 0.5 }} key={item.key} onClick={item.onClick}>
            {item.icon && <MenuItemIcon>{item.icon}</MenuItemIcon>}
            <MenuItemText>{item.title}</MenuItemText>
          </MenuItem>
        ))}
      </List>
    </TooltipContainer>
  );
}

const observedMenu = observer(Menu);

export default observedMenu;
