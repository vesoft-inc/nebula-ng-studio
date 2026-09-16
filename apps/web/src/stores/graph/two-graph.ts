import { action, IReactionDisposer, makeObservable, observable, reaction } from 'mobx';
import { Bezier } from 'bezier-js';
import {
  CLUSTER_LINE_WIDTH,
  FONT_SIZE,
  LINE_LENGTH,
  NODE_AREA,
  NODE_SIZE,
  LABEL_VISIBLE_ZOOM,
} from '@studio/utils/graph/base';
// @ts-ignore
import { forceX, forceY } from 'd3-force-3d';
import ForceGraph from '@vesoft-inc/force-graph';
import type { ForceGraphInstance, LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import type { GraphStore } from './graph';
import { ITransform } from '@studio/interfaces/explorer/explorer';
import pipeline from '@studio/utils/graph/base/pipeline';
import { getRootStore } from '../_ref';
import { EdgeDirectionType, GREY_SCALE_ALPHA, hexToRgba } from '@vesoft-inc/utils';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { throttle } from 'lodash';
import { VertexFilterDisplay } from './vertexFilter';
import { ALL_EDGE_TYPE_KEY, DEFAULT_LINK_COLOR } from '@studio/utils/explorer/constant';

/**
 * 2dview store
 *
 * @class
 */
export class TwoGraphStore {
  graph: GraphStore;
  container: HTMLElement;
  canvas!: HTMLCanvasElement | null;
  transform: ITransform = { k: 1.01, x: 0, y: 0 };
  instance!: ForceGraphInstance;
  autorunDisposer?: IReactionDisposer;
  reactionDisposer?: IReactionDisposer;
  zoomFrame?: number;
  constructor(
    graph: GraphStore,
    container: HTMLElement,
    private graphSettings: Parameters<typeof this.init>[0] = {}
  ) {
    makeObservable(this, {
      transform: observable,
      instance: false,
      graph: false,
      autorunDisposer: false,
      setTransform: action,
      render: action,
    });
    this.graph = graph;
    this.container = container;
    this.init(graphSettings);
  }

  get theme() {
    return getRootStore().themeStore.theme;
  }

  get hoveringNodeNeibors() {
    if (!this.graph.nodeHovering || this.graphSettings.disableHighlightNeighborsOnHover) {
      return {
        nodes: [],
        links: [],
      };
    }
    const nodes: NodeObject[] = [];
    const links: LinkObject[] = [];
    Array.from(this.graph.links).filter((link) => {
      if (link.source === this.graph.nodeHovering || link.target === this.graph.nodeHovering) {
        nodes.push(link.source as NodeObject, link.target as NodeObject);
        links.push(link);
      }
    });
    return {
      nodes,
      links,
    };
  }

  get hovringLinkRelatedNodes() {
    if (!this.graph.linkHovering || this.graphSettings.disableHighlightNeighborsOnHover) return [];
    const { source, target } = this.graph.linkHovering;
    return [source as NodeObject, target as NodeObject];
  }

  setTransform = (transform: Partial<ITransform>) =>
    Object.entries(transform).forEach(([key, value]) => {
      this.transform[key as keyof ITransform] = value;
    });

  // init ForceGraph instance ,it will be called only once
  init = ({
    disableDoubleClickNode,
    disabledDoubleClickLink,
    disableNodeHover,
    disableLinkHover,
  }: {
    disableDoubleClickNode?: boolean;
    disabledDoubleClickLink?: boolean;
    disableNodeHover?: boolean;
    disableLinkHover?: boolean;
    disableHighlightNeighborsOnHover?: boolean;
  }) => {
    const { graph } = this;
    const { minimap: minimapStore } = this.graph.explorerStore;
    const Graph = ForceGraph()(this.container);
    Graph.width(graph.rect.width);
    Graph.height(graph.rect.height);

    this.canvas = this.container.querySelector('canvas');
    Graph.d3Force('link')!
      .distance((d: { lineLength?: number }) => {
        return d.lineLength || LINE_LENGTH;
      })
      .strength(0.05);
    // 调整节点在 x 轴和 y 轴方向上的吸引力强度
    Graph.d3Force('x', forceX().strength(0.0085)); // 数值越小吸引力越小
    Graph.d3Force('y', forceY().strength(0.0085)); // 数值越小吸引力越小
    // 调整节点之间的排斥力强度
    Graph.d3Force('charge')!.strength(-80); // 负值表示排斥力，数值越小排斥力越小

    if (disableDoubleClickNode !== true) {
      Graph.onNodeDoubleClick((node) => {
        if (this.graph.loading) return;
        graph.replaceNodeSelected([node]);
        graph.queryRelation(ALL_EDGE_TYPE_KEY, EdgeDirectionType.AnyDirection, 1);
      });
    }
    if (disabledDoubleClickLink !== true) {
      Graph.onLinkDoubleClick(this.onLinkDoubleClick);
    }
    if (disableNodeHover !== true) {
      Graph.onNodeHover(
        throttle((node) => {
          graph.setHoveringNode(node || undefined);
        }, 300)
      );
    }
    if (disableLinkHover !== true) {
      Graph.onLinkHover(
        throttle((link) => {
          graph.setHoveringLink(link || undefined);
        }, 300)
      );
    }

    Graph.onZoom((v) => {
      this.setTransform(v);
      graph.setPointer({
        showContextMenu: false,
      });
      // refresh minimap
      // minimapStore.refresh({ nodes: [...graph.nodes], links: [...graph.links] });
      Graph.linkVisibility(() => false);
    })
      .d3AlphaDecay(0.01)
      .onZoomEnd(() =>
        Graph.linkVisibility((_link) => {
          return true;
        })
      )
      .minZoom(0.02)
      .nodeVal((node) => {
        // circle area
        return <number>(node.nodeArea || NODE_AREA);
      })
      .nodeRelSize(1)
      .linkDirectionalArrowLength(this.getArrowSize)
      .linkDirectionalArrowRelPos(1)
      .cooldownTicks(90)
      .onEngineStop(() => {
        minimapStore.refresh();
      })
      .onLinkClick((link, event) => {
        graph.setHoveringLink(undefined);
        const hasSelected = graph.linksSelected.has(link);
        if (event.ctrlKey || event.shiftKey || event.altKey) {
          hasSelected ? graph.clearLinksSelected([link]) : graph.selectLinks([link]);
          return;
        }
        graph.clearLinksSelected();
        graph.selectLinks([link]);
      })
      .nodeCanvasObjectMode(() => 'replace')
      .nodeCanvasObject((node, ctx) => {
        this.renderNode(node, ctx);
      })
      .onNodeClick((node, event) => {
        graph.setHoveringNode(undefined);
        graph.setPointer({
          showContextMenu: false,
        });
        const hasSelected = graph.nodesSelected.has(node);
        // multi-selection
        if (event.ctrlKey || event.shiftKey || event.altKey) {
          hasSelected ? graph.clearNodesSelected([node]) : graph.selectNodes([node]);
          return;
        }
        // single-selection
        graph.replaceNodeSelected([node]);
      })
      .onNodeRightClick((node, event) => {
        graph.selectNodes([node]);
        graph.setPointer({
          left: event.offsetX,
          top: event.offsetY,
          showContextMenu: true,
        });
      })
      .onLinkRightClick((link, event) => {
        graph.selectLinks([link]);
        graph.setPointer({
          left: event.offsetX,
          top: event.offsetY,
          showContextMenu: true,
        });
      })
      .onBackgroundClick(() => {
        graph.clearNodesSelected();
        graph.clearLinksSelected();
        graph.setHoveringNode(undefined);
        graph.setPointer({
          showContextMenu: false,
        });
      })
      .onBackgroundRightClick((event) => {
        if (graph.nodesSelected.size) {
          graph.setPointer({
            left: event.offsetX,
            top: event.offsetY,
            showContextMenu: true,
          });
        }
      })
      .onNodeDrag((node, translate) => {
        graph.updateShouldBlockRouter(true);
        if (!graph.nodesSelected.has(node)) {
          return;
        }
        graph.nodesSelected
          .toJSON()
          .filter((selNode) => selNode !== node) // don't touch node being dragged
          .forEach((node) =>
            (['x', 'y'] as const).forEach((coord) => {
              node[`f${coord}`] = (node[coord] || 0) + translate[coord];
              node[`${coord}`] = node[`f${coord}`];
            })
          );
        Graph.nodeColor(Graph.nodeColor());
      })
      .onNodeDragEnd((node) => {
        node.fx = node.x;
        node.fy = node.y;
        minimapStore.refresh();
      })
      .linkCurvature((link) => {
        // cuclate link's curvature by graphIndex
        let curvature = 0;
        if (link.source === link.target) {
          curvature = link.graphIndex as number;
        } else {
          const { graphIndex = 0 } = link;
          // the seem direction links will be the seem side
          if (graphIndex !== 0) {
            const direction = graphIndex % 2 === 0; // link's rank direction
            // (graphIndex / Math.abs(graphIndex)) means different source's direction
            curvature = (direction ? 1 : -1) * (graphIndex > 0 ? 1 : -1) * (Math.ceil(Math.abs(graphIndex) / 2) * 0.1);
          }
        }
        link.curvature = curvature;
        return curvature;
      })
      .linkColor(this.getLinkColor)
      .linkCanvasObjectMode(() => 'replace')
      .linkCanvasObject((link: LinkObject, ctx, _scale) => {
        this.renderLink(link, ctx);
      })
      .zoom(1.001);
    this.instance = Graph;
    this.autorunDisposer = reaction(
      () =>
        [
          graph.nodes.toJSON(), // 使用 toJS 以确保只在数据实际变化时进行计算
          graph.links.toJSON(),
          graph.vertexFilterStore.filteredInfoSize,
          graph.displayedNodePropertyItems.length,
          graph.displayedEdgePropertyItems.length,
          themeStore.mode,
        ] as const,
      ([nodes, links]) => {
        nodes.forEach((node) => {
          node.vx = 0;
          node.vy = 0;
        });
        const res = pipeline({ nodes: Array.from(nodes), links: links, graph: this.graph });
        const filterRes = this.applyFilters({
          nodes: res.nodes,
          links: res.links,
        });
        // reset node's v
        this.handleSelectedEntitiesAfterFilter();
        Graph.graphData({ nodes: filterRes.nodes, links: filterRes.links });
      }
    );

    // rerender?.
    this.reactionDisposer = reaction(
      () => [graph.nodeHovering, graph.linksSelected.toJSON(), graph.linkHovering, graph.nodesSelected.toJSON()],
      () => {
        Graph.nodeColor(Graph.nodeColor());
      }
    );
  };

  handleSelectedEntitiesAfterFilter = () => {
    const { graph } = this;
    const { vertexFilterStore } = this.graph;
    const { entityIdsHideSet, nodeTypeHideSet, edgeTypeHideSet } = vertexFilterStore;
    const selectedFilterNodes = graph.nodesSelected
      .toJSON()
      .filter((n: NodeObject) => entityIdsHideSet.has(n.id!))
      .filter((n: NodeObject) => nodeTypeHideSet.has(n.data.value.type));
    const selectedFilterEdges = graph.linksSelected
      .toJSON()
      .filter((l: LinkObject) => entityIdsHideSet.has(l.id!))
      .filter((l: LinkObject) => edgeTypeHideSet.has(l.id!));
    graph.unselectNodes(selectedFilterNodes);
    graph.unselectLinks(selectedFilterEdges);
  };

  applyFilters = (payload: { nodes: NodeObject[]; links: LinkObject[] }) => {
    const { nodes, links } = payload;
    const { entityIdsHideSet } = this.graph.vertexFilterStore;
    const filteredNodes = nodes.filter((n) => !entityIdsHideSet.has(n.id!));
    const filteredLinks = links
      .filter((l) => !entityIdsHideSet.has(l.id!))
      .filter((l) => {
        const sourceId = (l.source as NodeObject).id!;
        const targetId = (l.target as NodeObject).id!;
        return !entityIdsHideSet.has(sourceId) && !entityIdsHideSet.has(targetId);
      });
    return { nodes: filteredNodes, links: filteredLinks };
  };

  render = () => {
    this.graph.nodes.replace(this.graph.nodes.toJSON());
    this.graph.links.replace(this.graph.links.toJSON());
  };

  getLinkColor = (link: LinkObject): string => {
    const { source, target, color } = link;
    const commonColor = color === DEFAULT_LINK_COLOR ? this.theme.palette.vesoft.v2.text1 : (color as string);
    const isRelated = this.hoveringNodeNeibors.links.includes(link);
    const { entityIdsGreyScaledSet, nodeTypeGreyScaledSet, edgeTypeGreyScaledSet } = this.graph.vertexFilterStore;
    if (
      !this.graphSettings.disableHighlightNeighborsOnHover &&
      (entityIdsGreyScaledSet.has((source as NodeObject).id!) ||
        entityIdsGreyScaledSet.has((target as NodeObject).id!) ||
        entityIdsGreyScaledSet.has(link.id!) ||
        nodeTypeGreyScaledSet.has((source as NodeObject).data.value.type) ||
        nodeTypeGreyScaledSet.has((target as NodeObject).data.value.type) ||
        edgeTypeGreyScaledSet.has(link.data.value.type) ||
        (this.graph.nodeHovering && !isRelated) ||
        (this.graph.linkHovering && this.graph.linkHovering !== link))
    ) {
      return hexToRgba(commonColor, GREY_SCALE_ALPHA);
    }
    if (this.graph.linksSelected.has(link)) {
      return '#0091ff';
    }
    return commonColor;
  };

  getLinkWidth(link: LinkObject): number {
    const commonWidth = (link.lineWidth as number) || 1;
    if (this.graph.linksSelected.has(link)) {
      return commonWidth * 2;
    }
    return (link.lineWidth as number) || 1;
  }

  getArrowSize = (link: LinkObject): number => {
    if (!link.data.value.isDirected) {
      return 0;
    }
    if (this.transform.k < 0.9) {
      return 0;
    }
    if (link.lineWidth) {
      return (link.lineWidth as number) * 2;
    }
    return 6;
  };

  onLinkDoubleClick = (_link: LinkObject, _: MouseEvent) => {};

  // render link group
  renderLink = (link: LinkObject, ctx: CanvasRenderingContext2D) => {
    const shouldFiltered = this.graph.vertexFilterStore.entityIdsFilterInfo
      .get(VertexFilterDisplay.Hide)!
      .has(link.id!);
    if (shouldFiltered) {
      return;
    }
    const start = link.source as NodeObject;
    const end = link.target as NodeObject;
    if (
      !start ||
      !end ||
      !Object.prototype.hasOwnProperty.call(start, 'x') ||
      !Object.prototype.hasOwnProperty.call(end, 'x')
    )
      return; // skip invalid link
    ctx.save();
    ctx.beginPath();
    const controlPoints = link.__controlPoints as number[] | null;
    let bezier;
    const arrowSize =
      start.id === end.id
        ? 0
        : this.getArrowSize(link) + (end.nodeArea ? Math.sqrt(end.nodeArea as number) : NODE_SIZE) - 5;
    const createStroke = () => {
      if (!controlPoints) {
        const angle = Math.atan2(end.y! - start.y!, end.x! - start.x!);
        const xDis = arrowSize * Math.cos(angle);
        const yDis = arrowSize * Math.sin(angle);
        ctx.moveTo(start.x! + xDis, start.y! + yDis);
        // Straight line
        ctx.lineTo(end.x! - xDis, end.y! - yDis);
      } else {
        // Use quadratic curves for regular lines and bezier for loops
        // @ts-ignore
        bezier = new Bezier(start.x, start.y, ...controlPoints, end.x, end.y);
        const length = bezier.length();
        const t = (length - arrowSize) / length;
        const pos = bezier.get(t);
        ctx.moveTo(start.x!, start.y!);
        // @ts-ignore
        bezier = new Bezier(start.x, start.y, ...controlPoints, pos.x, pos.y);
        ctx[controlPoints.length === 2 ? 'quadraticCurveTo' : 'bezierCurveTo'](
          // @ts-ignore
          ...controlPoints,
          pos.x,
          pos.y
        );
      }
    };
    createStroke();
    const linkColor = this.getLinkColor(link);
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = this.getLinkWidth(link);
    ctx.fillStyle = 'transparent';
    if (link.animation) {
      ctx.setLineDash([5, 5]);
      const delta = (link.animationDelta as number) || 0;
      ctx.lineDashOffset = -delta * 200;
    }
    ctx.stroke();
    const isHovering = this.graph.linkHovering === link;
    const isRelated = this.hoveringNodeNeibors.links.includes(link);
    const strokeColor = themeStore.theme.palette.vesoft.v2.nodeColor1;
    if (isHovering || isRelated) {
      ctx.strokeStyle = hexToRgba(strokeColor, 0.3);
      ctx.lineWidth = 8;
      createStroke();
      ctx.stroke();
    }
    ctx.restore();

    this.renderLinkLabel(link, ctx, bezier, linkColor);

    if (!link.animation) return;
    this.renderParticesAnimation(link, ctx);
  };

  renderClusterLabel = (
    link: LinkObject,
    ctx: CanvasRenderingContext2D,
    textAngle: number,
    textPos: { x: number; y: number }
  ) => {
    const len = (link.clusters as unknown[])?.length || 0;
    const labels = `${link.edgeType}(x${len + 1})`;
    const fontsize = 10;
    ctx.font = `${fontsize}px`;
    const textRect = ctx.measureText(labels);
    ctx.save();
    ctx.translate(textPos.x, textPos.y);
    if (this.transform.k > 2) {
      ctx.scale(2 / this.transform.k, 2 / this.transform.k);
    }
    ctx.rotate(textAngle);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gap = 3;
    const verticalGap = 1;

    // count the number of lines
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      -textRect.width / 2 - gap,
      -fontsize / 2 - verticalGap / 2,
      textRect.width + gap * 2,
      fontsize + verticalGap
    );
    ctx.fillStyle = (link.color as string) || '#0091ff';
    ctx.fillText(labels, 0, 0);
    // prop calc label
    const clusterValue = (link.clusterValue as Record<string, { value: unknown }>) || {};
    if (clusterValue) {
      const keys = Object.keys(clusterValue);
      if (keys.length > 0) {
        const prop = keys[0];
        const value = clusterValue[prop].value;
        const propLabel = `${prop} = ${value}` + (keys.length > 1 ? '...' : '');
        const propLabelY = CLUSTER_LINE_WIDTH + 1 * verticalGap;
        ctx.fillStyle = 'darkgray';
        ctx.fillText(propLabel, 0, propLabelY);
      }
    }
    ctx.restore();
  };

  renderLinkLabel(link: LinkObject, ctx: CanvasRenderingContext2D, bezier?: Bezier, linkColor?: string) {
    const start = link.source as NodeObject;
    const end = link.target as NodeObject;

    const zoom = this.transform.k;
    const labels = (<string>link.label)?.split('\r\n') || [];
    if (!labels.length || zoom < LABEL_VISIBLE_ZOOM) return;
    if (typeof start !== 'object' || typeof end !== 'object') return;
    const { x: startX = 0, y: staryY = 0 } = start;
    const { x: endX = 0, y: endY = 0 } = end;
    // init text position
    const textPos: { x: number; y: number } = {
      x: (startX + endX) * 0.5,
      y: (staryY + endY) * 0.5,
    };
    // init link vector2
    const relLink = {
      x: endX - startX,
      y: endY - staryY,
    };
    // get bezier controlPoints from ForceGraph
    const controlPoints = link.__controlPoints as [number, number, number, number];
    if (link.curvature !== 0 && controlPoints) {
      // sometimes controlpoints not exist
      if (link.source === link.target) {
        relLink.x = controlPoints[2] - controlPoints[0];
        relLink.y = controlPoints[3] - controlPoints[1];
      }
      const bzLine = bezier;
      // get text pos if there ara bezier2 or bezier3 line
      if (bzLine) {
        const pos = bzLine.get(0.5);
        textPos.x = pos.x;
        textPos.y = pos.y;
      }
    }
    // caculate textAngle by vector
    let textAngle = Math.atan2(relLink.y, relLink.x);
    // make sure the angle in Web Axis
    if (textAngle > Math.PI / 2) textAngle = -(Math.PI - textAngle);
    if (textAngle < -Math.PI / 2) textAngle = -(-Math.PI - textAngle);
    // renderLabels
    let maxLabel = '';
    labels.forEach((each) => each.length > maxLabel.length && (maxLabel = each));
    const fontsize = FONT_SIZE;
    ctx.font = `${fontsize}px`;

    const textRect = ctx.measureText(maxLabel);
    ctx.save();
    ctx.translate(textPos.x, textPos.y);
    if (this.transform.k > 2) {
      ctx.scale(2 / this.transform.k, 2 / this.transform.k);
    }
    ctx.rotate(textAngle);
    ctx.strokeStyle = themeStore.theme.palette.vesoft.bgColor12;
    ctx.lineWidth = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const gap = 3;
    const verticalGap = 2;
    const totalHeight = labels.length * (FONT_SIZE + verticalGap) - verticalGap;
    const offsetY = totalHeight + 1;
    labels.forEach((each, index) => {
      ctx.fillStyle = 'transparent';

      const labelY = -offsetY + fontsize / 2 + index * (fontsize + verticalGap);
      ctx.fillRect(
        -textRect.width / 2 - gap,
        labelY - fontsize / 2 - verticalGap / 2,
        textRect.width + gap * 2,
        fontsize + verticalGap
      );
      ctx.fillStyle = linkColor || 'darkgray';
      ctx.fillText(each, 0, labelY);
    });
    ctx.restore();
  }

  renderNode = (node: NodeObject, ctx: CanvasRenderingContext2D) => {
    const { graph } = this;
    const shouldFilterd = graph.vertexFilterStore.entityIdsHideSet.has(node.id!);
    if (shouldFilterd) {
      return;
    }
    if (node.animation) {
      this.renderNodeAnimation(node, ctx);
    }
    const isHovering = graph.nodeHovering === node;
    const isSelected = graph.nodesSelected.has(node);
    const isLinkHoverRelatedNode = this.hovringLinkRelatedNodes.includes(node);
    const isRelated = isHovering || this.hoveringNodeNeibors.nodes.includes(node) || isLinkHoverRelatedNode;
    const shouldGreyScale =
      !this.graphSettings.disableHighlightNeighborsOnHover &&
      (graph.vertexFilterStore.entityIdsGreyScaledSet.has(node.id!) ||
        graph.vertexFilterStore.nodeTypeGreyScaledSet.has(node.data.value.type) ||
        (graph.nodeHovering && !isRelated) ||
        (graph.linkHovering && !isLinkHoverRelatedNode));
    const color = shouldGreyScale ? hexToRgba(node.color as string, GREY_SCALE_ALPHA) : (node.color as string);
    const nodeSize = typeof node.nodeArea === 'number' && node.nodeArea > 0 ? Math.sqrt(node.nodeArea) : NODE_SIZE;
    const strokeColor = themeStore.theme.palette.vesoft.v2.nodeColor1;
    ctx.fillStyle = color as string;
    ctx.strokeStyle = 'transparent';
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
    ctx.fill();
    if (isSelected) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = shouldGreyScale ? hexToRgba(strokeColor, GREY_SCALE_ALPHA) : strokeColor;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize + ctx.lineWidth / 2, 0, 2 * Math.PI, false);
      ctx.stroke();
      ctx.lineWidth = 8;
      ctx.strokeStyle = hexToRgba(strokeColor, 0.3);
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize + 4 + ctx.lineWidth / 2, 0, 2 * Math.PI, false);
      ctx.stroke();
    } else if (isHovering || isRelated) {
      ctx.lineWidth = 8;
      ctx.strokeStyle = hexToRgba(strokeColor, 0.3);
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize + ctx.lineWidth / 2, 0, 2 * Math.PI, false);
      ctx.stroke();
    }

    this.renderNodeLabel(node, ctx, nodeSize);
    this.renderNodeIcon(node, ctx, nodeSize, !!shouldGreyScale);
  };

  renderNodeLabel = (node: NodeObject, ctx: CanvasRenderingContext2D, nodeSize: number) => {
    const label = node.label as string;
    if (label && this.transform.k > LABEL_VISIBLE_ZOOM) {
      ctx.strokeStyle = 'transparent';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${FONT_SIZE}px Sans-Serif`;
      const labels = label.split('\r\n');
      labels.forEach((each, index) => {
        // calculate label position
        ctx.fillText(
          each.length > 60 ? each.slice(0, 60) + '...' : each,
          node.x!,
          node.y! + nodeSize + FONT_SIZE + index * (FONT_SIZE + 6)
        );
      });
    }
  };

  renderNodeIcon = (node: NodeObject, ctx: CanvasRenderingContext2D, nodeSize: number, shouldGreyScale: boolean) => {
    const imgText = node.img !== undefined ? node.img : node.iconText !== undefined ? node.iconText : '';

    // node.img is a key which value stores in imagesCache
    if (imgText && typeof imgText === 'string') {
      const imgVal = this.graph.imagesCache.get(imgText);
      //  instanceof Image || (typeof node.img === 'string' && node.img.startsWith('data:image/'))
      const size = (30 * (nodeSize - 4)) / NODE_SIZE;
      const x = node.x! - size / 2;
      const y = node.y! - size / 2;
      if (imgVal instanceof Image) {
        if (shouldGreyScale) {
          ctx.save();
          ctx.globalAlpha = GREY_SCALE_ALPHA;
          ctx.drawImage(imgVal, x, y, size, size);
          ctx.restore();
          return;
        } else {
          ctx.drawImage(imgVal, x, y, size, size);
        }
        return;
      }
      return;
    }
  };

  renderNodeAnimation(node: NodeObject, ctx: CanvasRenderingContext2D) {
    const nodeArea = node.nodeArea as number;
    const nodeSize = nodeArea ? Math.sqrt(nodeArea) : NODE_SIZE;
    const circleSize = nodeSize + 5;
    ctx.save();
    ctx.beginPath();
    const total = Math.PI * 2;
    const delta = (node.animationDelta as number) || 0;
    const ratio = 5 / 2;
    ctx.arc(node.x!, node.y!, nodeSize + (delta % 0.2) * ratio * circleSize, 0, total);
    ctx.fillStyle = `rgba(0, 145, 255, ${0.5 - (delta % 0.2) * ratio})`;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, circleSize, 0, total);
    ctx.strokeStyle = '#0091ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 5]);
    ctx.lineDashOffset = delta * 15 * 7;
    ctx.stroke();

    ctx.restore();
  }

  renderParticesAnimation(link: LinkObject, ctx: CanvasRenderingContext2D) {
    const start = link.source as Required<NodeObject>;
    const end = link.target as Required<NodeObject>;
    const bzLine = link.__controlPoints
      ? // @ts-ignore
        new Bezier(start.x, start.y, ...link.__controlPoints, end.x, end.y)
      : null;
    const photonNum = 5;
    ctx.save();
    ctx.fillStyle = (start.color as string) || '#0091ff';
    for (let i = 0; i < photonNum; i++) {
      ctx.beginPath();
      const delta = (link.animationDelta as number) || 0;
      const photonPosRatio = (delta + i / photonNum) % 1;
      const coords = bzLine
        ? bzLine.get(photonPosRatio) // get position along bezier line
        : {
            // straight line: interpolate linearly
            x: start.x + (end.x - start.x) * photonPosRatio || 0,
            y: start.y + (end.y - start.y) * photonPosRatio || 0,
          };
      ctx.arc(coords.x, coords.y, 3, 0, 2 * Math.PI, false);
      ctx.fill();
    }
    ctx.restore();
  }

  redraw = () => {
    const state = this.instance?.getState();
    state && (state.needsRedraw = true);
  };

  resize() {
    const { width, height } = this.graph.rect;
    this.instance.width(width);
    this.instance.height(height);
  }

  hide() {
    this.instance?.pauseAnimation();
    this.canvas && (this.canvas.style.visibility = 'hidden');
  }
  show() {
    this.instance.resumeAnimation();
    this.canvas && (this.canvas.style.visibility = 'visible');
  }

  reset() {
    this.instance.centerAt(0, 0);
    this.instance.zoom(1.01);
  }

  zoom = (type: 'out' | 'in') => {
    if (this.zoomFrame === undefined) {
      document.addEventListener('mouseup', this.onZoomMouseUp);
    }

    const scale = this.instance.zoom();
    const newScale = type === 'out' ? scale - 0.01 : type === 'in' ? scale + 0.01 : 1;
    this.instance.zoom(newScale);
    this.zoomFrame = requestAnimationFrame(() => {
      this.zoom(type);
    });
  };

  autoFit = () => {
    const boundingBox = [
      [Infinity, Infinity],
      [-Infinity, -Infinity],
    ];
    if (!this.graph.nodes.size) {
      this.instance.zoom(1.001);
      return;
    }
    this.graph.nodes.forEach((node) => {
      const x = node.fx ?? node.x ?? 0;
      const y = node.fy ?? node.y ?? 0;
      boundingBox[0][0] = Math.min(boundingBox[0][0], x);
      boundingBox[0][1] = Math.min(boundingBox[0][1], y);
      boundingBox[1][0] = Math.max(boundingBox[1][0], x);
      boundingBox[1][1] = Math.max(boundingBox[1][1], y);
    });

    const center = {
      x: (boundingBox[0][0] + boundingBox[1][0]) / 2,
      y: (boundingBox[0][1] + boundingBox[1][1]) / 2,
    };

    const { width, height } = this.graph.rect;
    const zoomK = Math.min(
      1.2,
      (width - 80) / (boundingBox[1][0] - boundingBox[0][0]),
      (height - 80) / (boundingBox[1][1] - boundingBox[0][1])
    );
    // 这里给所有的节点数据加上偏移量，避免做转换矩阵居中导致的节点实际坐标未居中
    this.graph.nodes.forEach((node) => {
      node.x = node.x! - center.x;
      node.y = node.y! - center.y;
      if (node.fx !== undefined) {
        node.fx = node.fx - center.x;
      }
      if (node.fy !== undefined) {
        node.fy = node.fy - center.y;
      }
    });
    this.instance.centerAt(0, 0, 500);
    this.instance.zoom(zoomK, 500);
  };

  onZoomMouseUp = () => {
    document.removeEventListener('mouseup', this.onZoomMouseUp);
    this.zoomFrame && cancelAnimationFrame(this.zoomFrame);
    this.zoomFrame = undefined;
  };

  /**
   * save stauts
   *
   * @returns
   */
  getData = () => {
    return {
      transform: { ...this.transform },
    };
  };

  setData = (data: { transform: ITransform }) => {
    const { transform } = data;
    if (!transform) return;
    const { k, x, y } = transform;
    this.instance.zoom(k, 0);
    this.instance.centerAt(x, y, 0);
  };

  /**
   * soft destroy
   */
  destroy() {
    this.autorunDisposer?.();
    this.autorunDisposer = undefined;
    this.reactionDisposer?.();
    this.reactionDisposer = undefined;
    document.removeEventListener('mouseup', this.onZoomMouseUp);
    if (this.zoomFrame) {
      cancelAnimationFrame(this.zoomFrame);
      this.zoomFrame = undefined;
    }
    this.instance?._destructor();
    this.canvas?.remove();
    this.canvas = null;
  }
}
