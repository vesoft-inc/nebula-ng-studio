import { makeAutoObservable, observable } from 'mobx';
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
import { IEdgeTypeItem, INodeTypeItem, NodeLayoutMap } from '../../../schema/types';
import { serializeNodePositions } from '../../layout';
import { NODE_SIZE } from './CustomNode';
import type { ActiveItemInfo } from '../../SchemaEditorState';
import { computeForceLayout } from './forceLayout';
import { resolveNodeLayout } from './layout';
import { VisualEditorType } from '../../../shared/constants';

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

export class CanvasStore {
  nodes = observable.array<ReactFlowNode>([], { deep: false });
  edges = observable.array<ReactFlowEdge>([], { deep: false });
  instance: ReactFlowInstance<ReactFlowNode, ReactFlowEdge> | null = null;
  activeItem: ActiveItemInfo | null = null;
  readonly = true;
  fullScreen = false;

  constructor() {
    makeAutoObservable(this, {
      nodes: false,
      edges: false,
      instance: observable.ref,
      activeItem: observable.ref,
    });
  }

  setInstance = (instance: ReactFlowInstance<ReactFlowNode, ReactFlowEdge> | null) => {
    this.instance = instance;
  };

  setReadonly = (readonly: boolean) => {
    this.readonly = readonly;
    this.nodes.replace(this.nodes.map((node) => ({ ...node, data: { ...node.data, isReadonly: readonly } })));
    this.edges.replace(
      this.edges.map((edge) => ({ ...edge, data: { ...edge.data, isReadonly: readonly } })) as ReactFlowEdge[]
    );
  };

  toggleFullScreen = () => {
    this.fullScreen = !this.fullScreen;
  };

