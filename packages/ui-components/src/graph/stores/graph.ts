import {
  action,
  computed,
  IReactionDisposer,
  isObservableSet,
  makeAutoObservable,
  observable,
  reaction,
  toJS,
} from 'mobx';
import { debounce } from '@mui/material/utils';
import {
  DEFAULT_EXPLORE_RULES,
  DEFAULT_RETURN_LIMIT,
  EMPTY_ICON,
  flattenGraphTableData,
  makeRoundPosition,
  NODE_AREA,
} from '../utils/base/index';
import type { LinkObject, NodeObject } from '@vesoft-inc/force-graph';
import { v5 as uuidv5 } from 'uuid';

import { IRules, ColorPicker, Pointer, SnapshotData, DisplayedPropertyItem, ConditionFilter } from '../types/explorer';
import { TwoGraphStore } from './two-graph';
import {
  EdgeValue,
  GraphDataTable,
  GraphDataTableValueType,
  GraphEdgeValue,
  GraphNodeValue,
  IDataMap,
  RawEntityType,
  VertexValue,
} from '../types/gql';
import { isEdgeNodeValue, parseEdgeValueToLinkObject, parseVertexValueToNodeObject } from '../utils/base/parseData';
import { isNullLike } from '../utils/base/dml';
import { convertBigNumberToString, getDirection, getPathPattern, parseValueByPropertyType } from '../utils/helpers';
import type { GraphWorkspaceStore } from './workspace';
import VertexFiltersStore from './vertexFilter';
import VertexFilterStore from './vertexFilter';
import {
  DescNodeTypeResult,
  downloadCSVFiles,
  EdgeDirectionType,
  extractEdgeByEdgeTypeName,
  GQLResult,
  GraphEntityType,
} from '@vesoft-inc/utils';
import { ALL_EDGE_TYPE_KEY, GraphLayoutType, PathFilterType, PathType } from '../constants';
import layouts from '../utils/layouts';
import type { QueryExecutor } from '../../shared/query';
import type { ModalStore } from '../../shared/Modal/index';
import { Settings4GraphStore } from '../../shared/Settings/constants';
import { RequestQueue } from '@vesoft-inc/utils';

const ORIGIN_HISTORY_STATE: SnapshotData = {
  nodes: [],
  links: [],
  nodesSelected: observable.set([] as NodeObject[], { deep: false }),
  linksSelected: observable.set([] as LinkObject[], { deep: false }),
  displayedEdgePropertyItems: observable.array<DisplayedPropertyItem>([], {
    deep: false,
  }),
  displayedNodePropertyItems: observable.array<DisplayedPropertyItem>([], {
    deep: false,
  }),
  filterList: observable.array<ConditionFilter>([], { deep: false }),
  nowDataMap: new Map(),
};

export class GraphStore {
  graphContainer: HTMLElement | null = null;
  nowDataMap: IDataMap = new Map();
  nodes = observable.set([] as NodeObject[], { deep: false });
  links = observable.set([] as LinkObject[], { deep: false });
  nodesSelected = observable.set<NodeObject>([], { deep: false });
  linksSelected = observable.set<LinkObject>([], { deep: false });
  nodeHovering?: NodeObject = undefined;
  linkHovering?: LinkObject = undefined;
  actionHistory = observable.array<SnapshotData>([ORIGIN_HISTORY_STATE], {
    deep: false,
  });
  historyIndex = 0;
  layout: GraphLayoutType = GraphLayoutType.Force;
  pointer: Pointer = { top: -1000, left: -1000, showContextMenu: false };
  rect = { width: 0, height: 0 };
  exploreRules: IRules = DEFAULT_EXPLORE_RULES;
  loading = false;
  imagesCache = new Map<string, string | HTMLImageElement>();
  twoGraph?: TwoGraphStore;
  displayedNodePropertyItems = observable.array<DisplayedPropertyItem>([], {
    deep: false,
  });
  displayedEdgePropertyItems = observable.array<DisplayedPropertyItem>([], {
    deep: false,
  });
  filterList = observable.array<ConditionFilter>([], { deep: false });

  nodeColorPicker = new ColorPicker();
  linkColorPicker = new ColorPicker('link');
  edgeTypes: string[] = [];
  actionHistoryDispose?: () => void;
  explorerStore: GraphWorkspaceStore;
  showBackGrid = true;
  vertexFilterStore: VertexFilterStore;
  filterListDisposer?: IReactionDisposer;
  shouldBlockRouter = false;

  modalStore?: ModalStore;
  requestQueue: RequestQueue;

  constructor(
    stores: {
      explorerStore: GraphWorkspaceStore;
      modalStore?: ModalStore;
    },
    public options: {
      execGql: QueryExecutor;
      settingsGetter?: () => Settings4GraphStore;
      requestQueue: RequestQueue;
    }
  ) {
    makeAutoObservable(this, {
      graphContainer: observable.ref,
      nodeHovering: observable.ref,
      linkHovering: observable.ref,
      pointer: observable.ref,
      actionHistory: observable.shallow,
      twoGraph: observable.ref,
      nowDataMap: false,
      imagesCache: false,
      actionHistoryDispose: false,
      // actions
      setGraphContainer: action,
      resize: false,
      // computed
      nodeColorMap: computed,
    });
    this.vertexFilterStore = new VertexFiltersStore(this);
    this.explorerStore = stores.explorerStore;
    this.modalStore = stores.modalStore;
    this.requestQueue = options.requestQueue;
    this.filterListDisposer = reaction(
      () => this.filterList.slice(),
      () => {
        this.vertexFilterStore.handleGraphFilter();
      }
    );
  }

  get isEmpty() {
    return this.nodes.size === 0 && this.links.size === 0;
  }

  get selectedVertexes(): VertexValue[] {
    return Array.from(this.nodesSelected).map(({ data }) => data as VertexValue);
  }

  get nodeColorMap() {
    return this.nodeColorPicker.colorMap;
  }

  get message() {
    return this.modalStore?.message;
  }

  get historyLength() {
    return this.actionHistory.length;
  }

