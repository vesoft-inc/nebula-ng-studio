import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  totalParallel?: number;
}

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
  totalParallel?: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  baseDistance?: number;
  distancePerParallel?: number;
  chargeStrength?: number;
  iterations?: number;
  /** Nodes pinned to their input coordinates; they anchor the simulation instead of moving. */
  fixedIds?: Iterable<string>;
}

export interface ForceSimulationConfig {
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

export const createForceSimulation = (simNodes: SimNode[], simEdges: SimLink[], config: ForceSimulationConfig) => {
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
 * Pre-compute force layout positions synchronously before ReactFlow render.
 *
 * Nodes listed in `fixedIds` keep their input coordinates exactly and act as
 * anchors, so only the remaining nodes are moved.
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
    fixedIds,
  } = options;

  const fixed = fixedIds ? new Set(fixedIds) : null;

  const simNodes: SimNode[] = nodes.map((n) => {
    const isFixed = Boolean(fixed?.has(n.id));
    return {
      id: n.id,
      x: n.x,
      y: n.y,
      fx: isFixed ? n.x : null,
      fy: isFixed ? n.y : null,
    };
  });

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