  updateNodes = (nodeTypeList: INodeTypeItem[], savedLayout: NodeLayoutMap | null = null) => {
    const incoming = this.transformToReactFlowNodes(nodeTypeList);
    const currentPositions = new Map(this.nodes.map((node) => [node.id, { x: node.position.x, y: node.position.y }]));

    const { positions, pinned, pending } = resolveNodeLayout(
      incoming.map((node) => ({
        id: node.id,
        name: node.data.nodeTypeItem.name,
        position: { x: node.position.x, y: node.position.y },
      })),
      currentPositions,
      savedLayout
    );

    let nodes = incoming.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, position } : node;
    });

    if (pending.size > 0) {
      const edgesForLayout = this.edges.slice().map((edge) => ({
        source: edge.source,
        target: edge.target,
        totalParallel: (edge.data as { totalParallel?: number })?.totalParallel,
      }));

      const layout = computeForceLayout(
        nodes.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y })),
        edgesForLayout,
        { fixedIds: pinned }
      );

      if (layout.length > 0) {
        const positionMap = new Map(layout.map((item) => [item.id, { x: item.x, y: item.y }]));
        nodes = nodes.map((node) => {
          if (!pending.has(node.id)) {
            return node;
          }
          const position = positionMap.get(node.id);
          return position ? { ...node, position } : node;
        });
      }
    }

    this.nodes.replace(nodes);
  };

  updateEdges = (edgeTypeList: IEdgeTypeItem[]) => {
    this.edges.replace(this.transformToReactFlowEdges(edgeTypeList));
  };

  updateNodePositions = (positions: { id: string; x: number; y: number }[]) => {
    if (positions.length === 0) return;
    this.nodes.replace(
      this.nodes.map((node) => {
        const pos = positions.find((p) => p.id === node.id);
        if (pos) {
          return { ...node, position: { x: pos.x, y: pos.y } };
        }
        return node;
      })
    );
  };

  updateNode = (nodeTypeItem: INodeTypeItem) => {
    if (!nodeTypeItem) return;
    const nodeItems = this.nodes
      .map((node) => node.data?.nodeTypeItem)
      .filter((item): item is INodeTypeItem => Boolean(item));
    const idx = nodeItems.findIndex((item) => item.id === nodeTypeItem.id);
    if (idx >= 0) {
      nodeItems[idx] = nodeTypeItem;
    } else {
      nodeItems.push(nodeTypeItem);
    }
    this.updateNodes(nodeItems);
  };

  updateEdge = (edgeTypeItem: IEdgeTypeItem) => {
    if (!edgeTypeItem) return;
    const edgeItems = this.edges
      .map((edge) => edge.data?.edgeTypeItem)
      .filter((item): item is IEdgeTypeItem => Boolean(item));
    const idx = edgeItems.findIndex((item) => item.id === edgeTypeItem.id);
    if (idx >= 0) {
      edgeItems[idx] = edgeTypeItem;
    } else {
      edgeItems.push(edgeTypeItem);
    }
    this.updateEdges(edgeItems);
  };

  getDropPosition = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const rawPosition = this.instance?.screenToFlowPosition?.({ x: clientX, y: clientY });
    if (!rawPosition) return null;
    return { x: rawPosition.x - NODE_SIZE / 2, y: rawPosition.y - NODE_SIZE / 2 };
  };

  addNodeAtPosition = (nodeTypeItem: INodeTypeItem, position: { x: number; y: number }) => {
    this.nodes.push({
      id: nodeTypeItem.id,
      type: 'customNode',
      position,
      data: { nodeTypeItem, isActive: false, isReadonly: this.readonly },
      draggable: true,
      selectable: true,
    });
  };

  applyNodeChanges = (changes: NodeChange[]) => {
    this.nodes.replace(applyNodeChanges(changes, this.nodes.slice()) as ReactFlowNode[]);
  };

  applyEdgeChanges = (changes: EdgeChange[]) => {
    this.edges.replace(applyEdgeChanges(changes, this.edges.slice()) as ReactFlowEdge[]);
  };

  selectItem = (item: ActiveItemInfo | null) => {
    this.activeItem = item;
    this.syncActiveState();
  };

  /** Compatibility selection entry. */
  setActiveItem = (item: ActiveItemInfo | null) => this.selectItem(item);

  getPositionFromCanvas = (id: string): { x: number; y: number } | null => {
    const instanceNodes = (this.instance?.getNodes?.() as ReactFlowNode[]) || [];
    const nodesForBounds = (instanceNodes.length ? instanceNodes : this.nodes.slice()).filter((node) => node.id === id);
    if (nodesForBounds.length <= 0) return null;
    const bounds = getNodesBounds(nodesForBounds);
    const offsetFactor = +(Math.random() * (1.05 - 1.01) + 1.01);
    return { x: bounds.x * offsetFactor, y: bounds.y * offsetFactor };
  };

  getCanvasLayout = (): NodeLayoutMap =>
    serializeNodePositions(
      this.nodes.map((node) => ({
        name: node.data?.nodeTypeItem?.name,
        x: node.position.x,
        y: node.position.y,
      }))
    );

  reset = () => {
    this.nodes.replace([]);
    this.edges.replace([]);
    this.activeItem = null;
    this.readonly = true;
    this.fullScreen = false;
  };

  dispose = () => {
    this.reset();
    this.instance = null;
  };

  private syncActiveState = () => {
    const activeId = this.activeItem?.value.id;
    const activeType = this.activeItem?.type;
    this.nodes.replace(
      this.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isActive: activeType === VisualEditorType.Tag && node.data?.nodeTypeItem?.id === activeId,
        },
      }))
    );
    this.edges.replace(
      this.edges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          isActive: activeType === VisualEditorType.Edge && edge.data?.edgeTypeItem?.id === activeId,
        },
      })) as ReactFlowEdge[]
    );
  };

  private transformToReactFlowNodes = (nodeTypeList: INodeTypeItem[]): ReactFlowNode[] => {
    const activeId = this.activeItem?.value.id;
    return nodeTypeList.map((nodeItem) => {
      const position = nodeItem.style?.position || { x: nodeItem.style?.x || 0, y: nodeItem.style?.y || 0 };
      return {
        id: nodeItem.id,
        type: 'customNode',
        position,
        data: {
          nodeTypeItem: nodeItem,
          isActive: activeId ? activeId === nodeItem.id : false,
          isReadonly: this.readonly,
        },
        draggable: true,
        selectable: true,
      };
    });
  };

  transformToReactFlowEdges = (edgeTypeList: IEdgeTypeItem[]): ReactFlowEdge[] => {
    const activeId = this.activeItem?.value.id;
    const edgeDirectionMap = new Map<string, IEdgeTypeItem[]>();
    edgeTypeList.forEach((edge) => {
      const directionKey = `${edge.srcNode.id}->${edge.dstNode.id}`;
      if (!edgeDirectionMap.has(directionKey)) {
        edgeDirectionMap.set(directionKey, []);
      }
      edgeDirectionMap.get(directionKey)!.push(edge);
    });

    return edgeTypeList.map((edgeItem) => {
      const directionKey = `${edgeItem.srcNode.id}->${edgeItem.dstNode.id}`;
      const reverseKey = `${edgeItem.dstNode.id}->${edgeItem.srcNode.id}`;
      const sameDirectionEdges = edgeDirectionMap.get(directionKey) || [];
      const oppositeDirectionEdges = edgeDirectionMap.get(reverseKey) || [];
      const parallelIndex = sameDirectionEdges.findIndex((edge) => edge.id === edgeItem.id);
      const totalParallelInDirection = sameDirectionEdges.length;
      const hasOppositeEdges = oppositeDirectionEdges.length > 0;
      const adjustedParallelIndex = hasOppositeEdges
        ? parallelIndex - Math.floor(totalParallelInDirection / 2)
        : parallelIndex;
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
          isActive: activeId ? activeId === edgeItem.id : false,
          isReadonly: this.readonly,
          parallelIndex: adjustedParallelIndex,
          totalParallel,
        },
      };
    });
  };
}