  get enabledFilterConditionNum() {
    return this.filterList.filter((item) => item.enable).length;
  }

  get selectedNodeIds() {
    return Array.from(this.nodesSelected).map((node) => node.id!);
  }

  get selectedLinkIds() {
    return Array.from(this.linksSelected).map((link) => link.id!);
  }

  get hasEntitySelected() {
    return this.nodesSelected.size > 0 || this.linksSelected.size > 0;
  }

  get selectedNodesTypeCountMap() {
    return Array.from(this.nodesSelected).reduce((map, cur) => {
      const key = cur.data.value.type;
      if (!map.has(key)) {
        map.set(key, { items: [], count: 0 });
      }
      const obj = map.get(key)!;
      map.set(key, { items: obj.items.concat([cur]), count: obj.count + 1 });
      return map;
    }, new Map<string, { items: NodeObject[]; count: number }>());
  }

  get selectedEdgesTypeCountMap() {
    return Array.from(this.linksSelected).reduce((map, cur) => {
      const key = cur.data.value.type;
      if (!map.has(key)) {
        map.set(key, { items: [], count: 0 });
      }
      const obj = map.get(key)!;
      map.set(key, { items: obj.items.concat([cur]), count: obj.count + 1 });
      return map;
    }, new Map<string, { items: LinkObject[]; count: number }>());
  }

  get querySettings() {
    const settings = this.options.settingsGetter?.();
    return {
      ...settings,
      maxRowsLimit: settings?.maxRowsLimit ?? DEFAULT_RETURN_LIMIT,
    };
  }

  setSelectedNodeIds = (ids: string[]) => {
    const nodes = Array.from(this.nodes).filter((node) => ids.includes(node.id!));
    this.replaceNodeSelected(nodes);
  };

  toSnapShotData = () => {
    const data = (() => {
      const { actionHistory, pointer, imagesCache: imgCacheMap, ...otherAttrs } = this || {};
      // Map<string, Image> --> Array<[string, base64String]>
      const imagesCache = [...imgCacheMap.entries()].map(([key, img]) => [key, (img as HTMLImageElement).src]);
      return Object.keys(otherAttrs).reduce(
        (ret, key) => {
          // @ts-expect-error
          ret[key] = isObservableSet(otherAttrs[key])
            ? // @ts-ignore
              [...otherAttrs[key]]
            : // @ts-ignore
              toJS(otherAttrs[key]);
          return ret;
        },
        // SAFETY: the seed only carries `imagesCache`; the reducer fills in the remaining
        // `SnapshotData` keys from the store's own attributes.
        { imagesCache } as unknown as SnapshotData
      );
    })();

    return data;
  };

  initDisplayedNodePropertyItems = () => {
    const { graphTypeDetails, nodeTypePrimaryKeysMap } = this.explorerStore;
    if (!graphTypeDetails) return;
    if (this.displayedNodePropertyItems.length) return;
    const displayedNodePropertyItems = graphTypeDetails
      .filter((item) => item.entity_type === GraphEntityType.Node)
      .map((item) => ({
        type_name: item.type_name,
        properties: item.properties.filter((p) => nodeTypePrimaryKeysMap.get(item.type_name)!.includes(p)),
      }));
    this.displayedNodePropertyItems.replace(displayedNodePropertyItems);
  };

  initDisplayedEdgePropertyItems = () => {
    const { graphTypeDetails, edgeTypeMultiEdgeKeyMap } = this.explorerStore;
    if (!graphTypeDetails) return;
    if (this.displayedNodePropertyItems.length) return;
    const displayedEdgePropertyItems = graphTypeDetails
      .filter((item) => item.entity_type === GraphEntityType.Edge)
      .map((item) => ({
        type_name: item.type_name,
        properties: item.properties.filter((p) => edgeTypeMultiEdgeKeyMap.get(item.type_name)!.includes(p)),
      }));
    this.displayedEdgePropertyItems.replace(displayedEdgePropertyItems);
  };

  updateFilterList = (filterList: ConditionFilter[]) => {
    this.filterList.replace(filterList);
  };

  recoverSnapShotData = (data: SnapshotData) => {
    this.unsafeAction((store) => {
      store.nodes.replace(data.nodes);
      // store.links.replace(data.links.filter(l => (l.source as NodeObject)?.id && (l.target as NodeObject)?.id));
      store.links.replace(data.links);
      store.nodesSelected.replace(data.nodesSelected);
      store.linksSelected.replace(data.linksSelected);
      store.displayedNodePropertyItems.replace(data.displayedNodePropertyItems);
      store.displayedEdgePropertyItems.replace(data.displayedEdgePropertyItems);
      store.nowDataMap = data.nowDataMap;
      store.imagesCache = new Map(data.imagesCache);
      store.filterList.replace(data.filterList.map((f) => new ConditionFilter(f)));
      store.nodeColorPicker.initColorMap(
        Array.from(data.nodes).map((node) => ({
          key: node.data.value.type,
          defaultColor: node.color as string,
        }))
      );
      store.linkColorPicker.initColorMap(
        Array.from(data.links).map((link) => ({
          key: link.data.value.type,
          defaultColor: link.color as string,
        }))
      );
    });
  };

  recorverHistoryData = (data: SnapshotData) => {
    this.unsafeAction((store) => {
      store.nodes.replace(data.nodes);
      store.links.replace(data.links);
      store.nodesSelected.replace(data.nodesSelected);
      store.linksSelected.replace(data.linksSelected);
      store.nowDataMap = data.nowDataMap;
    });
  };

  unsafeAction = (fn: (store: this) => void, name = 'unsafeAction') => action(name, () => fn(this))();

  setSelectedNodesByType = (nodeType: string) => {
    const nodes = Array.from(this.nodes).filter((node) => node.data.value.type === nodeType);
    this.replaceNodeSelected(nodes);
  };

  setUnSelectedNodesByType = (nodeType: string) => {
    const nodes = Array.from(this.nodes).filter((node) => node.data.value.type === nodeType);
    this.clearNodesSelected(nodes);
  };

