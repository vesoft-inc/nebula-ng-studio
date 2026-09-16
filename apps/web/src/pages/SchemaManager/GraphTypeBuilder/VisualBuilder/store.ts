import { action, autorun, observable } from 'mobx';
import {
  Node,
  Edge,
  ReactFlowInstance,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  getNodesBounds,
} from '@xyflow/react';
import { IEdgeTypeItem, INodeTypeItem } from '@studio/interfaces';
import { NODE_SIZE } from './CustomNode';
import { ActiveItemInfo } from '@studio/stores/graphtype/schema';
import { computeForceLayout } from './useForceLayout';
import { VisualEditorType } from '@studio/utils/constant';

// ReactFlow data interfaces
export interface ReactFlowNodeData extends Record<string, unknown> {
  nodeTypeItem: INodeTypeItem;
  isActive: boolean;
  isReadonly: boolean;
}

export interface ReactFlowEdgeData extends Record<string, unknown> {
  edgeTypeItem: IEdgeTypeItem;
  isActive: boolean;
  isReadonly: boolean;
  parallelIndex?: number;
  totalParallel?: number;
}

export type ReactFlowNode = Node<ReactFlowNodeData>;
export type ReactFlowEdge = Edge<ReactFlowEdgeData>;

export const reactFlowInstance = observable.box(null as ReactFlowInstance<ReactFlowNode, ReactFlowEdge> | null);
export const reactFlowNodes = observable<ReactFlowNode>([], { deep: false });
export const reactFlowEdges = observable<ReactFlowEdge>([], { deep: false });

export const activeItem = observable.box<ActiveItemInfo | null>(null);
export const isReadonly = observable.box(true);
export const isFullScreen = observable.box(false);

// Transform INodeTypeItem[] to ReactFlow nodes
export const transformToReactFlowNodes = (nodeTypeList: INodeTypeItem[]): ReactFlowNode[] => {
  const _activeItemId = activeItem.get()?.value.id;
  const _isReadonly = isReadonly.get();
  return nodeTypeList.map((nodeItem) => {
    const position = nodeItem.style?.position || { x: nodeItem.style?.x || 0, y: nodeItem.style?.y || 0 };
    return {
      id: nodeItem.id,
      type: 'customNode',
      position,
      data: {
        nodeTypeItem: nodeItem,
        isActive: _activeItemId ? _activeItemId === nodeItem.id : false,
        isReadonly: _isReadonly,
      },
      draggable: true,
      selectable: true,
    };
  });
};

// Transform IEdgeTypeItem[] to ReactFlow edges with parallel edge calculation
export const transformToReactFlowEdges = (edgeTypeList: IEdgeTypeItem[]): ReactFlowEdge[] => {
  const _activeItemId = activeItem.get()?.value.id;
  const _isReadonly = isReadonly.get();

  // Group edges by directional key to handle different directions separately
  const edgeDirectionMap = new Map<string, IEdgeTypeItem[]>();

  edgeTypeList.forEach((edge) => {
    // Use directional key: src->dst (not sorted, to distinguish A->B from B->A)
    const directionKey = `${edge.srcNode.id}->${edge.dstNode.id}`;
    if (!edgeDirectionMap.has(directionKey)) {
      edgeDirectionMap.set(directionKey, []);
    }
    edgeDirectionMap.get(directionKey)!.push(edge);
  });

  return edgeTypeList.map((edgeItem) => {
    const directionKey = `${edgeItem.srcNode.id}->${edgeItem.dstNode.id}`;
    const reverseKey = `${edgeItem.dstNode.id}->${edgeItem.srcNode.id}`;

    // Get edges in the same direction
    const sameDirectionEdges = edgeDirectionMap.get(directionKey) || [];
    // Get edges in the opposite direction
    const oppositeDirectionEdges = edgeDirectionMap.get(reverseKey) || [];

    // Calculate parallel index within same direction group
    const parallelIndex = sameDirectionEdges.findIndex((e) => e.id === edgeItem.id);

    // Calculate total parallel count for this direction
    // If there are opposite direction edges, we offset the indices to avoid overlap
    const totalParallelInDirection = sameDirectionEdges.length;
    const hasOppositeEdges = oppositeDirectionEdges.length > 0;

    // Adjust parallel index to avoid overlapping with opposite direction edges
    // Positive indices for one direction, negative-like offset for the other
    const adjustedParallelIndex = hasOppositeEdges
      ? parallelIndex - Math.floor(totalParallelInDirection / 2)
      : parallelIndex;

    // Total parallel includes both directions for proper spacing calculation
    const totalParallel = hasOppositeEdges
      ? totalParallelInDirection + oppositeDirectionEdges.length
      : totalParallelInDirection;

    return {
      id: edgeItem.id,
      source: edgeItem.srcNode.id,
      target: edgeItem.dstNode.id,
      type: 'customEdge',
      data: {
        edgeTypeItem: edgeItem,
        isActive: _activeItemId ? _activeItemId === edgeItem.id : false,
        isReadonly: _isReadonly,
        parallelIndex: adjustedParallelIndex,
        totalParallel: totalParallel,
      },
    };
  });
};

export const getPositionFromCanvas = (id: string): { x: number; y: number } | null => {
  const instanceNodes = (reactFlowInstance.get()?.getNodes?.() as ReactFlowNode[]) || [];
  const nodesForBounds = (instanceNodes.length ? instanceNodes : reactFlowNodes.slice()).filter(
    (node) => node.id === id
  );
  if (nodesForBounds.length <= 0) {
    return null;
  }

  const bounds = getNodesBounds(nodesForBounds);
  const offsetFactor = +(Math.random() * (1.05 - 1.01) + 1.01);
  return { x: bounds.x * offsetFactor, y: bounds.y * offsetFactor };
};

