import { action, computed, IReactionDisposer, makeAutoObservable, observable, reaction } from 'mobx';
import {
  GraphEntityType,
  DescGraphTypeResult,
  DescNodeTypeResult,
  DescEdgeTypeResult,
  GQLResult,
  RequestQueue,
} from '@vesoft-inc/utils';
import groupBy from 'lodash/groupBy';
import type { Snapshot } from '@studio/interfaces/explorer/explorer';
import type { GraphDataTable } from '@studio/interfaces/explorer/gql';
import type { execGql } from '@studio/services';
import { ColorPicker, SiderPanel } from '@studio/interfaces/explorer/explorer';
import { GraphStore } from './graph';
import { MinimapStore } from './minimap';
import { getAllLabelsByGraphType } from '@studio/utils/graph/helpers';
import type { ModalStore } from '@vesoft-inc/ui-components/modal';
import { Settings4GraphStore } from '@studio/components/Settings/constants';

/** Snapshot restore lifecycle of a graph workspace. */
export type GraphRestoreState = 'idle' | 'restoring' | 'ready';

export class GraphWorkspaceStore {
  explorerId?: string;
  currentSnapshot?: Snapshot;
  graphTypeDetails?: DescGraphTypeResult[];
  activeSiderKey?: SiderPanel;
  graph: GraphStore;
  isFullScreen = false;
  snapShopDisposer?: IReactionDisposer;
  nodeTypePrimaryKeysMap = new Map<string, string[]>();
  edgeTypeMultiEdgeKeyMap = new Map<string, DescGraphTypeResult['primary_key/multiedge_key']>();
  minimap: MinimapStore;
  labelColorPicker: ColorPicker = new ColorPicker('label');
  loading = false;
  /** Drives the canvas loading gate: `restoring` until the snapshot payload has been applied. */
  restoreState: GraphRestoreState = 'idle';

  stores?: { modalStore?: ModalStore };
  private _settings?: Settings4GraphStore;
  execGql: typeof execGql;
  private requestQueue: RequestQueue;
  private destroyed = false;

  constructor(options: {
    stores?: { modalStore?: ModalStore };
    explorerId?: string;
    execGql: typeof execGql;
    settings?: Settings4GraphStore;
    requestQueue?: RequestQueue;
  }) {
    makeAutoObservable(this, {
      stores: observable.ref,
      currentSnapshot: observable.ref,
      graph: observable.ref,
      snapShopDisposer: false,
      minimap: false,
      curNodeTypes: computed,

      updateActiveSiderKey: action,
      getGraphTypeDetail: false,
    });
    this.execGql = options.execGql;
    this.requestQueue = options.requestQueue ?? new RequestQueue({ concurrency: 1 });
    this.stores = options.stores;
    this.graph = new GraphStore(
      {
        explorerStore: this,
        modalStore: options.stores?.modalStore,
      },
      {
        execGql: options.execGql,
        settingsGetter: () => this.settings,
        requestQueue: this.requestQueue,
      }
    );
    this._settings = options.settings;
    this.minimap = new MinimapStore(this);
    this.explorerId = options.explorerId;
    this.labelColorPicker = new ColorPicker('label');
    this.initReactions();
  }

  get settings() {
    return { ...this._settings };
  }

  updateSettings = (settings: Partial<Settings4GraphStore>) => {
    this._settings = { ...this._settings, ...settings };
  };

  initSnapShot = (snapshot?: Snapshot) => {
    this.updateCurrentSnapshot(snapshot);
  };

  setRestoreState = (restoreState: GraphRestoreState) => {
    this.restoreState = restoreState;
  };

  isPropertyPrimaryKey = (typeName: string, propertyName: string) => {
    const primaryKeys = this.nodeTypePrimaryKeysMap.get(typeName);
    return primaryKeys?.includes(propertyName);
  };