  setSelectedEdgesByType = (edgeType: string) => {
    const links = Array.from(this.links).filter((link) => link.data.value.type === edgeType);
    this.replaceLinksSelected(links);
  };

  setUnSelectedEdgesByType = (edgeType: string) => {
    const links = Array.from(this.links).filter((link) => link.data.value.type === edgeType);
    this.clearLinksSelected(links);
  };

  // addNodes = (nodes: NodeObject[]) => {
  //   nodes.forEach((node) => {
  //     const id = node.id!;
  //     const key = `${node.data.type}-${node.data.value.type}`;
  //     node.color = node.color || this.nodeColorPicker.whichColor(key);
  //     if (!this.nowDataMap.has(id)) {
  //       this.nowDataMap.set(id, node);
  //       this.nodes.add(node);
  //       return;
  //     }

  //     const { id: _id, ...others } = node;
  //     this.nowDataMap.set(id, Object.assign(this.nowDataMap.get(id)!, others));
  //   });
  // };

  // addLinks = (links: LinkObject[]) => {
  //   links.forEach((link) => {
  //     const id = link.id!;
  //     const key = `${link.data.type}-${link.data.value.type}`;
  //     link.color = link.color || this.linkColorPicker.whichColor(key);
  //     if (!this.nowDataMap.has(link.id!)) {
  //       this.nowDataMap.set(link.id!, link);
  //       this.links.add(link);
  //       return;
  //     }
  //     const { id: _id, ...others } = link;
  //     this.nowDataMap.set(id, Object.assign(this.nowDataMap.get(id)!, others));
  //   });
  // };

  updateNodes = (nodes: NodeObject[]) => {
    this.nodes.replace(nodes);
  };

  updateLinks = (links: LinkObject[]) => {
    this.links.replace(links);
  };

  updateNodeDisplayedPropertyItems = (items: DisplayedPropertyItem[]) => {
    this.displayedNodePropertyItems.replace(items);
  };

  updateEdgeDisplayedPropertyItems = (items: DisplayedPropertyItem[]) => {
    this.displayedEdgePropertyItems.replace(items);
  };

  setGraphContainer = (graphContainer: HTMLElement | null) => {
    this.graphContainer = graphContainer;
  };

  setPageLoading = (loading: boolean) => {
    this.loading = loading;
  };

  setPointer = (pointer: Partial<Pointer>) => {
    if (this.pointer.showContextMenu && pointer.showContextMenu === undefined) {
      return;
    }
    const next: Pointer = {
      ...this.pointer,
      ...pointer,
    };
    if (
      next.top === this.pointer.top &&
      next.left === this.pointer.left &&
      next.showContextMenu === this.pointer.showContextMenu &&
      next.event === this.pointer.event &&
      next.source === this.pointer.source
    ) {
      return;
    }
    this.pointer = next;
  };

  closeContextMenu = () => {
    this.setPointer({ showContextMenu: false });
  };

  updateShouldBlockRouter = (shouldBlockRouter: boolean) => {
    this.shouldBlockRouter = shouldBlockRouter;
  };

  dismissSelected = () => {
    const ids = [...this.selectedNodeIds, ...this.selectedLinkIds];
    ids.forEach((id) => this.vertexFilterStore.entityIdsGreyScaledSet.add(id));
    this.nodesSelected.clear();
    this.linksSelected.clear();
    this.closeContextMenu();
  };

  restoreSelected = () => {
    const ids = [...this.selectedNodeIds, ...this.selectedLinkIds];
    ids.forEach((id) => this.vertexFilterStore.entityIdsGreyScaledSet.delete(id));
    this.nodesSelected.clear();
    this.linksSelected.clear();
    this.closeContextMenu();
  };

  unselectNodes = (nodes?: NodeObject[]) => {
    nodes ? nodes.forEach((node) => this.nodesSelected.delete(node)) : this.nodesSelected.clear();
  };

  selectNodes = (nodes: NodeObject[]) => {
    nodes.forEach((node) => this.nodesSelected.add(node));
  };

  replaceNodeSelected = (nodes: NodeObject[]) => {
    this.nodesSelected.replace(nodes);
  };

  clearNodesSelected = (nodes?: NodeObject[]) => {
    nodes ? nodes.forEach((node) => this.nodesSelected.delete(node)) : this.nodesSelected.clear();
  };

  setHoveringNode = (node?: NodeObject) => {
    if (node === this.nodeHovering) return;
    this.nodeHovering = node;
  };

  selectLinks = (links: LinkObject[]) => {
    links.forEach((link) => this.linksSelected.add(link));
  };
  replaceLinksSelected = (links: LinkObject[]) => {
    this.linksSelected.replace(links);
  };
  clearLinksSelected = (links?: LinkObject[]) => {
    links ? links.forEach((link) => this.linksSelected.delete(link)) : this.linksSelected.clear();
  };

  setHoveringLink = (link?: LinkObject) => {
    if (this.linkHovering === link) return;
    this.linkHovering = link;
  };
  unselectLinks = (links?: LinkObject[]) => {
    links ? links.forEach((link) => this.linksSelected.delete(link)) : this.linksSelected.clear();
  };
  initData = ({ nodes = [], links = [] }: { nodes?: NodeObject[]; links?: LinkObject[] } = {}) => {
    if (nodes) this.nodes.replace(nodes);
    if (links) this.links.replace(links);
    this.nodesSelected.clear();
    this.linksSelected.clear();
    this.nowDataMap = [...nodes, ...links].reduce((acc, cur) => {
      acc.set(cur.id!, cur);
      return acc;
    }, new Map() as IDataMap);
  };

  undo = () => {
    if (this.historyIndex <= 0) {
      return;
    }
    this.historyIndex--;
    const nowData = this.actionHistory[this.historyIndex];
    // reset sider filter: vertexFilters, tagFilteredSet
    if (!nowData) {
      throw new Error(`Invalid history index: ${this.historyIndex}`);
    }
    const storeData = this.recorverHistoryData(nowData);
    this.unsafeAction((store) => Object.assign(store, storeData));
  };

