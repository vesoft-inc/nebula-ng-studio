import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddFilled } from '@vesoft-inc/icons';
import '@xyflow/react/dist/style.css';
import { Typography, useTheme } from '@mui/material';
import { Node, Edge } from '@xyflow/react';

import { GraphContainer, TagItem, fullScreenCls } from './styles';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem } from '../../../schema/types';
import { ToolNodeColor } from '@vesoft-inc/utils';
import { VisualEditorType } from '../../../shared/constants';
import { GraphCanvas } from './GraphCanvas';
import { ReactFlowEdgeData, ReactFlowNodeData } from './store';
import { GraphCornerButtons } from './GraphCornerButtons';
import { useForceLayout } from './useForceLayout';
import { useLayoutPersistence } from './useLayoutPersistence';
import { Drawer } from '../../../shared/index';
import { ConfigForm } from './ConfigForm';
import { observer } from 'mobx-react-lite';
import { useGraphTypeStore } from '../../context';

const CanvasSync = observer(function CanvasSync() {
  const { schemaStore, canvasStore: canvas } = useGraphTypeStore();
  // Subscribe separately so schema edits do not recreate the configuration form's callbacks.
  // Mounting under VisualBuilder also defers layout work until large graphs are confirmed.
  useEffect(() => {
    schemaStore?.syncCanvas();
  }, [schemaStore, canvas, schemaStore?.canvasRevision, schemaStore?.savedLayout]);
  return null;
});

function VisualBuilder() {
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);

  const { schemaStore, mode, canvasStore: canvas, services } = useGraphTypeStore();
  const graphTypeId = schemaStore?.graphtypeName;
  const readonly = canvas?.readonly ?? true;

  useEffect(() => {
    canvas?.instance?.fitView();
  }, [graphTypeId, canvas, canvas?.instance]);

  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!reactFlowWrapper.current) {
      return;
    }
    const rect = reactFlowWrapper.current.getBoundingClientRect();
    setContainerDimensions({ width: rect.width, height: rect.height });
  }, []);

  const savedLayout = schemaStore?.savedLayout ?? null;

  useLayoutPersistence({
    canvas,
    enabled:
      Boolean(canvas) && (mode === GraphTypeBuildMode.Edit || mode === GraphTypeBuildMode.Readonly) && !!graphTypeId,
    layouts: services.layouts,
    graphTypeName: graphTypeId,
    initialLayout: savedLayout,
    preserveNodeNames:
      mode === GraphTypeBuildMode.Edit ? schemaStore?.originalNodeTypeList.map((node) => node.name) : undefined,
  });

  const {
    isRunning: isForceLayoutRunning,
    toggleSimulation,
    stopSimulation,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  } = useForceLayout({
    canvas,
    containerWidth: containerDimensions.width,
    containerHeight: containerDimensions.height,
    onUpdateNodePositions: (positions) => canvas?.updateNodePositions(positions),
  });
  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, [mode]);

  useEffect(() => {
    canvas?.selectItem(schemaStore?.activeItem || null);
  }, [canvas, schemaStore?.activeItem]);

  if (!canvas) {
    return null;
  }

  const isActiveConfigDrawer = Boolean(canvas.activeItem);

  return (
    <GraphContainer ref={reactFlowWrapper} className={canvas.fullScreen ? fullScreenCls : undefined}>
      <CanvasSync />
      <GraphCanvas
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onNodeAdd={(position) => {
          const newNode = new INodeTypeItem({ style: { position } });
          canvas.addNodeAtPosition(newNode, position);
          schemaStore?.addNodeType(newNode);
          canvas.selectItem({ type: VisualEditorType.Tag, value: newNode });
        }}
        onEdgeAdd={(edge) => {
          canvas.selectItem({ type: VisualEditorType.Edge, value: edge });
        }}
        onNodeClick={(_, node: Node<ReactFlowNodeData> | Node) => {
          if (!node.data) {
            return;
          }
          canvas.selectItem({ type: VisualEditorType.Tag, value: node.data?.nodeTypeItem as INodeTypeItem });
        }}
        onEdgeClick={(_, edge: Edge<ReactFlowEdgeData> | Edge) => {
          if (!edge.data) {
            return;
          }
          canvas.selectItem({ type: VisualEditorType.Edge, value: edge.data?.edgeTypeItem as IEdgeTypeItem });
        }}
        onPaneClick={() => {
          canvas.selectItem(null);
        }}
      />

      {canvas.instance && (
        <>
          <GraphCornerButtons
            canvas={canvas}
            isForceLayoutRunning={isForceLayoutRunning}
            toggleSimulation={toggleSimulation}
            onZoomIn={() => canvas.instance?.zoomIn()}
            onZoomOut={() => canvas.instance?.zoomOut()}
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
            onClose={() => canvas.selectItem(null)}
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
              activeItem={canvas.activeItem}
              mode={mode}
              onCopy={() => {
                const targetItem = canvas.activeItem;
                if (!targetItem) {
                  return;
                }

                const { type } = targetItem || {};
                if (type === VisualEditorType.Tag) {
                  const position = canvas.getPositionFromCanvas(targetItem.value.id) || undefined;
                  schemaStore?.addNodeType(targetItem.value.clone({ style: { position } }) as INodeTypeItem);
                } else if (type === VisualEditorType.Edge) {
                  schemaStore?.addEdgeType(targetItem.value.clone() as IEdgeTypeItem);
                }
              }}
              onDelete={() => {
                const targetItem = canvas.activeItem;
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
                canvas.selectItem(null);
              }}
              onChange={(type, formValues) => {
                const targetItem = canvas.activeItem;
                if (!targetItem) {
                  return;
                }
                const activeItemId = targetItem.value.id;
                if (type === VisualEditorType.Tag) {
                  schemaStore?.commitNodeChanges(activeItemId, formValues as INodeTypeItem);
                  targetItem.value.updateValues(formValues);
                } else if (type === VisualEditorType.Edge) {
                  schemaStore?.commitEdgeChanges(activeItemId, formValues as IEdgeTypeItem);
                  targetItem.value.updateValues(formValues);
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
