import ForceGraph, { ForceGraphInstance } from '@vesoft-inc/force-graph';
import { action, makeAutoObservable } from 'mobx';
import { ITransform } from '../types/explorer';
import type { GraphWorkspaceStore } from './workspace';

export class MinimapStore {
  pointer = {
    top: 0,
    left: 0,
    event: undefined,
  };

  graph?: ForceGraphInstance = undefined;
  width = 0;
  height = 0;
  transform = { k: 1, x: 0, y: 0 };
  explorerStore?: GraphWorkspaceStore;

  constructor(explorerStore?: GraphWorkspaceStore) {
    makeAutoObservable(this, {
      graph: false,
      setTransform: action,
      explorerStore: false,
    });
    this.explorerStore = explorerStore;
  }

  setTransform = (transform: Partial<ITransform>) =>
    Object.entries(transform).forEach(([key, value]) => {
      this.transform[key as keyof ITransform] = value;
    });

  initGraph = ({ dom, width = 320, height = 240 }: { dom: HTMLElement; width?: number; height?: number }) => {
    const Graph = ForceGraph()(dom);
    Graph.width(width)
      .height(height)
      .enableNodeDrag(false)
      .enablePointerInteraction(false)
      .enablePanInteraction(false)
      .enableZoomInteraction(false)
      .linkDirectionalArrowLength(12)
      .linkDirectionalArrowRelPos(6)
      .linkCurvature('curvature')
      .nodeRelSize(14)
      .cooldownTicks(0)
      .maxZoom(1)
      .zoomToFit()
      .onZoom((v) => {
        this.setTransform(v);
      });
    this.graph = Graph;
    this.width = width;
    this.height = height;
    this.refresh();
  };

  destroy = () => {
    this.graph?._destructor();
    this.graph = undefined;
    this.width = 0;
    this.height = 0;
  };

  refresh = (
    data = {
      nodes: this.explorerStore?.graph?.nodes.toJSON() || [],
      links: this.explorerStore?.graph?.links.toJSON() || [],
    }
  ) => {
    if (!this.graph) {
      return;
    }
    // const nodes = data.nodes.filter((n) => !this.graphStore?.vertexFilters.nodeIdsFilteredSet.has(n.id));
    const nodes = data.nodes;
    const links = data.links.filter((l) => l.isCluster !== false);
    this.graph.width(this.width);
    this.graph.height(this.height);
    this.graph.graphData({ nodes, links }).zoomToFit();
  };
}