  redo = () => {
    if (this.historyIndex >= this.actionHistory.length - 1) {
      console.warn(`Invalid history index: ${this.historyIndex} >= ${this.actionHistory.length - 1}`);
      return;
    }

    this.historyIndex++;
    const nowData = this.actionHistory[this.historyIndex];
    if (!nowData) {
      throw new Error(`Invalid history index: ${this.historyIndex}`);
    }
    const storeData = this.recorverHistoryData(nowData);
    this.unsafeAction((store) => Object.assign(store, storeData));
  };

  pushHistory = () => {
    const snapshot = {
      nodes: this.nodes.toJSON(),
      links: this.links.toJSON(),
      nodesSelected: this.nodesSelected.toJSON(),
      linksSelected: this.linksSelected.toJSON(),
      nowDataMap: new Map(Array.from(this.nowDataMap)),
    };
    // SAFETY: the history entry is a detached JSON snapshot; `nodesSelected`/`linksSelected`
    // are reshaped back into observable sets when the entry is restored.
    this.actionHistory.push(snapshot as unknown as SnapshotData);
    this.historyIndex++;
  };

  deleteNodesAndEdges = ({ reverse = false }) => {
    this.updateShouldBlockRouter(true);
    const newNodes: NodeObject[] = [];
    let newEdges = [...this.links];
    const selectEdgeIds: string[] = [];
    this.nodes.forEach((node) => {
      if (reverse ? this.nodesSelected.has(node) : !this.nodesSelected.has(node)) {
        newNodes.push(node);
      }
    });
    this.linksSelected.forEach((link) => {
      selectEdgeIds.push(link.id!);
      if (link.isCluster) {
        const clusters = link.clusters as string[];
        clusters.forEach((cluster) => {
          selectEdgeIds.push(cluster);
        });
      }
    });
    newEdges = newEdges.filter((link) =>
      reverse
        ? this.nodesSelected.has(link.source as NodeObject) &&
          this.nodesSelected.has(link.target as NodeObject) &&
          selectEdgeIds.includes(link.id!)
        : !this.nodesSelected.has(link.source as NodeObject) &&
          !this.nodesSelected.has(link.target as NodeObject) &&
          !selectEdgeIds.includes(link.id!)
    );
    this.initData({ nodes: newNodes, links: newEdges });
    if (!reverse) {
      this.nodesSelected.clear();
      this.linksSelected.clear();
      this.setHoveringNode(undefined);
    }
    this.pushHistory();
  };

  deleteSelectedElements = () => {
    const nextLinks = this.links.toJSON().filter((link) => {
      const isSelected = !this.linksSelected.has(link);
      const { source, target } = link;
      const sourceNode = typeof source === 'object' ? source : (this.nowDataMap.get(source as string) as NodeObject);
      const targetNode = typeof target === 'object' ? target : (this.nowDataMap.get(target as string) as NodeObject);
      return isSelected || this.nodesSelected.has(sourceNode) || this.nodesSelected.has(targetNode);
    });
    const nextNodes = this.nodes.toJSON().filter((node) => !this.nodesSelected.has(node));

    this.initData({ nodes: nextNodes, links: nextLinks });
  };

  /**
   * Edit mode: place freshly created nodes at the center of the current viewport.
   */
  moveNodesToViewportCenter = (nodes: NodeObject[]) => {
    const { instance } = this.twoGraph || {};
    const { width, height } = this.rect;
    if (!instance || !width || !height || !nodes.length) return;
    const center = instance.screen2GraphCoords(width / 2, height / 2);
    nodes.forEach((node) => {
      node.x = center.x;
      node.y = center.y;
      node.fx = center.x;
      node.fy = center.y;
      node.vx = 0;
      node.vy = 0;
    });
    this.updateNodes([...this.nodes]);
  };

  /**
   * Edit mode: reflect successfully persisted property changes on the canvas.
   * Raw form values are converted with the schema's property type.
   */
  applyEntityProperties = (entity: NodeObject | LinkObject, values: Record<string, string | null | undefined>) => {
    const value = entity.data?.value;
    if (!value) return;
    const entityType = entity.data.type === RawEntityType.EDGE ? GraphEntityType.Edge : GraphEntityType.Node;
    const typeDetail = this.explorerStore.graphTypeDetails?.find(
      (item) => item.type_name === value.type && item.entity_type === entityType
    );
    const properties = value.properties as Record<string, unknown>;
    Object.entries(values).forEach(([propertyName, rawValue]) => {
      const propertyInfo = typeDetail?.propertyInfos?.find((item) => item.property_name === propertyName);
      if (!propertyInfo) return;
      properties[propertyName] = isNullLike(rawValue)
        ? null
        : parseValueByPropertyType(String(rawValue), propertyInfo.data_type, false);
    });
    if (entity.data.type === RawEntityType.NODE) {
      const node = entity as NodeObject;
      node.label = this.explorerStore.nodeTypePrimaryKeysMap
        .get(node.data.value.type)
        ?.map((key) => properties[key])
        .join(' ');
    }
    this.twoGraph?.render();
    this.explorerStore.minimap.refresh();
  };

  /**
   * Edit mode: drop successfully deleted elements from the canvas.
   * Deleting a node also drops every edge attached to it.
   */
  removeEntities = ({ nodes = [], links = [] }: { nodes?: NodeObject[]; links?: LinkObject[] }) => {
    const nodeSet = new Set(nodes);
    const linkSet = new Set(links);
    const nextNodes = this.nodes.toJSON().filter((node) => !nodeSet.has(node));
    const nextLinks = this.links.toJSON().filter((link) => {
      if (linkSet.has(link)) return false;
      const source = typeof link.source === 'object' ? (link.source as NodeObject) : undefined;
      const target = typeof link.target === 'object' ? (link.target as NodeObject) : undefined;
      return !nodeSet.has(source as NodeObject) && !nodeSet.has(target as NodeObject);
    });

    this.unsafeAction((store) => {
      nodeSet.forEach((node) => store.nodesSelected.delete(node));
      linkSet.forEach((link) => store.linksSelected.delete(link));
      store.nodes.replace(nextNodes);
      store.links.replace(nextLinks);
      store.nowDataMap = new Map<string, NodeObject | LinkObject>(
        [...nextNodes, ...nextLinks].map((item) => [item.id!, item])
      );
      store.nodeHovering = undefined;
      store.linkHovering = undefined;
    });
    this.twoGraph?.render();
    this.explorerStore.minimap.refresh();
  };

