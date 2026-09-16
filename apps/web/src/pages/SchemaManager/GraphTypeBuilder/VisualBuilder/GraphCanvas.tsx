import {
  Background,
  ConnectionLineType,
  ReactFlow,
  ReactFlowProvider,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import { ComponentProps, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import GraphMarkerDefinitions from './GraphMarkerDefinitions';
import CustomNode from './CustomNode';
import CustomEdge from './CustomEdge';
import { CustomConnectionLine } from './CustomConnectionLine';
import { useTheme } from '@mui/material';
import {
  applyEdgeChangesToStore,
  applyNodeChangesToStore,
  getDropPosition,
  isReadonly,
  ReactFlowEdge,
  reactFlowEdges,
  reactFlowInstance,
  ReactFlowNode,
  reactFlowNodes,
  transformToReactFlowEdges,
} from './store';
import { IEdgeTypeItem } from '@studio/interfaces';
import { useStore } from '@studio/stores';

interface GraphCanvasProps {
  onInit?: () => void;
  onNodeDragStart: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onNodeDragStart'];
  onNodeDrag: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onNodeDrag'];
  onNodeDragStop: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onNodeDragStop'];
  onNodeClick: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onNodeClick'];
  onEdgeClick: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onEdgeClick'];
  onPaneClick: ComponentProps<typeof ReactFlow<ReactFlowNode, ReactFlowEdge>>['onPaneClick'];
  onNodeAdd: (position: { x: number; y: number }) => void;
  onEdgeAdd?: (edge: IEdgeTypeItem) => void;
}

const GraphCanvasComponent = ({
  onInit,
  onNodeDragStart,
  onNodeDrag,
  onNodeDragStop,
  onNodeClick,
  onEdgeClick,
  onPaneClick,
  onNodeAdd,
  onEdgeAdd,
}: GraphCanvasProps) => {
  const { graphtypeStore } = useStore();
  const schemaStore = graphtypeStore.schemaStore;
  const theme = useTheme();
  const readonly = isReadonly.get();

  const suppressNextNodeClickRef = useRef(false);

  const nodes = reactFlowNodes.slice();
  const edges = reactFlowEdges.slice();

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    if (!type || type !== 'newNode') return;

    const position = getDropPosition(event.clientX, event.clientY);

    if (position) {
      onNodeAdd(position);
    }
  };

  const onNodesChange = (changes: NodeChange[]) => {
    applyNodeChangesToStore(changes);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    applyEdgeChangesToStore(changes);
  };

  const addEdgeTypeWithTransform = (connection: Connection) => {
    if (!schemaStore || !connection.source || !connection.target) return;

    // Source/Target node id is reversed by default, here is a simple fix
    const dstNode = schemaStore.nodeTypeList.find((node) => node.id === connection.source);
    const srcNode = schemaStore.nodeTypeList.find((node) => node.id === connection.target);
    if (!srcNode || !dstNode) return;

    const existingEdges = schemaStore.edgeTypeList.slice();
    const newEdge = new IEdgeTypeItem({ srcNode, dstNode });
    const updatedEdges = [...existingEdges, newEdge];

    // Use transformToReactFlowEdges to calculate parallel metadata then sync back to schema store
    const transformed = transformToReactFlowEdges(updatedEdges);
    transformed.forEach((edge, idx) => {
      const { parallelIndex, totalParallel } = (edge.data || {}) as { parallelIndex?: number; totalParallel?: number };
      const targetEdge = updatedEdges[idx] as IEdgeTypeItem & { style?: Record<string, unknown> };
      targetEdge.style = {
        ...(targetEdge.style || {}),
        ...(parallelIndex !== undefined ? { parallelIndex } : {}),
        ...(totalParallel !== undefined ? { totalParallel } : {}),
      };
    });

    schemaStore.updateEdgeTypeList(updatedEdges);
    onEdgeAdd?.(newEdge);
  };

  const onConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;

    addEdgeTypeWithTransform(connection);
    const isSelfConnection = connection.source === connection.target;
    if (isSelfConnection) {
      suppressNextNodeClickRef.current = true;
      requestAnimationFrame(() => {
        suppressNextNodeClickRef.current = false;
      });
    }
  };

  const handleNodeClick: GraphCanvasProps['onNodeClick'] = (event, node) => {
    if (suppressNextNodeClickRef.current) {
      suppressNextNodeClickRef.current = false;
      event.stopPropagation();
      return;
    }
    onNodeClick?.(event, node);
  };

  useEffect(() => {
    return () => {
      reactFlowInstance.set(null);
    };
  }, []);

  return (
    <ReactFlowProvider>
      <style>{`.react-flow__panel{opacity:0;pointer-events:none !important;}`}</style>
      <ReactFlow
        colorMode={theme.palette.mode}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={{
          customNode: CustomNode,
        }}
        edgeTypes={{
          customEdge: CustomEdge,
        }}
        elevateNodesOnSelect
        elevateEdgesOnSelect
        nodesDraggable
        nodesConnectable={!readonly}
        nodesFocusable={!readonly}
        edgesFocusable={!readonly}
        elementsSelectable={!readonly}
        deleteKeyCode={null}
        connectionLineComponent={CustomConnectionLine}
        connectionLineType={ConnectionLineType.Straight}
        fitView
        fitViewOptions={{
          duration: 500,
          interpolate: 'smooth',
          padding: 1.5,
          minZoom: 0.25,
          maxZoom: 2,
        }}
        minZoom={0.1}
        maxZoom={4}
        onInit={(instance) => {
          instance.zoomTo(0.1);
          reactFlowInstance.set(instance);
          onInit?.();
        }}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <Background />
        <GraphMarkerDefinitions />
      </ReactFlow>
    </ReactFlowProvider>
  );
};

export const GraphCanvas = observer(GraphCanvasComponent);