  initReactions = () => {
    this.snapShopDisposer = reaction(
      () => this.currentSnapshot?.name,
      () => {
        if (this.currentSnapshot?.graph_type) {
          this.initGraphTypeDetails(this.currentSnapshot.graph_type);
        }
        if (this.currentSnapshot?.data) {
          this.graph.recoverSnapShotData(this.currentSnapshot.data);
          this.graph.pushHistory();
        }
      }
    );
  };

  initGraphTypeDetails = (graphType: string) => {
    this.getGraphTypeDetail(graphType).then((graphTypes) => {
      this.unsafeAction(() => {
        this.graphTypeDetails = graphTypes;
        this.nodeTypePrimaryKeysMap = this.getNodeTypePrimaryKeysMap();
        this.edgeTypeMultiEdgeKeyMap = this.getEdgeTypeMultiEdgeKeyMap();
        this.labelColorPicker.initColorMap(
          getAllLabelsByGraphType(graphTypes).map((item) => ({
            key: item,
          }))
        );
        this.graph.initDisplayedNodePropertyItems();
        this.graph.initDisplayedEdgePropertyItems();
      });
    });
  };

  get curNodeTypes() {
    return this.graphTypeDetails?.filter((item) => item.entity_type === GraphEntityType.Node) || [];
  }

  get curEdgeTypes() {
    return this.graphTypeDetails?.filter((item) => item.entity_type === GraphEntityType.Edge) || [];
  }

  setIsFullScreen = (isFullScreen: boolean) => {
    this.isFullScreen = isFullScreen;
  };

  updateLoading = (loading: boolean) => {
    this.loading = loading;
  };

  unsafeAction = (fn: (store: this) => void) => action('unsafeAction', () => fn(this))();

  updateActiveSiderKey = (key?: SiderPanel) => {
    this.activeSiderKey = key;
  };

  updateCurrentSnapshot = (snapshot?: Snapshot) => {
    this.currentSnapshot = snapshot;
  };
  getGraphTypeDetail = async (graphType: string): Promise<DescGraphTypeResult[]> => {
    const gql = `CALL describe_graph_type("${graphType}") RETURN *`;
    const res = await this.execGqlBySerial<GQLResult<DescGraphTypeResult>>(gql);
    if (res?.code === 0) {
      const nodeTypes: DescGraphTypeResult[] = [];
      const edgeTypes: DescGraphTypeResult[] = [];
      (res.data?.tables || []).forEach((item) => {
        const { entity_type } = item;
        if (entity_type === GraphEntityType.Node) {
          nodeTypes.push(item);
        } else if (entity_type === GraphEntityType.Edge) {
          edgeTypes.push(item);
        }
      });
      const [updatedNodeTypes, updatedEdgeTypes] = await Promise.all([
        this.updateNodeTypeItemProperty(graphType, nodeTypes),
        this.updateEdgeTypeItemProperty(graphType, edgeTypes),
      ]);
      return updatedNodeTypes.concat(updatedEdgeTypes);
    }
    return [];
  };