  initGraph = ({
    container,
    graphSettings,
  }: {
    container: HTMLElement;
    graphSettings: Parameters<TwoGraphStore['init']>[0];
  }) => {
    this.setGraphContainer(container as HTMLDivElement);
    this.resize();
    this.twoGraph = new TwoGraphStore(this, container, graphSettings);
    window.addEventListener('resize', this.resize);
  };

  setLayout = async (layout: GraphLayoutType) => {
    this.layout = layout;
    this.setPageLoading(true);
    setTimeout(async () => {
      await layouts[layout](this);
      this.twoGraph?.autoFit();
      this.explorerStore.minimap.refresh();
      this.setPageLoading(false);
    }, 200);
  };

  changeNodesSelectedColor = ({ color }: { color: string }) => {
    this.updateShouldBlockRouter(true);
    this.nodesSelected.forEach((node) => {
      const nodeData = this.nowDataMap.get(node.id!);
      if (nodeData) {
        nodeData.color = color;
      }
    });
    this.updateNodes([...this.nodes]);
  };

  // `size` setting is disabbled in sider extending component
  changeNodesSelectedSize = ({ size }: { size: number }) => {
    this.updateShouldBlockRouter(true);
    this.nodesSelected.forEach((node) => {
      const nodeData = this.nowDataMap.get(node.id!);
      if (nodeData) {
        nodeData.nodeArea = size * NODE_AREA;
      }
    });
    this.updateNodes([...this.nodes]);
  };

  changeNodesSelectedIcon = ({ iconId, icon }: { iconId: string; icon: string }) => {
    this.updateShouldBlockRouter(true);
    const modeFun = (id?: string) => {
      this.nodesSelected.forEach((node) => {
        const nodeData = this.nowDataMap.get(node.id!);
        if (nodeData) {
          nodeData.img = undefined;
          nodeData.iconText = id;
        }
      });
      this.updateNodes([...this.nodes]);
    };

    if (iconId === EMPTY_ICON) {
      modeFun();
      return;
    }

    if (!this.imagesCache.get(iconId)) {
      const base64url = `data:image/svg+xml;utf8,${encodeURIComponent(icon)}`;
      const img = new Image();
      img.onload = () => {
        this.imagesCache.set(iconId, img);
        modeFun(iconId);
      };
      img.src = base64url;
      return;
    }

    modeFun(iconId);
  };

  addImageCache = (k: string, v: string | HTMLImageElement) => this.imagesCache.set(k, v);

  changeNodesSelectedImage = ({ img }: { img?: HTMLImageElement; mode?: 'normal' | 'filter' }) => {
    const imgId = img && uuidv5(img.src, uuidv5.URL);
    imgId && this.addImageCache(imgId, img);

    // if (mode === 'filter') {
    //   this.update({ exploreRules: { ...this.exploreRules, customImageId: imgId } });
    //   return;
    // }
    this.updateShouldBlockRouter(true);
    this.nodesSelected.forEach((node) => {
      const nodeData = this.nowDataMap.get(node.id!);
      if (nodeData) {
        nodeData.iconText = undefined;
        nodeData.img = imgId;
      }
    });
    this.updateNodes([...this.nodes]);
  };

  changeLinksSelectedColor = ({ color }: { color: string }) => {
    this.updateShouldBlockRouter(true);
    this.linksSelected.forEach((link) => {
      const edgeData = this.nowDataMap.get(link.id!);
      if (edgeData) {
        edgeData.color = color;
      }
    });
    this.updateLinks([...this.links]);
  };

  changeLinksSelectedSize = ({ lineWidth }: { lineWidth: number }) => {
    this.updateShouldBlockRouter(true);
    this.linksSelected.forEach((link) => {
      const edgeData = this.nowDataMap.get(link.id!);
      if (edgeData) {
        edgeData.lineWidth = lineWidth;
      }
    });
    this.updateLinks([...this.links]);
  };

  resetData = () => {
    this.nodes.clear();
    this.links.clear();
    this.nodesSelected.clear();
    this.linksSelected.clear();
    this.nowDataMap.clear();
    this.actionHistory.replace([ORIGIN_HISTORY_STATE]);
    this.historyIndex = 0;
    this.nodeHovering = undefined;
    this.linkHovering = undefined;
    this.pointer = { top: 0, left: 0, showContextMenu: false };
    this.rect = { width: 0, height: 0 };
    this.loading = false;
    this.imagesCache.clear();
    this.nodeColorPicker.clear();
    this.linkColorPicker.clear();
    this.actionHistoryDispose = undefined;
  };

  destroyGraph = () => {
    window.removeEventListener('resize', this.resize);
    this.twoGraph?.destroy();
    this.twoGraph = undefined;
    this.resetData();
    this.filterListDisposer?.();
    this.filterListDisposer = undefined;
  };

  filterDupLinks = (links: LinkObject[]) => {
    const map = new Map<string, LinkObject>();
    links.forEach((link) => {
      const key = link.id!;
      if (!this.nowDataMap.has(key) && !map.has(key)) {
        map.set(key, link);
      }
    });
    return Array.from(map.values());
  };

