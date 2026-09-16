import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { AddFilled } from '@vesoft-inc/icons';
import '@xyflow/react/dist/style.css';
import { Typography, useTheme } from '@mui/material';
import { Node, Edge } from '@xyflow/react';

import { GraphContainer, TagItem, fullScreenCls } from './styles';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem } from '@studio/interfaces';
import { ToolNodeColor } from '@vesoft-inc/utils';
import { VisualEditorType } from '@studio/utils/constant';
import { GraphCanvas } from './GraphCanvas';
import {
  activeItem,
  addNodeAtPosition,
  getPositionFromCanvas,
  isFullScreen,
  isReadonly,
  ReactFlowEdgeData,
  reactFlowInstance,
  ReactFlowNodeData,
  resetStore,
  setActiveItem,
  updateEdge,
  updateNode,
  updateNodePositions,
} from './store';
import { GraphCornerButtons } from './GraphCornerButtons';
import { useForceLayout } from './useForceLayout';
import { Drawer } from '@vesoft-inc/ui-components';
import { ConfigForm } from './ConfigForm';
import { observer } from 'mobx-react-lite';
import { useStore } from '@studio/stores';
import { updateNodes, updateEdges } from './store';

function VisualBuilder() {
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);

  const { graphtypeStore } = useStore();
  const { schemaStore, mode } = graphtypeStore;
  const graphTypeId = schemaStore?.graphtypeName;

  const readonly = isReadonly.get();
  useEffect(() => {
    isReadonly.set(mode === GraphTypeBuildMode.Readonly);
  }, [mode]);

  // Call fitView on route change
  useEffect(() => {
    reactFlowInstance.get()?.fitView();
  }, [graphTypeId, reactFlowInstance]);

  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reactFlowWrapper.current) {
      return;
    }
    const rect = reactFlowWrapper.current.getBoundingClientRect();
    setContainerDimensions({ width: rect.width, height: rect.height });
  }, []);

  // sync to store
  const nodeTypeList = schemaStore?.nodeTypeList.slice();
  const edgeTypeList = schemaStore?.edgeTypeList.slice();
  const [, startTransition] = useTransition();
  useEffect(() => {
    startTransition(() => {
      updateNodes(nodeTypeList || []);
      updateEdges(edgeTypeList || []);
    });
  }, [JSON.stringify(nodeTypeList), JSON.stringify(edgeTypeList)]);

  const {
    isRunning: isForceLayoutRunning,
    toggleSimulation,
    stopSimulation,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  } = useForceLayout({
    containerWidth: containerDimensions.width,
    containerHeight: containerDimensions.height,
    onUpdateNodePositions: updateNodePositions,
  });
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [mode]);

  useEffect(() => {
    setActiveItem(schemaStore?.activeItem || null);
    return () => {
      resetStore();
    };
  }, [graphTypeId, mode, JSON.stringify(schemaStore?.activeItem)]);

  const isActiveConfigDrawer = Boolean(activeItem.get());

  return (
    <GraphContainer ref={reactFlowWrapper} className={isFullScreen.get() ? fullScreenCls : undefined}>
      <GraphCanvas
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeAdd={(position) => {
          const newNode = new INodeTypeItem({ style: { position } });
          schemaStore?.addNodeType(newNode);
          addNodeAtPosition(newNode, position);
          setActiveItem({ type: VisualEditorType.Tag, value: newNode });
        }}
        onEdgeAdd={(edge) => {
          setActiveItem({ type: VisualEditorType.Edge, value: edge });
        }}
        onNodeClick={(_, node: Node<ReactFlowNodeData> | Node) => {
          if (!node.data) {
            return;
          }
          setActiveItem({ type: VisualEditorType.Tag, value: node.data?.nodeTypeItem as INodeTypeItem });
        }}
        onEdgeClick={(_, edge: Edge<ReactFlowEdgeData> | Edge) => {
          if (!edge.data) {
            return;
          }
          setActiveItem({ type: VisualEditorType.Edge, value: edge.data?.edgeTypeItem as IEdgeTypeItem });
        }}
        onPaneClick={() => {
          setActiveItem(null);
        }}
      />

      {reactFlowInstance.get() && (
        <>
          <GraphCornerButtons
            isForceLayoutRunning={isForceLayoutRunning}
            toggleSimulation={toggleSimulation}
            onZoomIn={() => reactFlowInstance.get()?.zoomIn()}
            onZoomOut={() => reactFlowInstance.get()?.zoomOut()}
          />

          {!readonly && (
            <TagItem
              draggable
              sx={{
                borderColor: ToolNodeColor.strokeColor,
                backgroundColor: theme.palette.vesoft.v2.bg6,
                color: theme.palette.vesoft.v2.text2,
                boxShadow: `0 1px 6px ${ToolNodeColor.shadow}`,
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 1,
                cursor: 'grab',
              }}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('application/reactflow', 'newNode');
              }}
            >
              <AddFilled sx={{ color: theme.palette.vesoft.textColor3 }} />
              <Typography fontSize={12} fontWeight={700} color={theme.palette.vesoft.textColor3}>
                {t('add', { ns: 'graphtype' })}
              </Typography>
            </TagItem>
          )}

          <Drawer
            openWidth={650}
            closeWidth={0}
            variant="permanent"
            open={isActiveConfigDrawer}
            onClose={() => setActiveItem(null)}
            sx={{
              mt: 0,
              height: '100%',
              overflowX: 'hidden',
              '& .MuiDrawer-paper': {
                // width: open ? 450 : 0,
                transition: 'width 0.3s',
                height: '100%',
                padding: 0,
                overflowX: 'hidden',
                borderLeft: isActiveConfigDrawer ? (theme) => `1px solid ${theme.palette.vesoft.textColor6}` : 'none',
                borderRight: 'none',
              },
            }}
          >
            <ConfigForm
              activeItem={activeItem.get()}
              mode={mode}
              onCopy={() => {
                const targetItem = activeItem.get();
                if (!targetItem) {
                  return;
                }

                const { type } = targetItem || {};
                if (type === VisualEditorType.Tag) {
                  const position = getPositionFromCanvas(targetItem.value.id) || undefined;
                  schemaStore?.addNodeType(targetItem.value.clone({ style: { position } }) as INodeTypeItem);
                } else if (type === VisualEditorType.Edge) {
                  schemaStore?.addEdgeType(targetItem.value.clone() as IEdgeTypeItem);
                }
              }}
              onDelete={() => {
                const targetItem = activeItem.get();
                if (!targetItem) {
                  return;
                }
                const { type, value } = targetItem || {};
                if (!value) {
                  return;
                }

                if (type === VisualEditorType.Tag) {
                  schemaStore?.deleteNodeType(value);
                } else if (type === VisualEditorType.Edge) {
                  schemaStore?.deleteEdgeType(value);
                }
                setActiveItem(null);
              }}
              onChange={(type, formValues) => {
                const targetItem = activeItem.get();
                if (!targetItem) {
                  return;
                }
                const activeItemId = targetItem.value.id;
                if (type === VisualEditorType.Tag) {
                  // schemaStore 数据更新
                  schemaStore?.updateNodeType(activeItemId, formValues as INodeTypeItem);

                  // canvas UI 更新
                  targetItem.value.updateValues(formValues);
                  updateNode(targetItem.value as INodeTypeItem);
                } else if (type === VisualEditorType.Edge) {
                  // schemaStore 数据更新
                  schemaStore?.updateEdgeType(activeItemId, formValues as IEdgeTypeItem);

                  // canvas UI 更新
                  targetItem.value.updateValues(formValues);
                  updateEdge(targetItem.value as IEdgeTypeItem);
                }
              }}
            />
          </Drawer>
        </>
      )}
    </GraphContainer>
  );
}

export default observer(VisualBuilder);
