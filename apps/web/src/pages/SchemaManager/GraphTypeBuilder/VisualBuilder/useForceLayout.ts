import { useEffect, useRef, useCallback, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';
import { reactFlowEdges, ReactFlowNode, reactFlowNodes } from './store';

interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  totalParallel?: number;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

interface LayoutEdge {
  source: string;
  target: string;
  totalParallel?: number;
}

interface LayoutOptions {
  width?: number;
  height?: number;
  baseDistance?: number;
  distancePerParallel?: number;
  chargeStrength?: number;
  iterations?: number;
}

interface ForceSimulationConfig {
  width: number;
  height: number;
  baseDistance: number;
  distancePerParallel: number;
  chargeStrength: number;
  linkStrength?: number;
  collideRadius?: number;
  collideStrength?: number;
  centerStrength?: number;
  alpha?: number;
  alphaDecay?: number;
  alphaMin?: number;
  velocityDecay?: number;
}

const createForceSimulation = (simNodes: SimNode[], simEdges: SimLink[], config: ForceSimulationConfig) => {
  const {
    width,
    height,
    baseDistance,
    distancePerParallel,
    chargeStrength,
    linkStrength = 0.2,
    collideRadius = 70,
    collideStrength = 0.8,
    centerStrength = 0.05,
    alpha,
    alphaDecay,
    alphaMin,
    velocityDecay,
  } = config;

  const centerX = width / 2;
  const centerY = height / 2;

  const simulation = forceSimulation<SimNode>(simNodes)
    .force(
      'link',
      forceLink<SimNode, SimLink>(simEdges)
        .id((d) => d.id)
        .distance((link) => baseDistance + ((link.totalParallel || 1) - 1) * distancePerParallel)
        .strength(linkStrength)
    )
    .force('charge', forceManyBody<SimNode>().strength(chargeStrength))
    .force('collide', forceCollide<SimNode>().radius(collideRadius).strength(collideStrength))
    .force('x', forceX<SimNode>(centerX).strength(centerStrength))
    .force('y', forceY<SimNode>(centerY).strength(centerStrength));

  if (alpha !== undefined) simulation.alpha(alpha);
  if (alphaDecay !== undefined) simulation.alphaDecay(alphaDecay);
  if (alphaMin !== undefined) simulation.alphaMin(alphaMin);
  if (velocityDecay !== undefined) simulation.velocityDecay(velocityDecay);

  return simulation;
};

/**
 * Pre-compute force layout positions synchronously before ReactFlow render
 */
export function computeForceLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions = {}
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const {
    width = 800,
    height = 600,
    baseDistance = 500,
    distancePerParallel = 120,
    chargeStrength = -800,
    iterations = 300,
  } = options;

  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
  }));

  const simEdges: SimLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    totalParallel: e.totalParallel || 1,
  }));

  const simulation = createForceSimulation(simNodes, simEdges, {
    width,
    height,
    baseDistance,
    distancePerParallel,
    chargeStrength,
  }).stop();

  // Run simulation synchronously to completion
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  return simNodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
  }));
}

interface UseForceLayoutOptions {
  containerWidth?: number;
  containerHeight?: number;
  onUpdateNodePositions: (nodes: LayoutNode[]) => void;
}

export const useForceLayout = (options: UseForceLayoutOptions) => {
  const { containerWidth = 800, containerHeight = 600, onUpdateNodePositions } = options;

  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Keep track of dragged nodes to exclude them from simulation updates
  const draggedNodeRef = useRef<string | null>(null);

  const initSimulation = useCallback(() => {
    // Stop any existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    const rfNodes = reactFlowNodes.slice();
    const rfEdges = reactFlowEdges.slice();

    if (rfNodes.length === 0) {
      return;
    }

    // Create simulation nodes - d3-force will mutate these in place
    const nodes: SimNode[] = rfNodes.map((node) => ({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      vx: 0,
      vy: 0,
      fx: node.id === draggedNodeRef.current ? node.position.x : null,
      fy: node.id === draggedNodeRef.current ? node.position.y : null,
    }));

    // Store reference to nodes for tick callback
    nodesRef.current = nodes;

    const edges: SimLink[] = rfEdges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      totalParallel: (edge.data as { totalParallel?: number })?.totalParallel || 1,
    }));

    const baseDistance = 240;
    const distancePerParallel = 100;

    const simulation = createForceSimulation(nodes, edges, {
      width: containerWidth,
      height: containerHeight,
      baseDistance,
      distancePerParallel,
      chargeStrength: -1000,
      alpha: 1,
      alphaDecay: 0.02,
      alphaMin: 0.001,
      velocityDecay: 0.4,
    });

    simulation.on('tick', () => {
      // Read positions from the nodes array (d3 mutates these in place)
      const updates = nodesRef.current.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
      }));

      // Skip updating the dragged node from simulation to prevent jitter
      const filteredUpdates = draggedNodeRef.current ? updates.filter((u) => u.id !== draggedNodeRef.current) : updates;

      onUpdateNodePositions(filteredUpdates);
    });

    // simulation.on('end', () => {
    //   setIsRunning(false);
    // });

    simulationRef.current = simulation;
    setIsRunning(true);
  }, [containerWidth, containerHeight, onUpdateNodePositions]);

  const stopSimulation = useCallback(() => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const toggleSimulation = useCallback(() => {
    if (isRunning) {
      stopSimulation();
    } else {
      initSimulation();
    }
  }, [isRunning, initSimulation, stopSimulation]);

  // Handle drag events
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    draggedNodeRef.current = node.id;

    if (simulationRef.current) {
      // Find and fix the node in the simulation
      const simNode = nodesRef.current.find((n) => n.id === node.id);
      if (simNode) {
        simNode.fx = node.position.x;
        simNode.fy = node.position.y;
      }
      // Re-heat simulation
      simulationRef.current.alphaTarget(0.3).restart();
    }
  }, []);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    if (simulationRef.current) {
      const simNode = nodesRef.current.find((n) => n.id === node.id);
      if (simNode) {
        simNode.fx = node.position.x;
        simNode.fy = node.position.y;
      }
    }
  }, []);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: ReactFlowNode) => {
    draggedNodeRef.current = null;

    if (simulationRef.current) {
      const simNode = nodesRef.current.find((n) => n.id === node.id);
      if (simNode) {
        simNode.fx = null;
        simNode.fy = null;
      }
      simulationRef.current.alphaTarget(0);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, []);

  return {
    isRunning,
    initSimulation,
    stopSimulation,
    toggleSimulation,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
  };
};