  upsertNodesAndEdges = (payload: {
    vertexes: NodeObject[];
    edges: LinkObject[];
    shouldNodeSelected?: boolean;
    shouldLinkSelected?: boolean;
    /** Edit mode writes to the database directly, so it must not enter the canvas undo stack. */
    shouldPushHistory?: boolean;
  }) => {
    const {
      vertexes = [],
      edges = [],
      shouldNodeSelected = false,
      shouldLinkSelected = false,
      shouldPushHistory = true,
    } = payload;
    let hasExistedData = false;
    const filteredDupEdges = this.filterDupLinks(edges);
    const nowDataMap: Map<string, NodeObject | LinkObject> = new Map();
    this.links.forEach((item) => {
      const link = item;
      nowDataMap.set(link.id!, item);
    });
    this.nodes.forEach((item) => {
      const node = item;
      nowDataMap.set(node.id!, item);
    });

    // search exsit nodes & update it
    vertexes.forEach((node) => {
      node.id = convertBigNumberToString(node.id!);
      if (nowDataMap.has(node.id!)) {
        const { color: _color, id: _id, ...others } = node;
        hasExistedData = true;
        const nodeItem = nowDataMap.get(node.id!);
        if (nodeItem) {
          Object.assign(nodeItem, others);
        }
      } else {
        nowDataMap.set(node.id!, node);
        this.nodes.add(node);
      }
    });
    (filteredDupEdges as LinkObject[]).forEach((link: LinkObject) => {
      if (nowDataMap.has(link.id!)) {
        const { source: _source, target: _target, color: _color, ...others } = link;
        hasExistedData = true;
        const linkItem = nowDataMap.get(link.id!);
        if (linkItem) {
          Object.assign(linkItem, others);
        }
      } else {
        this.links.add(link);
        nowDataMap.set(link.id!, link);
      }
    });
    // make auto circle layout by selected nodes
    const selectNodesMap = new Map<string, Set<NodeObject>>();
    this.nodesSelected.forEach((node) => {
      selectNodesMap.set(node.id!, new Set());
    });
    edges.forEach((edge) => {
      const { source, target } = edge as LinkObject;
      const sourceId = source as string;
      const targetId = target as string;
      const selectedSourceNodes = selectNodesMap.get(sourceId);
      const targetNode = this.nowDataMap.get(targetId);
      if (selectedSourceNodes && !targetNode) {
        selectedSourceNodes.add(nowDataMap.get(targetId)! as NodeObject);
      }
      const selectedTargetNodes = selectNodesMap.get(targetId);
      const sourceNode = this.nowDataMap.get(sourceId) as NodeObject;
      if (selectedTargetNodes && !sourceNode) {
        selectedTargetNodes.add(sourceNode);
      }
    });
    for (const nodeId in selectNodesMap) {
      const selectNode = selectNodesMap.get(nodeId);
      const nowData = nowDataMap.get(nodeId);
      if (selectNode)
        makeRoundPosition(selectNode, {
          x: (nowData?.x as number) || 0,
          y: (nowData?.y as number) || 0,
        });
    }
    // replace selected object
    if (shouldNodeSelected && vertexes.length) {
      this.nodesSelected.replace([
        ...vertexes
          // .filter((node) => selectNodesMap.get(node.id!))
          .map((node) => (nowDataMap.get(node.id!) as NodeObject) || node),
      ]);
    }
    if (shouldLinkSelected && edges.length) {
      this.linksSelected.replace([...edges.map((edge) => (nowDataMap.get(edge.id!) as LinkObject) || edge)]);
    }
    // triggered manually to update the properties of existing nodes or edges
    hasExistedData && this.twoGraph?.render();
    // makesure there are new nodes
    if (nowDataMap.size === this.nowDataMap.size) {
      return;
    }

    // make newest data map
    this.nowDataMap = nowDataMap;
    shouldPushHistory && this.pushHistory();
  };

  getExploreInfo = async (payload: {
    data: { vertexes: NodeObject[]; edges: LinkObject[] };
    expand?: Partial<{
      vertexStyle: string;
      customColor: string;
      customIcon: string;
      customImageId: string;
    }>;
    autoRoundLayout?: boolean;
    shouldNodeSelected?: boolean;
    shouldLinkSelected?: boolean;
  }) => {
    const { data, shouldNodeSelected, shouldLinkSelected, autoRoundLayout = true } = payload;
    const { vertexes, edges } = data;
    if (autoRoundLayout && this.nodes.size === 0 && vertexes.length !== 1) {
      makeRoundPosition(vertexes, { x: 0, y: 0 });
    }
    const _edges = edges.flat();
    this.upsertNodesAndEdges({
      vertexes,
      edges: _edges,
      shouldNodeSelected,
      shouldLinkSelected,
    });
  };

  queryNode = async (nodeType: string, property: DescNodeTypeResult, values: string[]) => {
    const graph = this.explorerStore.currentSnapshot?.graph;
    if (!graph) {
      throw new Error('no graph found');
    }
    const gql = `/*+ SET_VAR(prune_vector_properties = true) */ USE \`${graph}\` MATCH (v@\`${nodeType}\` where v.\`${property.property_name}\` in LIST[${values.map((v) => parseValueByPropertyType(v, property.data_type))}]) return v limit ${this.querySettings.maxRowsLimit}`;
    this.execGqlAndUpdateGraph(gql);
  };

  queryRelation = async (
    edgeTypes: string[] | typeof ALL_EDGE_TYPE_KEY,
    direction: EdgeDirectionType,
    minStep: number,
    maxStep?: number
  ) => {
    const graph = this.explorerStore.currentSnapshot?.graph;
    if (!graph) {
      throw new Error('no graph found');
    }
    const { nodesSelected } = this;
    if (nodesSelected.size === 0) {
      throw new Error('no selected nodes');
    }
    const directions = getDirection(direction);
    const nodeIds = Array.from(nodesSelected)
      .map((node) => node.id)
      .join(',');
    const stepRange = `${minStep}${maxStep ? ',' + maxStep : ''}`;
    const edgeCondition =
      typeof edgeTypes === 'string' && edgeTypes === ALL_EDGE_TYPE_KEY
        ? ''
        : ` where type(e) in [${Array.isArray(edgeTypes) ? edgeTypes.map((type: string) => `"${type}"`).join(',') : ''}]`;
    const edgeWithSampleClause = this.getSampleClause(`e`, {
      sampleDirection: 'RIGHT',
      skipSample: this.shouldSkipSample(edgeTypes, direction),
    });
    const edgeWithCondition = `${edgeWithSampleClause}${edgeCondition}`;

    const gql = `/*+ SET_VAR(prune_vector_properties = true) */ PARAMETERS $ids= LIST[${nodeIds}] USE \`${graph}\` MATCH p = (v where element_id(v) in $ids) ${directions[0]}[${edgeWithCondition}]${directions[1]}{${stepRange}}(v1) return p limit ${this.querySettings.maxRowsLimit}`;

    this.execGqlAndUpdateGraph(gql, {
      shouldNodeSelected: true,
      shouldLinkSelected: true,
    });
  };