  updateNodeTypeItemProperty = async (
    graphType: string,
    nodeTypes: DescGraphTypeResult[]
  ): Promise<DescGraphTypeResult[]> => {
    const nodePropertyGql = [
      `LET gtn = "${graphType}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Node"`,
      `CALL describe_node_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await this.execGqlBySerial<GQLResult<DescNodeTypeResult>>(nodePropertyGql);
    if (res?.code === 0) {
      const info = groupBy(res.data?.tables || [], (item) => item.type_name);
      return nodeTypes.map((nodeType) => ({
        ...nodeType,
        propertyInfos: (info[nodeType.type_name] || []) as DescNodeTypeResult[],
      }));
    }
    return nodeTypes;
  };

  updateEdgeTypeItemProperty = async (
    graphType: string,
    edgeTypes: DescGraphTypeResult[]
  ): Promise<DescGraphTypeResult[]> => {
    const edgePropertyGql = [
      `LET gtn = "${graphType}"`,
      `CALL describe_graph_type(gtn) YIELD entity_type, type_name filter where entity_type = "Edge"`,
      `CALL describe_edge_type(gtn, type_name)`,
      `RETURN *`,
    ].join('');
    const res = await this.execGqlBySerial<GQLResult<DescEdgeTypeResult>>(edgePropertyGql);
    if (res?.code === 0) {
      const info = groupBy(res.data?.tables || [], (item) => item.type_name);
      return edgeTypes.map((edgeType) => ({
        ...edgeType,
        propertyInfos: info[edgeType.type_name] || [],
      }));
    }
    return edgeTypes;
  };

  getRandomNodeIds = async (count = 5, nodeType?: string) => {
    const graph = this.currentSnapshot?.graph;
    if (!graph) {
      this.stores?.modalStore?.message.warning('Please select a snapshot first');
      return [];
    }
    const gql = `USE \`${graph}\` MATCH (v${nodeType ? `@\`${nodeType}\`` : ''}) RETURN ELEMENT_ID(v) as id LIMIT ${count}`;
    const res = await this.execGqlBySerial<GQLResult<{ id: number }>>(gql);
    return res?.data?.tables?.map((item) => item.id.toString()) || [];
  };

  getNodeTypePrimaryKeysMap() {
    const map = new Map<string, string[]>();
    this.graphTypeDetails?.forEach((item) => {
      if (item.entity_type === GraphEntityType.Node) {
        map.set(item.type_name, item['primary_key/multiedge_key'] as string[]);
      }
    });
    return map;
  }

  getEdgeTypeMultiEdgeKeyMap() {
    const map = new Map<string, DescGraphTypeResult['primary_key/multiedge_key']>();
    this.graphTypeDetails?.forEach((item) => {
      if (item.entity_type === GraphEntityType.Edge) {
        const multiKeyType = item['primary_key/multiedge_key'] as DescGraphTypeResult['primary_key/multiedge_key'];
        map.set(item.type_name, multiKeyType);
      }
    });
    return map;
  }

  getNodesByElementIds = async (ids: string[]) => {
    const graph = this.currentSnapshot?.graph;
    if (!graph) {
      this.stores?.modalStore?.message.warning('Please select a snapshot first');
      return { vertexes: [], edges: [] };
    }
    const gql = `USE \`${graph}\` MATCH (v) WHERE ELEMENT_ID(v) IN LIST [${ids.join(',')}] RETURN v`;
    const res = await this.execGqlBySerial<GQLResult<GraphDataTable>>(gql);
    const data = res?.data?.tables || [];
    const result = this.graph.parseSubGraph(data, this.nodeTypePrimaryKeysMap);
    return result;
  };

  getGraphTypeInfo = async (graphName: string) => {
    const gql = `CALL describe_graph("${graphName}") yield graph_type_name CALL describe_graph_type(graph_type_name) return *`;
    const res = await this.execGqlBySerial<GQLResult<DescGraphTypeResult>>(gql);
    return res?.data?.tables || [];
  };

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.snapShopDisposer?.();
    this.snapShopDisposer = undefined;
    this.requestQueue.abortAll('Graph workspace destroyed');
    this.requestQueue.clear();
    this.graph.destroyGraph();
    this.minimap.destroy();
    this.restoreState = 'idle';
    this.updateCurrentSnapshot(undefined);
  }

  execGqlBySerial = async <T extends object>(gql: string) => {
    if (this.destroyed) return;
    const { controller, promise } = this.requestQueue.add((signal) =>
      this.execGql<T>(gql, { signal, queryTimeout: (this.settings.queryTimeout ?? 0) * 1000 })
    );
    try {
      const res = await promise;
      if (!res) {
        return;
      }
      return res;
    } catch (error) {
      if (this.destroyed || controller.signal.aborted) {
        return;
      }
      throw error;
    }
  };
}
