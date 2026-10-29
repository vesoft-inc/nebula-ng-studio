import type { GraphStore } from '../../stores/graph';
import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';

interface GraphRenderer {
  nodeTraverse?(node: NodeObject): NodeObject;
  linkTraverse?(link: LinkObject): LinkObject;
  effect?(): void;
}

class LabelRenderer implements GraphRenderer {
  constructor(private graph: GraphStore) {}
  nodeTraverse = (node: NodeObject) => {
    const graphStore = this.graph;
    const displayedPropertyItem = graphStore.displayedNodePropertyItems.find(
      (item) => item.type_name === node.data.value.type
    );
    if (displayedPropertyItem) {
      node.label = Object.entries(node.data.value.properties)
        .filter(([key, _]) => displayedPropertyItem.properties?.includes(key))
        .map(([_, value]) => value)
        .join('\r\n');
    }
    return node;
  };
  linkTraverse = (link: LinkObject) => {
    const graphStore = this.graph;
    const displayedPropertyItem = graphStore.displayedEdgePropertyItems.find(
      (item) => item.type_name === link.data.value.type
    );
    if (displayedPropertyItem) {
      link.label =
        link.data.value.type +
        '\r\n' +
        Object.entries(link.data.value.properties)
          .filter(([key, _]) => displayedPropertyItem.properties?.includes(key))
          .map(([_, value]) => value)
          .join('\r\n');
    }
    return link;
  };
}

class MultiLinkRenderer implements GraphRenderer {
  sourceMap: Map<string, LinkObject[]> = new Map();

  linkTraverse = (link: LinkObject) => {
    const sourceId = typeof link.source !== 'object' ? link.source : link.source.id;
    const targetId = typeof link.target !== 'object' ? link.target : link.target.id;
    const sourceCommonId = `${sourceId}=>${targetId}`;
    const targetCommonId = `${targetId}=>${sourceId}`;

    const linkArr = this.sourceMap.get(sourceCommonId) || this.sourceMap.get(targetCommonId);
    if (!linkArr) {
      this.sourceMap.set(sourceCommonId, [link]);
    } else if (this.sourceMap.get(sourceCommonId)) {
      linkArr.unshift(link);
    } else if (this.sourceMap.get(targetCommonId)) {
      linkArr.push(link);
    }

    return link;
  };

  effect = () => {
    this.sourceMap.forEach((links) => {
      const len = links.length;
      if (!len) {
        return;
      }

      if (len === 1) {
        const link = links[0];
        link.graphIndex = +(link.source === link.target);
        return;
      }

      const source = links[0].source;
      let status = true;
      let number = 1;
      while (links.length > 0) {
        const link = status ? links.pop()! : links.shift()!;
        link.graphIndex = number;
        // check direction
        if (link.source !== source) {
          link.graphIndex *= -1;
        }
        number++;
        status = !status;
      }
    });
  };
}

/** traverse nodes and links, modify original data and return */
export default function pipeline({
  nodes = [],
  links = [],
  graph,
}: {
  nodes: NodeObject[];
  links: LinkObject[];
  graph: GraphStore;
}) {
  const rendererList: GraphRenderer[] = [new LabelRenderer(graph), new MultiLinkRenderer()];
  const { nodeTraverse, linkTraverse, effect } = rendererList.reduce(
    (ret, { nodeTraverse, linkTraverse, effect }) => {
      if (nodeTraverse) {
        const retNodeTraverse = ret.nodeTraverse;
        ret.nodeTraverse = retNodeTraverse ? (node: NodeObject) => nodeTraverse(retNodeTraverse(node)) : nodeTraverse;
      }
      if (linkTraverse) {
        const retLinkTraverse = ret.linkTraverse;
        ret.linkTraverse = retLinkTraverse ? (link: LinkObject) => linkTraverse(retLinkTraverse(link)) : linkTraverse;
      }
      if (effect) {
        const retEffect = ret.effect;
        ret.effect = retEffect ? () => (effect(), retEffect()) : effect;
      }
      return ret;
    },
    {
      nodeTraverse: undefined,
      linkTraverse: undefined,
      effect: undefined,
    } as GraphRenderer
  );
  nodeTraverse && nodes.forEach((node) => nodeTraverse(node));
  linkTraverse && links.forEach((link) => linkTraverse(link));
  effect?.();
  return { nodes, links };
}