  queryPath = async (params: {
    sourceNode: NodeObject;
    targetNode: NodeObject;
    edgeTypes: string[] | typeof ALL_EDGE_TYPE_KEY;
    direction: EdgeDirectionType;
    pathType: PathType;
    pathFilterType: PathFilterType;
    minStep: number;
    maxStep?: number;
  }) => {
    const graph = this.explorerStore.currentSnapshot?.graph;
    if (!graph) {
      throw new Error('no graph found');
    }
    const { nodesSelected } = this;
    if (nodesSelected.size === 0) {
      throw new Error('no selected nodes');
    }
    const { sourceNode, pathType, pathFilterType, targetNode, edgeTypes, direction, minStep, maxStep } = params;
    const directions = getDirection(direction);
    const pathInfo = getPathPattern(pathType);
    const stepRange = `${minStep}${maxStep ? ',' + maxStep : ''}`;
    const edgeCondition =
      typeof edgeTypes === 'string' && edgeTypes === ALL_EDGE_TYPE_KEY
        ? ''
        : ` where type(e) in [${Array.isArray(edgeTypes) ? edgeTypes.map((type: string) => `"${type}"`).join(',') : ''}]`;
    const sourceNodeCondition = this.getGqlNodeConditionPattern(
      sourceNode.data,
      this.explorerStore.nodeTypePrimaryKeysMap.get(sourceNode.data.value.type)!,
      'v'
    );
    const targetNodeCondition = this.getGqlNodeConditionPattern(
      targetNode.data,
      this.explorerStore.nodeTypePrimaryKeysMap.get(targetNode.data.value.type)!,
      'v1'
    );
    const edgeWithSampleClause = this.getSampleClause(`e`, {
      skipSample: this.shouldSkipSample(edgeTypes, direction),
    });
    const edgeWithCondition = `${edgeWithSampleClause}${edgeCondition}`;

    const gql = `/*+ SET_VAR(prune_vector_properties = true) */ USE \`${graph}\` MATCH p = ${pathInfo[0]} ${pathFilterType} ${pathInfo[1]} (v@\`${sourceNode.data.value.type}\` where ${sourceNodeCondition}) ${directions[0]}[${edgeWithCondition}]${directions[1]}{${stepRange}}(v1@\`${targetNode.data.value.type}\` where ${targetNodeCondition}) return p limit ${this.querySettings.maxRowsLimit}`;
    this.execGqlAndUpdateGraph(gql, {
      shouldNodeSelected: true,
      shouldLinkSelected: true,
    });
  };

  queryRandom = async () => {
    const graph = this.explorerStore.currentSnapshot?.graph;
    if (!graph) {
      throw new Error('no graph found');
    }
    const gql = `/*+ SET_VAR(prune_vector_properties = true) */ USE \`${graph}\` match (v) limit 10 return v next USE \`${graph}\` match p=(v)-[e]-{0,2}(v2) return p limit 50`;
    this.execGqlAndUpdateGraph(gql);
  };

  getGqlNodeConditionPattern = (nodeType: VertexValue, properties: string[], flag: string) => {
    const graph = this.explorerStore.currentSnapshot?.graph;
    if (!graph) {
      throw new Error('no graph found');
    }
    const graphTypeDetails = this.explorerStore.graphTypeDetails;
    const nodeTypeDetail = graphTypeDetails?.find((type) => type.type_name === nodeType.value.type);
    if (!nodeTypeDetail) {
      throw new Error('no node type detail');
    }
    return properties
      .map((property) => {
        const perpertyInfo = nodeTypeDetail.propertyInfos.find((p) => p.property_name === property);
        return [
          property,
          parseValueByPropertyType(nodeType.value.properties[property] as string, perpertyInfo!.data_type),
        ];
      })
      .map(([property, value]) => `${flag}.\`${property}\` = ${value}`)
      .join(' AND ');
  };

  execGqlAndUpdateGraph = async (
    gql: string,
    params?: {
      autoRoundLayout?: boolean;
      shouldNodeSelected?: boolean;
      shouldLinkSelected?: boolean;
    }
  ) => {
    const { autoRoundLayout = true, shouldNodeSelected = true, shouldLinkSelected = false } = params || {};
    this.setPageLoading(true);

    // Timeout Limit & Request Queue
    const { controller, promise } = this.requestQueue.add((signal) =>
      this.options.execGql<GQLResult<GraphDataTable>>(gql, {
        signal,
        queryTimeout: (this.querySettings.queryTimeout ?? 0) * 1000,
      })
    );
    let res;
    try {
      res = await promise;
    } catch (error) {
      this.setPageLoading(false);
      if (controller.signal.aborted) {
        return;
      }
      throw error;
    }
    if (!res) {
      this.setPageLoading(false);
      return;
    }
    const { code, data } = res;

    if (code === 0) {
      const result = this.parseSubGraph(data?.tables || [], this.explorerStore.nodeTypePrimaryKeysMap);
      if (!result) {
        this.setPageLoading(false);
        return;
      }
      if (result.edges.length === 0 && result.vertexes.length === 0) {
        this.message?.info(this.explorerStore.translate('queryNoData', { ns: 'explorer' }));
      }
      await this.getExploreInfo({
        data: result,
        ...params,
        autoRoundLayout,
        shouldNodeSelected,
        shouldLinkSelected,
        // autoRoundLayout: false,
        // shouldNodeSelected: true,
      });
      this.updateShouldBlockRouter(true);
    }
    this.setPageLoading(false);
  };