export const updateNodes = action((nodeTypeList: INodeTypeItem[]) => {
  if (reactFlowNodes.length === 0 && nodeTypeList.length > 0) {
    const nodes = transformToReactFlowNodes(nodeTypeList);
    const edgesForLayout = reactFlowEdges.slice().map((edge) => ({
      source: edge.source,
      target: edge.target,
      totalParallel: (edge.data as { totalParallel?: number })?.totalParallel,
    }));

    const layout = computeForceLayout(
      nodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
      edgesForLayout
    );
    if (layout.length > 0) {
      const positionMap = new Map(layout.map((item) => [item.id, { x: item.x, y: item.y }]));
      const positionedNodes = nodes.map((node) => {
        const pos = positionMap.get(node.id);
        return pos ? { ...node, position: pos } : node;
      });
      reactFlowNodes.replace(positionedNodes);
      return;
    }
  }

  const nodeMap = new Map(reactFlowNodes.map((node) => [node.id, node]));
  const nodes = transformToReactFlowNodes(nodeTypeList).map((node) => {
    const existingNode = nodeMap.get(node.id);
    if (!existingNode) {
      return node;
    }
    node.position = existingNode.position || node.position;
    return node;
  });
  reactFlowNodes.replace(nodes);
});

export const updateEdges = action((edgeTypeList: IEdgeTypeItem[]) => {
  const edges = transformToReactFlowEdges(edgeTypeList);
  reactFlowEdges.replace(edges);
});

// Update node positions (for force layout or drag)
export const updateNodePositions = action((positions: { id: string; x: number; y: number }[]) => {
  if (positions.length === 0) return;
  reactFlowNodes.replace(
    reactFlowNodes.map((node) => {
      const pos = positions.find((p) => p.id === node.id);
      if (pos) {
        return { ...node, position: { x: pos.x, y: pos.y } };
      }
      return node;
    })
  );
});

export const updateNode = action((nodeTypeItem: INodeTypeItem) => {
  if (!nodeTypeItem) return;

  const nodeItems = reactFlowNodes
    .map((node) => node.data?.nodeTypeItem)
    .filter((item): item is INodeTypeItem => Boolean(item));

  const idx = nodeItems.findIndex((item) => item.id === nodeTypeItem.id);
  if (idx >= 0) {
    nodeItems[idx] = nodeTypeItem;
  } else {
    nodeItems.push(nodeTypeItem);
  }

  // Reuse bulk updater to keep existing positions
  updateNodes(nodeItems);
});

export const updateEdge = action((edgeTypeItem: IEdgeTypeItem) => {
  if (!edgeTypeItem) return;

  const edgeItems = reactFlowEdges
    .map((edge) => edge.data?.edgeTypeItem)
    .filter((item): item is IEdgeTypeItem => Boolean(item));

  const idx = edgeItems.findIndex((item) => item.id === edgeTypeItem.id);
  if (idx >= 0) {
    edgeItems[idx] = edgeTypeItem;
  } else {
    edgeItems.push(edgeTypeItem);
  }

  updateEdges(edgeItems);
});

// Calculate drop position from screen coordinates
export const getDropPosition = action((clientX: number, clientY: number): { x: number; y: number } | null => {
  const instance = reactFlowInstance.get();
  const rawPosition = instance?.screenToFlowPosition?.({
    x: clientX,
    y: clientY,
  });

  if (!rawPosition) return null;

  return {
    x: rawPosition.x - NODE_SIZE / 2,
    y: rawPosition.y - NODE_SIZE / 2,
  };
});

// Add a new node at specific position
export const addNodeAtPosition = action((nodeTypeItem: INodeTypeItem, position: { x: number; y: number }) => {
  const _isReadonly = isReadonly.get();
  const newNode: ReactFlowNode = {
    id: nodeTypeItem.id,
    type: 'customNode',
    position,
    data: {
      nodeTypeItem,
      isActive: false,
      isReadonly: _isReadonly,
    },
    draggable: true,
    selectable: true,
  };
  reactFlowNodes.push(newNode);
});

// Apply ReactFlow node changes
export const applyNodeChangesToStore = action((changes: NodeChange[]) => {
  const nodes = applyNodeChanges(changes, reactFlowNodes.slice()) as ReactFlowNode[];
  reactFlowNodes.replace(nodes);
});

// Apply ReactFlow edge changes
export const applyEdgeChangesToStore = action((changes: EdgeChange[]) => {
  const edges = applyEdgeChanges(changes, reactFlowEdges.slice()) as ReactFlowEdge[];
  reactFlowEdges.replace(edges);
});

export const setActiveItem = action((item: ActiveItemInfo | null) => {
  activeItem.set(item);
});

// Reset store state
export const resetStore = action(() => {
  reactFlowNodes.replace([]);
  reactFlowEdges.replace([]);
  activeItem.set(null);
  isReadonly.set(true);
  isFullScreen.set(false);
  // reactFlowInstance.set(null); // Sync state by GraphCanvas.tsx
});

const syncActiveState = action((currentActive: ActiveItemInfo | null) => {
  const activeId = currentActive?.value.id;
  const activeType = currentActive?.type;

  const nodes = reactFlowNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isActive: activeType === VisualEditorType.Tag && node.data?.nodeTypeItem?.id === activeId,
    },
  }));
  reactFlowNodes.replace(nodes);

  const edges = reactFlowEdges.map((edge) => ({
    ...edge,
    data: {
      ...edge.data,
      isActive: activeType === VisualEditorType.Edge && edge.data?.edgeTypeItem?.id === activeId,
    },
  })) as ReactFlowEdge[];
  reactFlowEdges.replace(edges);
});

autorun(() => {
  syncActiveState(activeItem.get());
});
