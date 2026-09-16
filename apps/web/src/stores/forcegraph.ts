import { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { makeAutoObservable, observable } from 'mobx';
import { v4 as uuid } from 'uuid';
import { Pointer, VertexValue } from '@studio/interfaces/console';
import { makeRoundPosition } from '@studio/utils/explorer';
import TwoGraph from './twoGraph';
import ConsoleStore from './console';

export class ForceGraphStore {
  consoleStore: ConsoleStore;
  nowDataMap: Map<string, LinkObject | NodeObject> = new Map();
  nodes = observable.set<NodeObject>([], { deep: false });
  links = observable.set<LinkObject>([], { deep: false });
  nodesSelected = observable.set<NodeObject>([], { deep: false });
  linksSelected = observable.set<LinkObject>([], { deep: false });
  nodeHovering: NodeObject | null = null;
  nodeDragging: NodeObject | null = null;
  linkHovering: LinkObject | null = null;
  id: string;
  container: HTMLElement | null = null;
  filterExclusionIds: { [key: string]: boolean } = {};
  pointer: Pointer = {
    top: 0,
    left: 0,
    event: undefined,
    showContextMenu: false,
  };
  zoomFrame?: number;
  /** not observe */
  twoGraph?: TwoGraph = undefined;
  canvas: HTMLCanvasElement | undefined;
  width = 0;
  height = 0;

  get selectedNodeIds() {
    return [...this.nodesSelected].map(({ id }) => id);
  }

  constructor(consoleStore: ConsoleStore, container: HTMLElement) {
    makeAutoObservable(this, {
      nodeHovering: observable.ref,
      nodeDragging: observable.ref,
      linkHovering: observable.ref,
      pointer: observable.ref,
      nowDataMap: false,
      twoGraph: false,
      canvas: false,
    });
    this.consoleStore = consoleStore;
    this.container = container;
    this.id = uuid();
  }

  // init data & rerender
  initData = ({ nodes, links }: { nodes?: NodeObject[]; links?: LinkObject[] }) => {
    if (nodes) this.nodes.replace(nodes);
    if (links) this.links.replace(links);
  };

  setSelectedNodeIds = (ids: string[]) => {
    const idsSet = new Set(ids);
    this.nodesSelected.clear();
    this.nodes.forEach((node) => idsSet.has(<string>node.id) && this.nodesSelected.add(node));
  };
  setSelectedLinkIds = (ids: string[]) => {
    const idsSet = new Set(ids);
    this.linksSelected.clear();
    this.links.forEach((link) => idsSet.has(<string>link.id) && this.linksSelected.add(link));
  };

  selectNodes = (nodes: NodeObject[]) => {
    nodes.forEach((node) => {
      !this.filterExclusionIds[node.id!] && this.nodesSelected.add(node);
    });
  };
  unselectNodes = (nodes?: NodeObject[]) => {
    nodes ? nodes.forEach((node) => this.nodesSelected.delete(node)) : this.nodesSelected.clear();
  };
  replaceNodeSelected = (nodes: NodeObject[]) => {
    this.nodesSelected.replace(nodes.filter((node) => !this.filterExclusionIds[node.id!]));
  };
  setHoveringNode = (node: NodeObject | null) => {
    if (node === this.nodeHovering) return;

    this.nodeHovering = node || null;
  };
  setDraggingNode = (node: NodeObject | null) => {
    this.nodeDragging = node || null;
  };
  selectLinks = (links: LinkObject[]) => {
    links.forEach((link) => this.linksSelected.add(link));
  };
  setHoveingdLink = (link: LinkObject | null) => {
    if (this.linkHovering === link) return;
    this.linkHovering = link || null;
  };
  unselectLinks = (links?: LinkObject[]) => {
    links ? links.forEach((link) => this.linksSelected.delete(link)) : this.linksSelected.clear();
  };

  setPointer = (pointer: Partial<Pointer>) => {
    if (this.pointer.showContextMenu && pointer.showContextMenu === undefined) {
      return;
    }
    this.pointer = { ...this.pointer, ...pointer };
  };

  /**
   * add nodes & format & init node pre position
   *
   * @param payload vertexes,edges
   * @returns
   */
  addNodesAndEdges = (vertexes: NodeObject[], edges: LinkObject[]) => {
    // filter exsit data and update it
    const items = [...this.links, ...this.nodes];
    const dataMap = new Map<string, NodeObject | LinkObject>(items.map((item) => [item.id!, item]));
    // search exsit nodes & update it
    vertexes.forEach((node) => {
      if (!dataMap.has(node.id!)) {
        dataMap.set(node.id!, node);
        this.nodes.add(node);
      } else {
        const item = dataMap.get(node.id!)!;
        Object.assign(item.data as VertexValue, node);
      }
    });
    edges.forEach((link) => {
      if (!dataMap.has(link.id!)) {
        const sourceNode = dataMap.get(link.source! as string);
        const targetNode = dataMap.get(link.target! as string);
        if (sourceNode && targetNode) {
          this.links.add(link);
          dataMap.set(link.id!, link);
          link.source = sourceNode;
          link.target = targetNode;
        }
      } else {
        const { source, target, ...others } = link;
        delete link.color;
        const item = dataMap.get(link.id!)!;
        Object.assign(dataMap.get(item.id!)!, others);
      }
    });
    // // makesure there are new nodes
    if (dataMap.size === this.nowDataMap.size) {
      return;
    }
    // make newest data map
    this.nowDataMap = dataMap;
  };

  onZoomMouseUp = () => {
    document.removeEventListener('mouseup', this.onZoomMouseUp);
    this.zoomFrame && cancelAnimationFrame(this.zoomFrame);
    this.zoomFrame = undefined;
  };

  zoom = (type: 'out' | 'in') => {
    if (this.zoomFrame === undefined) {
      document.addEventListener('mouseup', this.onZoomMouseUp);
    }
    const instance = this.twoGraph?.instance;
    if (!instance) return;
    const scale = instance.zoom();
    const newScale = type === 'out' ? scale - 0.01 : type === 'in' ? scale + 0.01 : 1;
    instance.zoom(newScale);
    this.zoomFrame = requestAnimationFrame(() => {
      this.zoom(type);
    });
  };

  // makeLineSort by line's direction & rank to make the same direction be close
  makeLineSort() {
    // update link sort
    const sourceMap = new Map<string, LinkObject[]>();
    this.links.forEach((link) => {
      const sourceId = typeof link.source !== 'object' ? link.source : link.source.id;
      const targetId = typeof link.target !== 'object' ? link.target : link.target.id;
      const sourceCommonId = `${sourceId}=>${targetId}`;
      const targetCommonId = `${targetId}=>${sourceId}`;
      const sourceLinkArr = sourceMap.get(sourceCommonId);
      const targetLinkArr = sourceMap.get(targetCommonId);
      // const linkArr = sourceMap.get(sourceCommonId) || sourceMap.get(targetCommonId);
      if (sourceLinkArr) {
        sourceLinkArr.unshift(link);
      } else if (targetLinkArr) {
        targetLinkArr.push(link);
      } else {
        sourceMap.set(sourceCommonId, [link]);
      }
    });
    // update link's graphIndex
    sourceMap.forEach((linkArr) => {
      if (linkArr.length > 1) {
        const source = linkArr[0].source;
        let status = true;
        let number = 1;
        while (linkArr.length) {
          const link = status ? linkArr.pop() : linkArr.shift();
          if (link) {
            link.graphIndex = number;
            // check direction
            if (link.source !== source) {
              link.graphIndex *= -1;
            }
            number++;
            status = !status;
          }
        }
      } else {
        const link = linkArr[0];
        if (link.source === link.target) {
          link.graphIndex = 1;
        } else {
          link.graphIndex = 0;
        }
      }
    });
  }

  getExploreInfo = async (payload: {
    data: { vertexes: NodeObject[]; edges: LinkObject[] };
    expand?: { vertexStyle: string; customColor: string; customIcon: string };
  }) => {
    const { data } = payload;
    const { vertexes, edges } = data;
    if (this.nodes.size === 0 && vertexes.length !== 1) {
      // make round position width init data
      makeRoundPosition(vertexes, { x: 0, y: 0 });
    }
    this.addNodesAndEdges(vertexes, edges);
  };

  destroyGraph() {
    this.twoGraph?.destroy();
    window.removeEventListener('resize', this.resize);
  }

  resize = () => {
    if (!this.twoGraph) return;
    const rect = this.twoGraph.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.twoGraph.resize();
  };

  initGraph = () => {
    if (!this.container) return;
    this.twoGraph = new TwoGraph(this, this.container);
    window.addEventListener('resize', this.resize);
  };
}

export default ForceGraphStore;