  resize = debounce(() => {
    if (!this.graphContainer) {
      return;
    }
    const { width, height } = this.graphContainer.getBoundingClientRect();
    this.unsafeAction((store) => (store.rect = { width, height }));
    // TODO: use reaction in `TwoGraphStore` to resize
    this.twoGraph?.resize();
  }, 100);

  parseSubGraph = (
    data: GraphDataTable[],
    nodeTypePrimaryKeysMap?: Map<string, string[]>,
    options?: {
      maxNodesLimit?: number;
      removeDuplicateNodes?: boolean;
    }
  ): {
    vertexes: NodeObject[];
    edges: LinkObject[];
  } => {
    const vertexes: NodeObject[] = [];
    const edges: LinkObject[] = [];
    data.forEach((row) => {
      const values = Object.keys(row)
        .filter((key) => row[key] !== null && typeof row[key] === 'object')
        .map((key) => row[key]!);
      flattenGraphTableData<GraphDataTableValueType>(values).forEach((rowItem) => {
        if (!rowItem) return;
        if (rowItem.type === RawEntityType.EDGE) {
          edges.push(parseEdgeValueToLinkObject(rowItem, this.linkColorPicker.whichColor(rowItem.value.type)));
        } else if (rowItem.type === RawEntityType.NODE) {
          vertexes.push(
            parseVertexValueToNodeObject(
              rowItem,
              this.nodeColorPicker.whichColor(rowItem.value.type),
              nodeTypePrimaryKeysMap
            )
          );
        } else if (rowItem.type === RawEntityType.PATH) {
          rowItem.value.forEach((item) => {
            if (isEdgeNodeValue(item)) {
              edges.push(
                parseEdgeValueToLinkObject(
                  {
                    raw: `${(item as GraphEdgeValue).srcId}-${(item as GraphEdgeValue).dstId}-${(item as GraphEdgeValue).rank}`,
                    type: RawEntityType.EDGE,
                    value: item as GraphEdgeValue,
                  },
                  this.linkColorPicker.whichColor(item.type)
                )
              );
            } else {
              vertexes.push(
                parseVertexValueToNodeObject(
                  {
                    raw: rowItem.raw,
                    type: RawEntityType.NODE,
                    value: item as GraphNodeValue,
                  },
                  this.nodeColorPicker.whichColor(item.type),
                  nodeTypePrimaryKeysMap
                )
              );
            }
          });
        }
      });
    });

    // Remove duplicate nodes based on their id (enabled by default)
    const shouldRemoveDuplicates = options?.removeDuplicateNodes !== false;

    if (shouldRemoveDuplicates) {
      const uniqueVertexMap = new Map<string, NodeObject>(vertexes.map((vertex) => [vertex.id as string, vertex]));
      let uniqueVertexes = Array.from(uniqueVertexMap.values());

      // Limit max nodes if maxNodesLimit is set
      if (typeof options?.maxNodesLimit === 'number' && uniqueVertexes.length > options.maxNodesLimit) {
        uniqueVertexes = uniqueVertexes.slice(0, options.maxNodesLimit);
      }

      // Replace original vertexes array with deduplicated and limited array
      vertexes.length = 0;
      vertexes.push(...uniqueVertexes);
    } else if (typeof options?.maxNodesLimit === 'number' && vertexes.length > options.maxNodesLimit) {
      // Only apply maxNodesLimit when not removing duplicates
      vertexes.length = options.maxNodesLimit;
    }

    // Filter out edges whose source or target node is not present in the vertexes list
    const vertexIdSet = new Set(vertexes.map((v) => v.id));
    const filteredEdges = edges.filter(
      (edge) => vertexIdSet.has(edge.source as string) && vertexIdSet.has(edge.target as string)
    );

    // Replace edges with filteredEdges
    edges.length = 0;
    edges.push(...filteredEdges);

    return { vertexes, edges };
  };

  downloadSelectedEntityAsCsv = () => {
    downloadCSVFiles<VertexValue | EdgeValue>({
      data: [
        ...Array.from(this.nodesSelected).map((node) => node.data),
        ...Array.from(this.linksSelected).map((link) => link.data),
      ],
      title: 'selectedEntity',
    });
  };

  /**
   * Get SAMPLE clause for edge pattern to limit neighbors per anchor node
   * @param edge - edge variable name (e.g. 'e')
   */
  private shouldSkipSample(edgeTypes: string[] | typeof ALL_EDGE_TYPE_KEY, direction: EdgeDirectionType) {
    return this.hasUndirectedDirection(direction) || this.hasUndirectedEdgeType(edgeTypes);
  }

  private hasUndirectedDirection(direction: EdgeDirectionType) {
    return getDirection(direction).some((directionPart) => directionPart.includes('~'));
  }

  private hasUndirectedEdgeType(edgeTypes: string[] | typeof ALL_EDGE_TYPE_KEY) {
    const selectedEdgeTypeSet =
      typeof edgeTypes === 'string' && edgeTypes === ALL_EDGE_TYPE_KEY ? undefined : new Set(edgeTypes);

    return this.explorerStore.curEdgeTypes.some((edgeType) => {
      if (selectedEdgeTypeSet && !selectedEdgeTypeSet.has(edgeType.type_name)) {
        return false;
      }
      if (!edgeType.type_pattern) {
        return false;
      }
      return extractEdgeByEdgeTypeName(edgeType.type_pattern)?.direction === EdgeDirectionType.Undirected;
    });
  }

  private getSampleClause(edge: string, options?: { sampleDirection?: 'RIGHT'; skipSample?: boolean }) {
    if (options?.skipSample) {
      return edge;
    }

    const limit = this.querySettings.maxNeighborsLimit;
    if (typeof limit === 'number' && limit > 0) {
      // FIRST_FETCH is the default sample method
      return [edge, 'SAMPLE', options?.sampleDirection, limit].filter(Boolean).join(' ');
    }
    return edge;
  }
}
