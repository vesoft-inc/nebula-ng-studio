import { CircularLayout, FruchtermanLayout, RadialLayout, GridLayout, ConcentricLayout } from '@antv/layout';
import { FruchtermanLayout as FruchtermanGPULayout } from '@antv/layout-gpu';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import dagre from 'dagre';
import { Graph } from '@antv/graphlib';
import { NODE_SIZE } from '@vesoft-inc/utils';

import { GraphStore } from '@studio/stores/graph/graph';
import { GraphLayoutType } from '@studio/utils/explorer/constant';

type GraphNode = Omit<NodeObject, 'data'>;
type GraphLink = Omit<LinkObject, 'data'>;

const parseToGraphData = (nodes: NodeObject[], links: LinkObject[]): Graph<GraphNode, GraphLink> => {
  const graphData = new Graph<GraphNode, GraphLink>({
    nodes: nodes.map((node) => ({
      ...node,
      fx: undefined,
      fy: undefined,
      id: node.id!,
    })),
    edges: links.map((link) => ({
      ...link,
      id: link.id!,
      source: (link.source as NodeObject).id!,
      target: (link.target as NodeObject).id!,
    })),
  });
  return graphData;
};

const layouts = {
  [GraphLayoutType.Force]: async (graph: GraphStore) => {
    const { nowDataMap } = graph;
    let LayoutObj;
    if (!window.WebGLRenderingContext) {
      console.error('WebGL is not supported in this browser, use cpu instead.');
      LayoutObj = FruchtermanLayout;
    } else {
      console.log('WebGL is supported.');
      LayoutObj = FruchtermanGPULayout;
    }
    const layout = new LayoutObj({
      gravity: 5,
      speed: 5,
      clustering: true,
      clusterGravity: 5,
    });
    graph.nodes.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    const graphData = parseToGraphData(Array.from(graph.nodes), Array.from(graph.links));
    const layoutMapping = await layout.execute(graphData, {});
    layoutMapping.nodes.forEach((outputNode) => {
      const node = nowDataMap.get(outputNode.id.toString())!;
      node.x = outputNode.data.x;
      node.y = outputNode.data.y;
    });
    graph.twoGraph!.render();
  },

  [GraphLayoutType.Dagre]: async (graph: GraphStore, direction?: string) => {
    const { nowDataMap } = graph;
    const g = new dagre.graphlib.Graph({
      multigraph: true,
    });
    const truthyId = (id: string) => id || '__NODE_ID_EMPTY__';
    g.setGraph({
      nodesep: 100,
      ranksep: 200,
      rankdir: direction,
      ranker: 'tight-tree',
    });
    // @ts-ignore
    g.setDefaultEdgeLabel(() => {
      return {};
    });
    graph.nodes.forEach((node) => {
      const nodeSize = node.nodeArea ? Math.sqrt(<number>node.nodeArea) : NODE_SIZE;
      g.setNode(
        truthyId(node.id!),
        Object.assign(node, {
          width: nodeSize,
          height: nodeSize,
        })
      );
    });
    graph.links.forEach((link) => {
      const sourceId = typeof link.source !== 'object' ? link.source : link.source.id;
      const targetId = typeof link.target !== 'object' ? link.target : link.target.id;
      g.setEdge(truthyId(<string>sourceId), truthyId(<string>targetId));
    });
    dagre.layout(g);
    g.nodes().forEach((nodeId) => {
      const outputNode = g.node(nodeId);
      const node = nowDataMap.get(nodeId)!;
      node.x = outputNode.x;
      node.y = outputNode.y;
      node.fx = outputNode.x;
      node.fy = outputNode.y;
    });
    // redraw();
    graph.twoGraph!.render();
  },

  [GraphLayoutType.Circular]: async (graph: GraphStore) => {
    const { nowDataMap } = graph;
    graph.nodes.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    const layout = new CircularLayout({
      nodeSize: NODE_SIZE * 2,
    });
    const layoutMapping = await layout.execute(parseToGraphData(Array.from(graph.nodes), Array.from(graph.links)));
    layoutMapping.nodes.forEach((outputNode) => {
      const node = nowDataMap.get(outputNode.id.toString())!;
      node.x = outputNode.data.x;
      node.y = outputNode.data.y;
      node.fx = outputNode.data.x;
      node.fy = outputNode.data.y;
    });
    graph.twoGraph!.render();
  },

  [GraphLayoutType.Radial]: async (graph: GraphStore) => {
    const { nowDataMap } = graph;
    graph.nodes.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    const layout = new RadialLayout({
      unitRadius: 200,
      nodeSize: NODE_SIZE * 2,
      nodeSpacing: 50,
    });
    const layoutMapping = await layout.execute(parseToGraphData(Array.from(graph.nodes), Array.from(graph.links)), {
      // center: [0, 0],
      preventOverlap: true,
      strictRadial: true,
      maxIteration: 2000,
    });
    layoutMapping.nodes.forEach((outputNode) => {
      const node = nowDataMap.get(outputNode.id.toString())!;
      node.x = outputNode.data.x;
      node.y = outputNode.data.y;
      node.fx = outputNode.data.x;
      node.fy = outputNode.data.y;
    });
    graph.twoGraph!.render();
  },
  [GraphLayoutType.Concentric]: async (graph: GraphStore) => {
    const { nowDataMap } = graph;
    graph.nodes.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    const layout = new ConcentricLayout({
      nodeSize: NODE_SIZE * 2,
    });
    const layoutMapping = await layout.execute(parseToGraphData(Array.from(graph.nodes), Array.from(graph.links)), {
      preventOverlap: true,
    });
    layoutMapping.nodes.forEach((outputNode) => {
      const node = nowDataMap.get(outputNode.id.toString())!;
      node.x = outputNode.data.x;
      node.y = outputNode.data.y;
      node.fx = outputNode.data.x;
      node.fy = outputNode.data.y;
    });
    // redraw();
    graph.twoGraph!.render();
  },
  [GraphLayoutType.Neural]: async (graph: GraphStore) => {
    const tagsMap: Record<string, { degree: number; arr: NodeObject[] }> = {};
    let max = 0;
    [...graph.nodes].forEach((node) => {
      const tagKey = node.data.value.type;
      if (!tagsMap[tagKey]) {
        tagsMap[tagKey] = {
          degree: 0,
          arr: [],
        };
      }
      tagsMap[tagKey].arr.push(node);
      max = Math.max(max, tagsMap[tagKey].arr.length);
    });
    [...graph.links].forEach((link) => {
      const source = link.source as NodeObject;
      const target = link.target as NodeObject;
      let tagKey = source.data.value.type;
      tagsMap[tagKey].degree = tagsMap[tagKey].degree + 1;
      tagKey = target.data.value.type;
      tagsMap[tagKey].degree = tagsMap[tagKey].degree + 1;
    });
    const keys = Object.keys(tagsMap);
    keys.sort((a, b) => tagsMap[b].degree - tagsMap[a].degree);
    const center = (max * NODE_SIZE * 5) / 2;
    let index = 0;
    for (const key of keys) {
      const { arr } = tagsMap[key];
      const offset = center - (arr.length * NODE_SIZE * 5) / 2;
      arr.forEach((node, subIndex) => {
        node.fx = subIndex * 5 * NODE_SIZE + offset;
        node.fy = index * 10 * NODE_SIZE;
      });
      index++;
    }
    graph.twoGraph!.render();
  },

  [GraphLayoutType.Grid]: async (graph: GraphStore) => {
    const { nowDataMap } = graph;
    graph.nodes.forEach((node) => {
      node.fx = undefined;
      node.fy = undefined;
    });
    const size = Math.ceil(Math.sqrt(graph.nodes.size)) * NODE_SIZE * 4;
    const layout = new GridLayout({
      width: size,
      height: size,
      nodeSize: NODE_SIZE * 2,
    });
    const layoutMapping = await layout.execute(parseToGraphData(Array.from(graph.nodes), Array.from(graph.links)));
    layoutMapping.nodes.forEach((outputNode) => {
      const node = nowDataMap.get(outputNode.id.toString())!;
      node.x = outputNode.data.x;
      node.y = outputNode.data.y;
      node.fx = outputNode.data.x;
      node.fy = outputNode.data.y;
    });
    // redraw();
    graph.twoGraph!.render();
  },
  [GraphLayoutType.DagreLR]: async (graph: GraphStore) => {
    return layouts.dagre(graph, 'LR');
  },
};
export default layouts;
